# server — Developer Guide

Deep-dive doc for the Node/Express/MongoDB main backend. For "how do I start
it," see [`README.md`](README.md) instead.

## 1. What this service owns

`server/` is the **only** thing a frontend talks to. It owns:

- Auth (register/login/JWT), users, admin role
- Categories and versioned audit instructions
- Recording metadata (the audio bytes themselves live in Supabase Storage —
  this service never touches the filesystem for them)
- The audit job pipeline — orchestrating calls to `ai-service/` and
  persisting the result
- History/export (list, CSV, PDF), usage tracking
- Admin capabilities: API key rotation for the LLM providers, rate
  limiting, quota-exhaustion alerts

It does **not** run any AI/ML code itself — STT and LLM calls are always
delegated to `ai-service/` over HTTP, through one client module
(`services/aiServiceClient.js`). If you're tempted to call OpenAI/Groq/etc.
directly from here, that belongs in `ai-service/` instead (see its own
`DEVELOPER_GUIDE.md`).

**Not built:** billing/subscriptions/Stripe. This was explicitly descoped —
see `plan.md`'s Phase 5 note. `ApiKeySetting`/`AdminAlert` exist, but there
is no `Subscription` model and no payment flow anywhere in this codebase.

## 2. Directory map

```
src/
├── app.js                   Express app: middleware + router mounting + error handlers
├── server.js                Entry point: connects Mongo, seeds categories, starts listening
├── swagger.js                swagger-jsdoc config — reads @openapi comments from routes/*.js
├── errors.js                 AppError + Unauthorized/Conflict/NotFound/Forbidden subclasses
├── db/connection.js           connectDb(uri), isConnected()
├── middleware/
│   ├── auth.js                authenticate — the one JWT-verification chokepoint
│   ├── adminOnly.js           adminOnly — the one admin-role chokepoint (run after authenticate)
│   └── rateLimit.js            generalLimiter, auditLimiter (express-rate-limit)
├── models/                    One Mongoose schema per file, no ORM abstraction beyond Mongoose
│   ├── user.js                 email, hashedPassword, role, isActive
│   ├── category.js             name, isBuiltin, ownerId (null = built-in)
│   ├── auditInstruction.js      categoryId, ownerId, version, content, isActive
│   ├── recording.js             ownerId, storageKey, contentType, sizeBytes, status
│   ├── auditJob.js              recordingId, instructionId, categoryId, ownerId, status, result, errorMessage
│   ├── usageRecord.js           ownerId, auditJobId, createdAt
│   ├── apiKeySetting.js         provider, value, updatedAt, updatedBy
│   └── adminAlert.js            type, message, resolved, occurrenceCount, firstSeenAt, lastSeenAt
├── services/                  Business logic — routes stay thin, call into here
│   ├── categories.js            ensureBuiltinCategories, getVisibleCategory
│   ├── auditInstructions.js      createNewVersion — the ONLY write path for instructions
│   ├── storage.js                Supabase Storage REST calls + upload validation
│   ├── recordings.js             getOwnRecording, deletePreviousDaysRecordings
│   ├── aiServiceClient.js         The only caller of ai-service/. transcribe(), audit()
│   ├── auditPipeline.js          runAuditPipeline — transcribe → audit → persist, one job at a time
│   ├── usage.js                   recordUsage, getUsageTotal
│   ├── csvExport.js / pdfExport.js   Hand-written CSV; pdfkit for PDF
│   ├── apiKeys.js                 getMasked, getRaw (internal only), rotate
│   └── adminAlerts.js             raiseProviderQuotaAlert — dedupe/cooldown
├── routes/                    Express routers — one per resource, mounted in app.js
│   ├── health.js / readiness.js
│   ├── auth.js                   /auth/register, /auth/login, /auth/me
│   ├── categories.js              /categories (CRUD)
│   ├── auditInstructions.js       /audit-instructions, /audit-instructions/active
│   ├── recordings.js              /recordings (CRUD + /download)
│   ├── audits.js                  /audits (CRUD + /export.csv + /export.pdf)
│   ├── usage.js                   /usage
│   └── admin.js                   /admin/api-keys, /admin/alerts
└── utils/
    ├── jwt.js                     createAccessToken, verifyAccessToken (HS256, 60min)
    └── password.js                hashPassword, verifyPassword (bcrypt, 12 rounds)
```

## 3. Data model reference

| Model | Key fields | Notes |
|---|---|---|
| `User` | `email` (unique), `hashedPassword`, `role` (`user`\|`admin`), `isActive` | Password never stored or logged in plaintext |
| `Category` | `name`, `isBuiltin`, `ownerId` (`null` = built-in, visible to everyone) | 6 built-ins (actually: Medical Billing, Sales Support, Front Desk, Customer Support, Collections — seeded at boot by `ensureBuiltinCategories`, idempotent) |
| `AuditInstruction` | `categoryId`, `ownerId`, `version`, `content`, `isActive` | **Versioned, never mutated in place.** A unique index on `(categoryId, ownerId, version)` enforces this at the DB level too. |
| `Recording` | `ownerId`, `storageKey`, `contentType`, `sizeBytes`, `status` (`uploaded`\|`processing`\|`processed`\|`failed`) | Audio bytes live in Supabase Storage at `storageKey`; this doc is metadata only |
| `AuditJob` | `recordingId`, `instructionId` (pinned exact version), `categoryId` (denormalized), `ownerId`, `status` (`pending`\|`processing`\|`completed`\|`failed`), `result`, `errorMessage` | `instructionId` stays pointed at whatever version was active *when the job was created*, even if a newer version exists later — audit traceability |
| `UsageRecord` | `ownerId`, `auditJobId` | Written only by the pipeline itself, after a **completed** (not failed) run — never accepted as client input |
| `ApiKeySetting` | `provider` (unique: `openai`\|`gemini`\|`groq`), `value`, `updatedAt`, `updatedBy` | Plaintext — see §6 for why. Full value is never returned by any API. |
| `AdminAlert` | `type` (`provider_quota_exceeded`), `message`, `resolved`, `occurrenceCount`, `firstSeenAt`, `lastSeenAt`, `resolvedAt` | Deduped: a repeat failure bumps the existing open one instead of creating a new row |

## 4. Auth and authorization

```
Client ──(email, password)──> POST /auth/register or /auth/login
                                      │
                                      ▼
                          bcrypt hash/verify (utils/password.js)
                                      │
                                      ▼
                         JWT access token, HS256, 60min
                         { sub: userId, type: "access" }
                                      │
Client ──Authorization: Bearer <token>──> any protected route
                                      │
                                      ▼
                    authenticate middleware (middleware/auth.js)
                    verifies token → loads User from DB → req.user
                                      │
                    (admin routes only) adminOnly middleware
                    checks req.user.role === 'admin', else 403
```

- **Login never reveals whether the email exists** — wrong password and
  nonexistent email both return the identical `401 "Incorrect email or
  password"`.
- `authenticate` always re-reads the user from the DB (`req.user`), never
  trusts anything from the JWT payload except the user id. Same principle
  applies to `adminOnly` — it checks `req.user.role` from the DB record,
  never a client-supplied claim.
- **Admin bootstrap:** there's no admin-management UI. Set `ADMIN_EMAILS`
  (comma-separated) in `.env`; any user whose email is on that list gets
  promoted to `role: 'admin'` the next time they register or log in. This
  is **promote-only** — removing an email from the list later does *not*
  demote someone already promoted. To revoke admin, you'd currently have to
  flip the DB field directly; there's no endpoint for that (intentionally
  out of scope — see `plan.md` Phase 7).

## 5. The audit pipeline — the core feature

```
POST /audits  { categoryId, recordingId }
       │
       ├─ getOwnRecording(recordingId, user)       404 if not found/not yours
       ├─ getVisibleCategory(categoryId, user)      404 if not found/not visible
       ├─ find the category's active AuditInstruction   404 if none
       ├─ check for an existing pending/processing job on this recording
       │     → 409 if one exists (no duplicate concurrent runs)
       ├─ AuditJob.create({ status: 'pending', ... })
       │
       ▼
  runAuditPipeline(job, recording)        (services/auditPipeline.js)
       │
       ├─ job.status = 'processing'; save
       ├─ storage.download(recording.storageKey)         → audio Buffer
       ├─ aiServiceClient.transcribe(buffer, filename, contentType)
       │     → calls ai-service POST /internal/transcribe
       ├─ aiServiceClient.audit(transcript, instruction.content)
       │     → calls ai-service POST /internal/audit
       │     → attaches api_key_override if an admin has rotated a key
       │       for whatever provider LLM_PROVIDER names (see §6)
       │
       ├─ on success:
       │     job.status = 'completed'; job.result = <validated result>
       │     recordUsage(ownerId, jobId)
       │
       └─ on any failure:
             if err.code === 'provider_quota_exceeded':
                 raiseProviderQuotaAlert(...)   — admin alert, deduped
             job.status = 'failed'
             job.errorMessage = 'Audit processing failed'   — always this
             exact sanitized string, NEVER the raw provider error, which
             could contain transcript content
       │
       ▼
  res.status(201).json(job)     — runs synchronously; the HTTP response
                                   IS the final job state (no polling needed
                                   for a simple client, though GET /audits/:id
                                   still works if you want to check later)
```

**Nothing partial is ever persisted.** A job is either `completed` with a
schema-valid result, or `failed` with the one sanitized message — there is
no in-between state visible to a client beyond `pending`/`processing`,
which only exist transiently during the synchronous call.

## 6. Admin capabilities

### API key rotation (`/admin/api-keys`)

Problem this solves: the three LLM provider keys live in `ai-service/.env`,
invisible to Node and un-rotatable without a redeploy. `ApiKeySetting` is a
Mongo-backed override:

- `GET /admin/api-keys` → `[{provider, configured, last4, updatedAt}]` for
  all three providers. **Never returns the full key** — only
  `value.slice(-4)`.
- `PUT /admin/api-keys/:provider` → upserts a new value. Response is the
  same masked shape; the raw value is never logged anywhere (grep-checked:
  no key literal appears in `src/`, see `plan.md` Phase 7.13).
- `apiKeys.getRaw(provider)` — the one function that returns the full
  value — exists **only** for internal use. It has exactly one caller in
  the whole codebase: `aiServiceClient.js`. If you ever see a second
  `require('../services/apiKeys')` importing `getRaw` from a route file,
  that's a regression — fix it the same way you'd fix a security bug,
  because it is one.
- **Storage is plaintext**, deliberately — same trust level `.env` already
  had. Encrypting it would need its own encryption key, which has to live
  *somewhere* (another env var), so it buys no real isolation here without
  a proper KMS, which is out of scope.

ai-service never stores this value — it stays stateless (a Phase 1
decision). Node sends the current override for whichever provider
`LLM_PROVIDER` names as `api_key_override` on every `/internal/audit` call;
ai-service uses it for that one call and falls back to its own boot-time env
key if Node sends nothing.

### Rate limiting (`middleware/rateLimit.js`)

Two limiters, both from `express-rate-limit`:

- **`generalLimiter`** — mounted globally in `app.js`, right after
  `express.json()`. Because it runs *before* any router's own
  `authenticate`, `req.user` is never set yet when it checks — in practice
  this one is **IP-scoped**, not per-user, despite the shared `keyGenerator`
  trying `req.user` first. It's the broad anti-abuse net.
- **`auditLimiter`** — mounted inside `routes/audits.js`, *after*
  `router.use(authenticate)`. This one genuinely is per-user, since
  `req.user` exists by the time it runs.
- On a 429, the body is
  `{error:{code:'rate_limited', message, retryAfterSeconds, suggestion}}` —
  same envelope shape as every other error, so the frontend doesn't need a
  special case for rate limiting.
- Limits are fixed env values (`RATE_LIMIT_MAX`, `AUDIT_RATE_LIMIT_MAX`,
  `RATE_LIMIT_WINDOW_MS`), not admin-configurable. A rate-limit number
  changes rarely; making it dynamic would cost a DB read on every single
  request to support an operation that basically never happens.

### Admin alerts (`/admin/alerts`)

When the audit pipeline hits a quota-exhausted provider failure (see §5),
`adminAlerts.raiseProviderQuotaAlert(message)` either bumps an existing
unresolved `provider_quota_exceeded` alert's `occurrenceCount`, or creates a
new one if none is open. There is **no email/SMS** — an admin checks
`GET /admin/alerts` (unresolved by default, `?resolved=true` for history)
and clears one with `PATCH /admin/alerts/:id/resolve`. No email/notification
SDK exists anywhere in this repo; adding one for a single alert type would
be over-engineering for what this project actually needs.

## 7. Error envelope convention

Every error response, from any route, is:

```json
{ "error": { "code": "not_found", "message": "Recording not found" } }
```

`errors.js` defines the hierarchy (`AppError` base + `UnauthorizedError`
401, `ConflictError` 409, `NotFoundError` 404, `ForbiddenError` 403).
Routes just `throw` one — there's no per-route try/catch; `app.js`'s final
error-handling middleware catches everything and maps `err.statusCode` /
`err.code` onto the response. This is also exactly the shape `ai-service/`
uses, so `aiServiceClient.js` can forward a distinguishable error (like
`provider_quota_exceeded`) without the frontend needing two different error
formats depending on which backend ultimately failed.

## 8. Ownership pattern — read this before adding any new resource

Every resource that belongs to a user follows the same rule: **"not found"
and "not yours" look identical from the outside.** `getOwnRecording`,
`getVisibleCategory`, `getOwnAuditJob` all return `404`, never `403`, when
the record exists but belongs to someone else — this avoids leaking
"that id exists" to a user who shouldn't know. The one exception is
built-in categories: mutating a built-in returns `403` on purpose, because
its *existence* is public knowledge (every user sees the same built-ins).

## 9. Configuration — `.env` reference

| Variable | Purpose |
|---|---|
| `PORT` | Default `4000` |
| `MONGODB_URI` | Mongo connection string (Atlas or local) |
| `JWT_SECRET` | Long random string, signs access tokens |
| `AI_SERVICE_URL` | Base URL of `ai-service` (e.g. `http://localhost:8001/api/v1`) |
| `LLM_PROVIDER` | **Must mirror `ai-service/.env`'s value** — this is how `aiServiceClient.js` knows which provider's `ApiKeySetting` to look up for the override |
| `INTERNAL_API_SECRET` | **Must exactly match `ai-service/.env`'s value** — the shared secret for the `X-Internal-Secret` header |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_BUCKET_NAME` | Recording storage |
| `ADMIN_EMAILS` | Comma-separated — see §4 |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `generalLimiter` config |
| `AUDIT_RATE_LIMIT_MAX` | `auditLimiter` config (same window as above) |

## 10. Testing conventions

`jest` + `supertest`, run with `npm test`. `maxWorkers: 1` in
`package.json` — **tests run serially because they share one live test
MongoDB** (`MONGODB_URI` or `mongodb://127.0.0.1:27017/call_auditing_test`
by default). Do not run two test invocations against the same DB at once —
they will corrupt each other's state (register/login counts, rate-limit
windows, etc.) and produce flaky, confusing failures that look like real
bugs but aren't.

Repeating conventions across almost every test file (copy these, don't
invent new ones):

- A local `registerAndLogin(email)` helper — register, log in, return
  `{ Authorization: 'Bearer <token>' }`.
- `beforeAll`: `connectDb(TEST_URI)` + `Model.syncIndexes()` for any model
  with a unique index.
- `afterEach`: `Model.deleteMany({})` for every model the test touched.
- `afterAll`: `mongoose.disconnect()`.
- Supabase Storage calls are faked by assigning `global.fetch = jest.fn(...)`
  that inspects the HTTP method and returns a canned response — see
  `recordings.test.js` for the canonical version. This fakes only the
  network boundary; `storage.js`'s real validation logic (extension, magic
  bytes, size) still runs in full.
- Calls to `ai-service` are faked with `jest.mock('../src/services/aiServiceClient')`
  (Jest auto-mocks the exported `transcribe`/`audit` functions), then
  `aiServiceClient.audit.mockResolvedValue(...)` /
  `.mockRejectedValue(...)` per test.

## 11. Adding a new route/model — checklist

1. `models/<thing>.js` — one Mongoose schema, no service-layer interface
   unless there's a genuine write-path invariant to enforce (see
   `auditInstructions.js`'s `createNewVersion` for what that looks like).
2. `services/<thing>.js` — only if there's real logic beyond a CRUD
   passthrough. Simple list/create can live directly in the route.
3. `routes/<thing>.js` — `router.use(authenticate)` (and `adminOnly` if
   admin-only) at the top; one `@openapi` JSDoc block per endpoint (feeds
   `swagger.js` → `/docs`).
4. Mount it in `app.js`, in the same `app.use(...)` block as the others.
5. `tests/<thing>.test.js` — at minimum: happy path, ownership isolation
   (another user can't see/touch it), and any 4xx the route can produce.
6. If it touches `ai-service/`, go through `aiServiceClient.js` — never add
   a second place that calls `ai-service` directly.

## Appendix: file-by-file reference

Every source file, in the order you'd read them. Test files are listed too.

### `src/` root

| File | What's in it |
|---|---|
| `app.js` | Builds the Express `app`: `express.json()`, `generalLimiter`, Swagger UI at `/docs`, mounts every router, then the 404 catch-all and the final error-handling middleware (maps `err.statusCode`/`err.code` onto the `{error:{...}}` envelope; special-cases `multer`'s file-too-large error). |
| `server.js` | Entry point — `connectDb()` → `ensureBuiltinCategories()` → `app.listen(port)`. Exits with an error if Mongo won't connect. |
| `swagger.js` | `swagger-jsdoc` config — scans `./src/routes/*.js` for `@openapi` comment blocks, serves the result at `/docs`. |
| `errors.js` | `AppError(message, statusCode=400, code='app_error')` base class + `UnauthorizedError` (401), `ConflictError` (409), `NotFoundError` (404), `ForbiddenError` (403) subclasses with sensible defaults. |

### `src/db/`

| File | What's in it |
|---|---|
| `connection.js` | `connectDb(uri)` (defaults to `MONGODB_URI`), `isConnected()` (checks `mongoose.connection.readyState === 1`), re-exports `mongoose` so tests can call `.disconnect()`. |

### `src/middleware/`

| File | What's in it |
|---|---|
| `auth.js` | `authenticate` — reads the `Bearer` token, verifies it, loads the `User` from the DB, sets `req.user`. 401 on anything wrong (missing/malformed header, bad token, user no longer exists). |
| `adminOnly.js` | `adminOnly` — 403 unless `req.user.role === 'admin'`. Must run *after* `authenticate` (needs `req.user` to already be set). |
| `rateLimit.js` | `generalLimiter` (mounted globally, effectively IP-scoped) and `auditLimiter` (mounted after `authenticate` in `routes/audits.js`, genuinely per-user). Shared `keyGenerator` and a custom 429 `handler` that adds `retryAfterSeconds` + `suggestion` to the standard error envelope. |

### `src/models/`

One Mongoose schema per file, no abstraction beyond Mongoose itself:

| File | Schema fields |
|---|---|
| `user.js` | `email` (unique, lowercase), `hashedPassword`, `role` (`user`\|`admin`, default `user`), `isActive`, `createdAt` |
| `category.js` | `name`, `isBuiltin`, `ownerId` (`null` = built-in), `createdAt` |
| `auditInstruction.js` | `categoryId`, `ownerId`, `version`, `content`, `isActive`, `createdAt` — unique index on `(categoryId, ownerId, version)` |
| `recording.js` | `ownerId`, `originalFilename`, `storageKey`, `contentType`, `sizeBytes`, `status` (`uploaded`\|`processing`\|`processed`\|`failed`), `createdAt` |
| `auditJob.js` | `recordingId`, `instructionId`, `categoryId`, `ownerId`, `status` (`pending`\|`processing`\|`completed`\|`failed`), `result` (Mixed), `errorMessage`, `createdAt`, `completedAt` |
| `usageRecord.js` | `ownerId`, `auditJobId`, `createdAt` |
| `apiKeySetting.js` | `provider` (unique: `openai`\|`gemini`\|`groq`), `value`, `updatedAt`, `updatedBy` |
| `adminAlert.js` | `type` (`provider_quota_exceeded`), `message`, `resolved`, `occurrenceCount`, `firstSeenAt`, `lastSeenAt`, `resolvedAt` |

### `src/services/`

| File | What's in it |
|---|---|
| `categories.js` | `ensureBuiltinCategories()` — idempotent startup seed of the 6 built-ins. `getVisibleCategory(id, user)` — 404 unless it's a built-in or owned by `user`. |
| `auditInstructions.js` | `createNewVersion(categoryId, ownerId, content)` — the **only** write path for instruction content. Deactivates the previous active version, inserts a new one at `version + 1`. Never mutates an existing version's content. |
| `storage.js` | All Supabase Storage REST calls (`upload`, `download`, `deleteMany`) plus `save(filename, buffer)` — validates extension, size, and real magic bytes (`MAGIC_CHECKS`) before uploading anything. `ALLOWED_EXTENSIONS`, `MAX_UPLOAD_SIZE_BYTES` live here. |
| `recordings.js` | `getOwnRecording(id, user)` — 404 unless owned. `deletePreviousDaysRecordings(ownerId)` — deletes a user's recordings from previous days (DB + storage), called after every new upload. |
| `aiServiceClient.js` | The **only** module that calls `ai-service/`. `transcribe(buffer, filename, contentType)`, `audit(transcript, instructions)` (attaches `api_key_override` when one is rotated for the active `LLM_PROVIDER`). `callInternal` adds the `X-Internal-Secret` header, enforces a 120s timeout via `AbortController`, and distinguishes a `429`/`provider_quota_exceeded` ai-service response from a generic failure. No retry logic here by design — ai-service owns the only retry policy. |
| `auditPipeline.js` | `runAuditPipeline(job, recording)` — the orchestration: `processing` → download audio → transcribe → audit → `completed` + `recordUsage`, or `failed` + (if quota-flavored) `raiseProviderQuotaAlert`. Never persists a partial result. |
| `usage.js` | `recordUsage(ownerId, auditJobId)` — written only by the pipeline. `getUsageTotal(ownerId, {from, to})` — count over an optional date range. |
| `csvExport.js` | `buildAuditJobsCsv(jobs)` — hand-written CSV (comma/quote escaping via `escapeCsvField`), no library. |
| `pdfExport.js` | `buildAuditJobsPdf(jobs)` — uses `pdfkit` (the one justified new dependency for this; hand-rolling a valid multi-row PDF isn't "a few lines"). Returns a `Buffer`. |
| `apiKeys.js` | `getMasked(provider)` (last4 + metadata only), `getRaw(provider)` (full value — **internal use only**, must never be imported by a route file), `rotate(provider, value, adminUser)` (upserts, 422 on unknown provider or empty value). `PROVIDERS = ['openai','gemini','groq']`. |
| `adminAlerts.js` | `raiseProviderQuotaAlert(message)` — finds an unresolved `provider_quota_exceeded` alert and bumps `occurrenceCount`, or creates a new one. Dedupes so one ongoing outage doesn't flood the alert list. |

### `src/routes/`

| File | Endpoints |
|---|---|
| `health.js` | `GET /health` |
| `readiness.js` | `GET /readiness` — 503 if Mongo isn't connected |
| `auth.js` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`. Also contains `syncAdminRole(user)` — the `ADMIN_EMAILS` promote-only bootstrap, called from both register and login. |
| `categories.js` | `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id` (built-ins return 403 on mutation, 404 on not-found-or-not-owned for customs) |
| `auditInstructions.js` | `POST /audit-instructions`, `GET /audit-instructions`, `GET /audit-instructions/active` |
| `recordings.js` | `POST /recordings` (multer memory upload), `GET /recordings`, `GET /recordings/:id`, `GET /recordings/:id/download` |
| `audits.js` | `POST /audits` (rate-limited, runs the pipeline synchronously), `GET /audits` (paginated/filtered/sorted), `GET /audits/export.csv`, `GET /audits/export.pdf`, `GET /audits/:id`. Export routes are registered *before* `/audits/:id` so the literal path isn't shadowed by the `:id` param. |
| `usage.js` | `GET /usage?from=&to=` |
| `admin.js` | `GET/PUT /admin/api-keys[/:provider]`, `GET /admin/alerts`, `PATCH /admin/alerts/:id/resolve`. All admin-only (`router.use(authenticate, adminOnly)`). |

### `src/utils/`

| File | What's in it |
|---|---|
| `jwt.js` | `createAccessToken(userId)` (HS256, 60min expiry), `verifyAccessToken(token)` (also checks `payload.type === 'access'`). |
| `password.js` | `hashPassword(plain)` / `verifyPassword(plain, hashed)` — `bcrypt`, 12 salt rounds. |

### `tests/`

| File | Covers |
|---|---|
| `health.test.js`, `readiness.test.js` | The two liveness/DB-check routes. |
| `user.test.js` | `User` model: duplicate email, role default/validation, password hash/verify round-trip. |
| `auth.test.js` | Register/login/`/me`, no-enumeration on login failure. |
| `adminAuth.test.js` | `ADMIN_EMAILS` promote-only bootstrap, `adminOnly` middleware directly. |
| `categories.test.js` | Built-in seeding, visibility, ownership on mutation. |
| `auditInstructions.test.js` | Versioning (`v1`/`v2`, active-version lookup), cross-category isolation. |
| `recordings.test.js` | Upload validation (type-spoofed file → 422), ownership, download byte-exactness, daily retention cleanup. |
| `auditJob.model.test.js` | Status enum validation, `instructionId` pinning to the version active at creation time. |
| `aiServiceClient.test.js` | `transcribe`/`audit` success and failure paths, the `provider_quota_exceeded` vs. generic 429 distinction, `api_key_override` attach/omit behavior. |
| `audits.test.js` | The full pipeline end to end (mocked `aiServiceClient`): completed/failed/quota-failed outcomes, duplicate-run 409, ownership, pagination/filtering, CSV/PDF export. |
| `csvExport.test.js`, `pdfExport.test.js` | The two export builders in isolation (escaping correctness; `%PDF` magic-byte check). |
| `usage.test.js` | Usage increments only on a completed run, `GET /usage` totals. |
| `admin.apiKeys.test.js` | Masked read, rotate (422s, never-logs-the-value), non-admin 403 on both routes. |
| `adminAlerts.test.js` | Dedupe/cooldown behavior of `raiseProviderQuotaAlert` directly. |
| `admin.alerts.test.js` | `GET/PATCH /admin/alerts` routes, non-admin 403, resolved/unresolved filtering. |
| `rateLimit.test.js` | Per-user scoping on `auditLimiter`, the 429 body shape (`retryAfterSeconds`, `suggestion`). |
