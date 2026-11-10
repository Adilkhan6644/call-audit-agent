# Deployment

Both services deploy as Vercel serverless functions (free tier, no card
required). Each is its own Vercel project, same GitHub repo.

## 1. `server` (Node/Express)

- **New Project** → import this repo → **Root Directory: `server`**
- Vercel reads `server/vercel.json` — a serverless entrypoint at `api/index.js`
  wraps the existing Express app; `src/server.js` (local `app.listen()`) is
  untouched, so `npm run dev` still works normally.
- **Env vars** (same keys as `server/.env.example`):
  `MONGODB_URI`, `JWT_SECRET`, `AI_SERVICE_URL` (→ ai-service's deployed URL
  + `/api/v1`), `LLM_PROVIDER`, `INTERNAL_API_SECRET`, `SUPABASE_URL`,
    `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET_NAME`, `ADMIN_EMAILS`,
    `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUDIT_RATE_LIMIT_MAX`
- **MongoDB Atlas**: Network Access must allow `0.0.0.0/0` — Vercel functions
  don't have a fixed outbound IP.
- Swagger UI:[call-audit-agent-nine.vercel.app/docs/#](https://call-audit-agent-nine.vercel.app/docs/#/)  (trailing slash; bare `/docs`
  redirects there automatically).

## 2. `ai-service` (Python/FastAPI)

- **New Project** → import the same repo → **Root Directory: `ai-service`**
  (not `ai-service/api`, not `ai-service/app` — both subfolders are needed
  together).
- Vercel reads `ai-service/vercel.json` — entrypoint `api/index.py` imports
  the existing FastAPI `app`. `app/**` is force-included via
  `config.includeFiles` since Vercel's builder doesn't otherwise bundle
  files that aren't traced through a literal top-level import.
- Dependencies install from `api/requirements.txt` (slim: fastapi, uvicorn,
  httpx, deepgram-sdk — **no torch/whisper**). This only works because
  `STT_PROVIDER=deepgram` is set below; `faster_whisper`/`openai_whisper`
  need the full `requirements.txt` and won't fit Vercel's function size
  limit anyway.
- **Env vars** (same keys as `ai-service/.env.example`):
  `APP_ENV=production`, `STT_PROVIDER=deepgram`, `DEEPGRAM_API_KEY`,
  `LLM_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL`,
  `GROQ_MAX_INPUT_TOKENS`, `INTERNAL_API_SECRET`
- Health check: [call-audit-agent-py7u-dha06neul-adil-7c7a.vercel.app/docs#](https://call-audit-agent-py7u-dha06neul-adil-7c7a.vercel.app/docs#/)

## Auth model between the two services

`ai-service` has no user accounts — it's only ever called by `server`. Every
internal endpoint (`/api/v1/internal/*`) requires the exact
`INTERNAL_API_SECRET` value in a header (`secrets.compare_digest`, timing-safe).
**This value must be byte-identical on both Vercel projects.** `/health` and
`/readiness` are intentionally open (no secret, nothing sensitive returned).

The service is publicly reachable at the network layer (no IP allowlisting on
Vercel) but functionally locked behind that secret — same model as an API key.

## Known limits of this hosting choice

- **Execution timeout**: Vercel's free tier caps function duration at ~10s
  (up to ~60s with Fluid Compute). Long audio recordings going through
  transcription + LLM scoring in one request can exceed this — a platform
  limit, not something fixable in code. Render/Railway/Fly avoid this but all
  require card verification even on their free tiers, which is why this
  project uses Vercel for both services instead.
- **No rate limiting on `ai-service`** (unlike `server`, which has
  `express-rate-limit`). Low risk as long as `INTERNAL_API_SECRET` never
  leaks, but worth adding if that becomes a concern.

## Redeploying after env var changes

Vercel does not retroactively apply new/changed env vars to an existing
deployment — trigger a redeploy (Deployments → ⋯ → Redeploy, or push a commit)
after adding or changing one.
