# ai-service — Developer Guide

This is the deep-dive doc. For "how do I start it," see [`README.md`](README.md)
instead — this file is about how the service actually works, so you can
change it safely.

## 1. What this service is (and isn't)

`ai-service` is a **stateless FastAPI microservice** with exactly one job:
turn audio + instructions into a structured audit result. It:

- Has **no database**, **no user accounts**, **no business data**.
- Exposes exactly two real endpoints: `/internal/transcribe` (speech-to-text)
  and `/internal/audit` (LLM scoring), plus `/health` and `/readiness`.
- Is **never called by a frontend**. Its only caller is `server/` (the Node
  main backend), authenticated by a shared secret header, never a user JWT.
- Does not know about users, categories, recordings, or billing. It receives
  a transcript and an instruction string and returns a score. That's it.

If you find yourself wanting to add a model, a database table, or a user
concept here — stop. That almost certainly belongs in `server/` instead.
This split is a deliberate architecture decision (see `plan.md` at the repo
root, "Decisions already locked," item 1).

## 2. Request flow

```
Node (server/)
   │  POST /internal/transcribe  (multipart file upload)
   │  POST /internal/audit       (JSON: transcript, instructions, api_key_override?)
   │  header: X-Internal-Secret: <shared secret>
   ▼
FastAPI app (app/main.py)
   │
   ├─ require_internal_secret dependency   (app/core/internal_auth.py)
   │     401 if header missing/wrong — secrets.compare_digest, not ==
   │
   ├─ /internal/transcribe  (app/api/v1/internal.py)
   │     validate extension + magic bytes → stream to temp file →
   │     get_stt_provider() → call_with_retry(provider.transcribe, ...)
   │     → TranscriptResultOut
   │
   └─ /internal/audit  (app/api/v1/internal.py)
         get_llm_provider(api_key_override=...) →
         call_with_retry(provider.audit, transcript, instructions) →
         validate_audit_result(...) → AuditResultSchema
```

Every error, from any layer, is caught by `app/core/error_handlers.py` and
turned into `{"error": {"code": ..., "message": ...}}` — the same envelope
shape `server/` uses, so the frontend (eventually) never has to branch on
which backend answered.

## 3. Directory map

```
app/
├── main.py                  FastAPI app construction, mounts the v1 router
├── api/v1/
│   ├── health.py            GET /health — liveness
│   ├── readiness.py         GET /readiness — is INTERNAL_API_SECRET set?
│   └── internal.py          POST /internal/transcribe, POST /internal/audit
├── core/
│   ├── config.py            pydantic-settings — every env var lives here
│   ├── internal_auth.py     require_internal_secret — the one auth chokepoint
│   ├── audio_validation.py  ALLOWED_EXTENSIONS, MAGIC_CHECKS, MAX_UPLOAD_SIZE_BYTES
│   ├── exceptions.py        AppError + 404/409/401/403 subclasses
│   ├── provider_exceptions.py  ProviderTimeoutError, ProviderQuotaExceededError
│   └── error_handlers.py    turns any exception into the {error:{...}} envelope
├── schemas/
│   ├── internal.py          Request/response shapes for the two internal routes
│   └── audit_result.py      AuditResultSchema — the one source of truth for
│                             "what a valid audit result looks like" (strict,
│                             extra="forbid")
└── services/
    ├── ai_client_wrapper.py call_with_retry — the only retry/timeout policy
    ├── stt/                 Speech-to-text providers
    │   ├── base.py           SttProvider protocol, TranscriptResult/Segment
    │   ├── factory.py        get_stt_provider(name=None)
    │   ├── faster_whisper_provider.py   local, CPU, no diarization
    │   ├── openai_whisper_provider.py   local, CPU, no diarization
    │   ├── deepgram_provider.py         REST API, real speaker diarization
    │   └── mock.py           deterministic 2-speaker fake, no network
    └── llm/                  LLM audit-scoring providers
        ├── base.py           LlmProvider protocol, StructuredAuditResult
        ├── factory.py        get_llm_provider(name=None, api_key_override=None)
        ├── prompt.py         SYSTEM_PROMPT, build_user_prompt, parse_audit_json,
        │                     truncate_transcript, CHARS_PER_TOKEN
        ├── errors.py         classify_provider_failure — quota vs. generic
        ├── openai_provider.py
        ├── gemini_provider.py
        ├── groq_provider.py
        └── mock.py           deterministic fake, no network
```

## 4. The STT subsystem

Every provider implements the `SttProvider` protocol (`stt/base.py`):
`transcribe(file_path: str) -> TranscriptResult`. `TranscriptResult` has
`text`, `language`, `duration_seconds`, and `segments` (speaker-tagged
chunks).

| Provider | How it works | Diarization (who said what) |
|---|---|---|
| `faster_whisper` (default) | Local model, CPU, `int8` | No — everything is "Speaker 1" |
| `openai_whisper` | Local model via the `openai-whisper` package | No — same limitation |
| `deepgram` | Real REST API call (`httpx.post`, not the `deepgram-sdk` package — see `deepgram_provider.py`) | **Yes** — groups Deepgram's per-word speaker tags into contiguous turns via `_group_words_by_speaker` |
| `mock` | Hardcoded 2-speaker fixture, zero network calls | Yes (fake) |

Pick the provider with `STT_PROVIDER` in `.env`. `get_stt_provider(name=None)`
in `factory.py` is an explicit choice, never a fallback chain — an unknown
name raises `AppError(500)` rather than silently picking something else.

**Validation happens before any provider runs.** `/internal/transcribe`
checks the file extension against `ALLOWED_EXTENSIONS` (`.mp3 .wav .m4a
.ogg`), then reads the real file header and checks `MAGIC_CHECKS` (e.g. a
`.wav` must actually start with `RIFF`/`WAVE`) — never trusts the extension
or a client-supplied content type alone. It streams the upload to a temp
file in 1MB chunks, aborting with `422` the moment `MAX_UPLOAD_SIZE_BYTES`
(100MB) is exceeded, so an oversized file never fully lands on disk. The
temp file is always deleted in a `finally` block.

## 5. The LLM subsystem

Every provider implements `LlmProvider` (`llm/base.py`):
`audit(transcript, instructions) -> StructuredAuditResult`
(`summary`, `score`, `findings`).

| Provider | Endpoint | Notes |
|---|---|---|
| `openai` | `api.openai.com/v1/chat/completions` | Uses `response_format: json_object` |
| `gemini` | `generativelanguage.googleapis.com/.../generateContent` | Uses `generationConfig.responseMimeType: application/json` |
| `groq` | `api.groq.com/openai/v1/chat/completions` | OpenAI-compatible shape. Truncates the transcript first (see below). Default model `openai/gpt-oss-120b` — **check `GET /openai/v1/models` against your own Groq key before changing this**, available models vary by account and `llama-3.3-70b-versatile` is not on every account's catalog. |
| `mock` (default) | none | Deterministic, used until a real key is configured |

None of the three real providers use a vendor SDK — they're all plain
`httpx.post` calls with a hand-built JSON body, matching the pattern the
Deepgram STT provider already established. All three share:

- **`prompt.py`**'s `SYSTEM_PROMPT` (instructs the model to return *only* a
  JSON object matching `{summary, score, findings}`) and `build_user_prompt`.
- **`parse_audit_json`** — strips markdown fences / stray text around the
  JSON object before parsing, since models don't always obey "no markdown"
  perfectly. Raises `AppError(502)` if what comes back still isn't JSON.
- **`classify_provider_failure`** (`errors.py`) — see §7.

### Token-limiting (Groq only, currently)

Large transcripts can exceed a model's context window. `GroqLlmProvider`
calls `truncate_transcript(transcript, max_input_tokens)` before building
the prompt. The heuristic (`prompt.py`):

- `CHARS_PER_TOKEN = 4` — a rough estimate, not a real tokenizer. No
  tokenizer dependency was added for this; if a transcript is ever rejected
  anyway, that's the signal to swap in a provider-specific tokenizer.
- If the transcript fits the budget (`max_input_tokens * 4` chars), it's
  returned untouched.
- If not, the **middle is cut, not the tail** — the call's opening and
  closing (greeting/consent, resolution/close) are usually the most
  informative parts, and a marker like
  `[...12345 characters omitted from the middle of this transcript...]`
  is inserted so the model knows truncation happened.

Budget is `GROQ_MAX_INPUT_TOKENS` (default `110000`, leaving headroom under
`openai/gpt-oss-120b`'s ~128K-token window for the system prompt,
instructions, and the model's own output). OpenAI and Gemini don't have
this yet — add the same call in their providers if you hit the same problem
there.

### Runtime API key override

`get_llm_provider(name=None, api_key_override=None)` accepts an optional key
that, when given, is used **instead of** the provider's boot-time env key —
for that one call only. This is how `server/`'s admin-rotated API keys
(`server/DEVELOPER_GUIDE.md` §6) reach this service without it storing
anything itself: Node sends `api_key_override` in the `/internal/audit`
request body, and ai-service never persists it. If you add a fourth real
provider, wire its constructor the same way
(`api_key_override or settings.<provider>_api_key`).

## 6. Retry and timeout policy — `ai_client_wrapper.py`

`call_with_retry(fn, *args, timeout_seconds=10.0, max_attempts=3, **kwargs)`
is **the only retry policy in this service.** Every provider call (STT and
LLM) goes through it. It:

- Runs `fn` in a single-worker `ThreadPoolExecutor` and waits up to
  `timeout_seconds`.
- Retries up to `max_attempts` times on a timeout.
- Raises `ProviderTimeoutError` (→ HTTP 504) if every attempt times out.

> **ponytail note already in the code:** the timeout is thread-based
> (stdlib only), so a timed-out call's thread keeps running in the
> background — Python can't kill a thread. Fine for this service's
> low-volume synchronous pipeline; switch to a subprocess-based timeout if a
> provider call ever starts leaking unbounded resources.

`/internal/transcribe` uses a 120-second timeout (transcription is
CPU-bound and can run far longer than the 10s default used elsewhere — see
the comment in `internal.py`).

**Do not add a second retry loop in `server/`.** `aiServiceClient.js` on the
Node side deliberately has no retry logic — only a request timeout — exactly
so this stays the one place a retry policy lives.

## 7. Error model

Three layers:

1. **`exceptions.py`** — `AppError(message, status_code=400)` is the base.
   Subclasses: `NotFoundError` (404), `ConflictError` (409),
   `UnauthorizedError` (401), `ForbiddenError` (403).
2. **`provider_exceptions.py`** — `ProviderTimeoutError` (504),
   `ProviderQuotaExceededError` (429, see below).
3. **`error_handlers.py`** — a FastAPI exception handler for `AppError` (and
   subclasses), `RequestValidationError` (422), and a catch-all `Exception`
   handler (500, logs the full traceback server-side, never leaks it to the
   client).

Every error response is `{"error": {"code": "...", "message": "..."}}`.
`handle_app_error` special-cases `ProviderQuotaExceededError` to emit
`code: "provider_quota_exceeded"`; everything else gets `code: "app_error"`.

### Quota/credits-exhausted detection

All three real LLM providers call `classify_provider_failure(provider_name,
response)` (`llm/errors.py`) on any non-2xx response, instead of each
hand-rolling the same check:

- **HTTP 402** → always `ProviderQuotaExceededError`.
- **HTTP 429** → `ProviderQuotaExceededError` *only if* the response body
  contains `insufficient_quota`, `resource_exhausted`, or `billing`
  (case-insensitive substring match). A plain 429 without one of those
  markers is treated as an ordinary rate limit, not "out of credits," and
  stays a generic `AppError(502)`.
- Anything else → generic `AppError(502)`.

> ⚠️ **This heuristic was written from general knowledge of each provider's
> error shape, not verified against a live failing call from this specific
> account.** Provider error bodies drift over time. Before relying on this
> in production, trigger a real quota-exhausted response from each provider
> (easiest: a throwaway key with $0 balance) and confirm the body still
> matches one of the markers above. If a provider changes its shape, update
> `_QUOTA_MARKERS` in `llm/errors.py` — that's the only place to change it.

This distinction exists so `server/` can raise an admin alert on "we're out
of credits" without also paging someone every time a user merely gets
rate-limited.

## 8. Configuration — every setting lives in `config.py`

All settings are read from `.env` via `pydantic_settings`. Copy
`.env.example` → `.env` and fill in real values.

| Variable | Default | Purpose |
|---|---|---|
| `APP_ENV` | `development` | Informational only |
| `APP_NAME` | `AuditIQ` | Shown in `/health` |
| `STT_PROVIDER` | `faster_whisper` | `faster_whisper` \| `openai_whisper` \| `deepgram` |
| `WHISPER_MODEL_SIZE` | `base` | Passed to whichever Whisper provider is active |
| `DEEPGRAM_API_KEY` | `""` | Required if `STT_PROVIDER=deepgram` |
| `INTERNAL_API_SECRET` | `""` | **Must exactly match `server/.env`'s value.** `/readiness` returns 503 if this is empty. |
| `LLM_PROVIDER` | `mock` | `mock` \| `openai` \| `gemini` \| `groq` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | `""` / `gpt-4o-mini` | |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | `""` / `gemini-2.0-flash` | |
| `GROQ_API_KEY` / `GROQ_MODEL` | `""` / `openai/gpt-oss-120b` | |
| `GROQ_MAX_INPUT_TOKENS` | `110000` | Truncation budget, see §5 |

## 9. Testing conventions

`pytest`, run from `ai-service/` with the repo-root shared venv:
`../venv/Scripts/python.exe -m pytest -q` (Windows) or `pytest -q` with the
venv activated.

- **Provider tests** monkeypatch `httpx.post` at the module path
  (`monkeypatch.setattr("app.services.llm.openai_provider.httpx.post", ...)`),
  returning a small fake response object (`status_code`, `.json()`, and
  `.text` where the quota classifier needs it). See
  `tests/test_llm_providers.py` and `tests/test_stt_providers.py` for the
  pattern — copy it for a new provider rather than inventing a new style.
- **Route tests** (`tests/test_internal_endpoints.py`) monkeypatch
  `app.api.v1.internal.get_llm_provider` / `get_stt_provider` directly with
  a fake provider object, and use FastAPI's `TestClient`.
- **Pure-logic tests** (`test_llm_errors.py`'s classifier table,
  `test_ai_client_wrapper.py`'s retry behavior, `test_audio_validation`-style
  magic-byte checks) need no monkeypatching at all.
- No test hits a real network — there is no "integration test that actually
  calls OpenAI" in this suite. If you add one, keep it opt-in (skipped
  unless a real key is present), never required for `pytest -q` to pass.

## 10. Adding a new LLM provider — checklist

1. `app/services/llm/<name>_provider.py` — a class with one method,
   `audit(transcript, instructions) -> StructuredAuditResult`, built the
   same way as the other three (plain `httpx.post`, `SYSTEM_PROMPT` +
   `build_user_prompt`, `parse_audit_json`, `classify_provider_failure` on
   any non-2xx response).
2. Add the provider name to `PROVIDERS` and the `if` chain in
   `llm/factory.py`, including `api_key_override` support.
3. Add `<name>_api_key` / `<name>_model` (and anything else it needs) to
   `config.py`, `.env.example`, and `server/.env.example`'s `LLM_PROVIDER`
   comment if relevant.
4. Tests: success path, generic-failure path, and — if the provider's docs
   give you a real quota/429 error shape — a quota-detection test, mirroring
   `test_llm_providers.py`.
5. If large transcripts could exceed this provider's context window, call
   `truncate_transcript` the same way `GroqLlmProvider` does.

## 11. Security notes

- `internal_auth.py` uses `secrets.compare_digest`, never `==`, to compare
  the shared secret — avoids a timing side-channel.
- The shared secret, and every provider API key, is **never logged and
  never echoed in an error response.** If you add logging near a provider
  call, log the status code and provider name, never headers or body
  content that could contain a key.
- `/internal/*` routes have no other authorization layer — anyone who can
  reach this service's port with the right secret can call it. It is
  **never** exposed to the public internet in the locked architecture; only
  `server/` calls it, over a private network in production.
- No PII/transcript content is logged at error level — the catch-all
  exception handler logs the exception, not the request body.

## Appendix: file-by-file reference

Every source file, in the order you'd read them. Test files are listed too,
grouped the same way, since "which test covers this file" is often the next
question.

### `app/`

| File | What's in it |
|---|---|
| `main.py` | Builds the `FastAPI` app, registers error handlers, mounts the v1 router. The whole app in ~15 lines. |

### `app/api/v1/`

| File | What's in it |
|---|---|
| `__init__.py` | Aggregates `health`, `readiness`, `internal` routers under prefix `/api/v1`. |
| `health.py` | `GET /health` — returns `{status: "ok", app_name}`. No dependencies, always 200. |
| `readiness.py` | `GET /readiness` — 503 if `INTERNAL_API_SECRET` isn't set, else 200. Catches "I forgot to configure `.env`" before it becomes a confusing 401 later. |
| `internal.py` | The two real endpoints. `POST /internal/transcribe`: validates extension + magic bytes, streams to a temp file (chunked, size-checked as it goes), calls the configured STT provider through `call_with_retry`, always deletes the temp file. `POST /internal/audit`: calls the configured LLM provider (with `api_key_override` if given) through `call_with_retry`, validates the result against `AuditResultSchema`. Both are gated by `require_internal_secret` at the router level. |

### `app/core/`

| File | What's in it |
|---|---|
| `config.py` | `Settings` (pydantic-settings) — every env var this service reads. The single source of truth for defaults; see §8 for the full table. |
| `internal_auth.py` | `require_internal_secret` — FastAPI dependency, compares the `X-Internal-Secret` header with `secrets.compare_digest` (timing-safe). The one auth chokepoint for `/internal/*`. |
| `audio_validation.py` | `ALLOWED_EXTENSIONS`, `MAX_UPLOAD_SIZE_BYTES`, and `MAGIC_CHECKS` — a dict of extension → "does this byte header actually look like this format" lambdas. Shared by `internal.py`'s transcribe route. |
| `exceptions.py` | `AppError` base class (`message`, `status_code`) plus `NotFoundError`/`ConflictError`/`UnauthorizedError`/`ForbiddenError` subclasses with sensible default messages and status codes. |
| `provider_exceptions.py` | `ProviderTimeoutError` (504) and `ProviderQuotaExceededError` (429) — both `AppError` subclasses, raised by the retry wrapper and the LLM error classifier respectively. |
| `error_handlers.py` | `register_error_handlers(app)` — wires up FastAPI exception handlers for `AppError`, `RequestValidationError` (422), and a catch-all `Exception` (500, logs full traceback, never leaks it). Everything becomes `{"error": {"code", "message"}}`. Special-cases `ProviderQuotaExceededError` → `code: "provider_quota_exceeded"`. |

### `app/schemas/`

| File | What's in it |
|---|---|
| `internal.py` | Pydantic models for the two internal routes' request/response bodies: `TranscriptSegmentOut`, `TranscriptResultOut`, `AuditRequestIn` (`transcript`, `instructions`, optional `api_key_override`). |
| `audit_result.py` | `AuditResultSchema` (`summary: str`, `score: float`, `findings: list[str]`, `extra="forbid"`) — the one source of truth for "what a valid audit result looks like." `validate_audit_result(data)` turns a `ValidationError` into an `AppError(502)` ("the AI provider returned garbage" is a 502, not a 422 — it's not the *client's* fault). |

### `app/services/`

| File | What's in it |
|---|---|
| `ai_client_wrapper.py` | `call_with_retry(fn, *args, timeout_seconds, max_attempts, **kwargs)` — the only retry/timeout policy in this service, thread-based (stdlib only). Raises `ProviderTimeoutError` after `max_attempts` timeouts. |

### `app/services/stt/`

| File | What's in it |
|---|---|
| `base.py` | `SttProvider` protocol (`transcribe(file_path) -> TranscriptResult`), `TranscriptResult`/`TranscriptSegment` dataclasses. |
| `factory.py` | `get_stt_provider(name=None)` — explicit choice from `PROVIDERS = (faster_whisper, openai_whisper, deepgram)`, defaults to `settings.stt_provider`. Unknown name → `AppError(500)`, never a silent fallback. |
| `faster_whisper_provider.py` | Local transcription via `faster-whisper` (CTranslate2), CPU, `int8`. No speaker diarization — everything is "Speaker 1" (needs `pyannote` + a HF token to add real diarization; not done). |
| `openai_whisper_provider.py` | Same idea, via the original `openai-whisper` package instead. Same no-diarization limitation. |
| `deepgram_provider.py` | The one provider with **real** diarization — calls Deepgram's REST API directly via `httpx` (not the `deepgram-sdk` package, despite it being in `requirements.txt`). `_group_words_by_speaker` collapses Deepgram's per-word speaker tags into contiguous speaker turns. |
| `mock.py` | `MockSttProvider` — hardcoded 2-speaker fixture, zero network calls, zero cost. Used for local dev/tests. |

### `app/services/llm/`

| File | What's in it |
|---|---|
| `base.py` | `LlmProvider` protocol (`audit(transcript, instructions) -> StructuredAuditResult`), `StructuredAuditResult` dataclass (`summary`, `score`, `findings`). |
| `factory.py` | `get_llm_provider(name=None, api_key_override=None)` — explicit choice from `PROVIDERS = (mock, openai, gemini, groq)`. Threads `api_key_override` into whichever real provider is built, so an admin-rotated key reaches it for that one call. |
| `prompt.py` | `SYSTEM_PROMPT`, `build_user_prompt`, `parse_audit_json` (strips markdown fences before parsing), `truncate_transcript` + `CHARS_PER_TOKEN` (the Groq token-budget heuristic, see §5). |
| `errors.py` | `classify_provider_failure(provider_name, response)` — the one shared "is this a quota-exhausted failure or just a generic one" heuristic, used by all three real providers. See §7 for the exact rule and its caveats. |
| `openai_provider.py` | `OpenAiLlmProvider` — plain `httpx.post` to `api.openai.com/v1/chat/completions`, `response_format: json_object`. |
| `gemini_provider.py` | `GeminiLlmProvider` — plain `httpx.post` to `generativelanguage.googleapis.com/.../generateContent`, `generationConfig.responseMimeType: application/json`. |
| `groq_provider.py` | `GroqLlmProvider` — plain `httpx.post` to `api.groq.com/openai/v1/chat/completions` (OpenAI-compatible shape). The only provider that calls `truncate_transcript` today. |
| `mock.py` | `MockLlmProvider` — deterministic fake, zero network calls. Default until a real `LLM_PROVIDER` + key is configured. |

### `tests/`

| File | Covers |
|---|---|
| `test_health.py`, `test_readiness.py` | The two liveness/config-check routes. |
| `test_internal_auth.py` | `require_internal_secret` — missing/wrong/correct header. |
| `test_internal_endpoints.py` | `/internal/transcribe` and `/internal/audit` end to end, with the STT/LLM provider monkeypatched — including the 429/`provider_quota_exceeded` path. |
| `test_audio_validation` cases live inside `test_internal_endpoints.py` | Extension/magic-byte/size rejection. |
| `test_stt_providers.py`, `test_stt_mock.py` | Each STT provider's parsing logic (mocked `httpx.post` for Deepgram) and the factory's provider selection. |
| `test_llm_providers.py` | Each LLM provider's success path, generic-failure path, and quota-detection path (mocked `httpx.post`); the factory's provider selection and `api_key_override` behavior; `parse_audit_json` and `truncate_transcript` unit tests. |
| `test_llm_mock.py` | `MockLlmProvider` returns a schema-valid result for normal/empty/malformed input. |
| `test_llm_errors.py` | Table-driven tests for `classify_provider_failure` across every status-code/body combination. |
| `test_ai_client_wrapper.py` | `call_with_retry`'s timeout/retry behavior. |
| `test_audit_result_schema.py` | `AuditResultSchema` validation, `validate_audit_result`'s error mapping. |
| `test_error_handling.py` | The FastAPI exception handlers produce the right envelope shape for each error type. |
