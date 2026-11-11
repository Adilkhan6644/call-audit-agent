# Frontend Implementation Plan — "Audit Agent" Console

Branch: `frontend-dev`. Backend (`server/`, `ai-service/`) is unchanged on this branch. This document is planning only — no frontend code exists yet.

Sources read: `PROJECT_OVERVIEW.md`, `plan.md`, `features-plan.md`, `server/README.md`, `server/DEVELOPER_GUIDE.md`, `ai-service/app/schemas/audit_result.py`, and the route files (`server/src/routes/{audits,recordings,auditInstructions,admin}.js`). Everything below maps to the real, already-implemented Node API — nothing guessed.

`features-plan.md` Phase 8 already sketches a React frontend (Vite, plain JS, react-router, no global state lib, no UI library, localStorage bearer token, Vitest+RTL). This plan adopts that stack decision and focuses on the "AI/robotic audit" visual language the stack decision doesn't address.

## Key backend fact that shapes the whole UX

`POST /audits` is **synchronous**: ownership check → resolve active instruction → create job (`pending`) → `runAuditPipeline` flips it to `processing`, saves, downloads audio, calls ai-service transcribe, calls ai-service audit, then flips to `completed`/`failed` — all inside one HTTP request. The response IS the final state. There is no backend-pushed status stream.

However, the job document is saved with `status: 'processing'` mid-pipeline *before* the HTTP response returns. So a frontend that fires `POST /audits` and, in parallel, polls `GET /audits/:id` every ~1–1.5s will see real `pending → processing → completed|failed` transitions from the actual DB — not a faked animation. Recommended approach; zero backend changes needed. Stop polling when the original POST promise resolves.

`AuditResultSchema` (ai-service) is `{ summary: str, score: float, findings: list[str] }` — findings are **plain strings**, not structured `{text, severity}` objects. The "pass/fail/flag" finding UI has to be a presentational layer the frontend invents, not something the backend currently distinguishes (see Open Questions).

## 1. Stack

- **Framework**: React + Vite, plain JS (matches `server/`'s own "no TS for this project size" call and `features-plan.md` 8's decision).
- **Styling**: plain CSS (CSS custom properties for the theme — dark, monochrome/terminal-green or amber accent, monospace for data/numbers) + a handful of hand-written shared components. No MUI/Chakra/Tailwind — ~10–12 screens doesn't justify a component library, and the "robotic console" look is easier to hit with a few focused CSS files than by fighting a library's default look.
- **Routing**: react-router.
- **State/data-fetching**: no Redux/React Query. One `AuthContext` (current user + token) + per-page `useEffect`/local state. One exception: a tiny custom `usePoll(url, { enabled, intervalMs })` hook for the audit-run status pipeline (~20 lines, not a library).
- **Auth**: JWT bearer token in `localStorage`, attached by a central `apiClient.js` wrapper around `fetch`, centralized 401 handling (clear token, redirect to `/login`). Matches `server/`'s `Authorization: Bearer` design.
- **Test tooling**: Vitest + React Testing Library.

## 2. Information architecture — full route list

**Public**
- `/login`
- `/register`

**Authenticated — regular user** (shell with nav + "system status" strip)
- `/` — Dashboard (usage summary, recent audit activity, quick "run new audit")
- `/categories` — Category list (built-ins + own customs)
- `/categories/:id/instructions` — Versioned instruction editor/history for one category
- `/recordings` — Recording library (upload + list)
- `/audits/new` — Run an audit (pick recording + category → run)
- `/audits` — Audit history (filter/paginate/export)
- `/audits/:id` — Audit result detail (score, findings, export)
- `/usage` — Usage over time (`GET /usage?from=&to=`)
- `/profile` — current user info (`GET /auth/me`), logout

**Authenticated — admin only** (nav item hidden unless `user.role === 'admin'`; routes still guard server-side)
- `/admin` — Admin console home: system-health strip, unresolved alert count, provider key status
- `/admin/api-keys` — LLM provider key rotation (`GET/PUT /admin/api-keys[/:provider]`)
- `/admin/alerts` — Alert queue (`GET /admin/alerts`, resolve via `PATCH /admin/alerts/:id/resolve`)

No billing/subscription page — confirmed via `server/DEVELOPER_GUIDE.md` §1 ("explicitly descoped") and no `routes/billing.js` exists. Drop `features-plan.md` 8.9 entirely.

## 3. Key screens in detail

### Login / Register (`/login`, `/register`)
- Calls: `POST /auth/login`, `POST /auth/register`, then `GET /auth/me` for `role`.
- Error copy shown verbatim from the server's generic 401 message (backend deliberately avoids enumeration — don't undo that). Loading = disable submit + small inline spinner, not full-page.
- Visual: restrained "authentication terminal" framing (monospace labels like "ACCESS REQUEST" / "IDENTITY VERIFIED"), not the full robotic treatment.

### Dashboard (`/`)
- Calls: `GET /usage?from=&to=` (last 30 days), `GET /audits?pageSize=5&sort=-createdAt`, `GET /categories`.
- "System throughput" stat row (audits run, pass/flag ratio, avg score), recent-activity feed as a scrolling audit-log list, prominent "Run New Audit" CTA.
- Empty: "No audits recorded. Upload a call and run your first scan." → link to `/audits/new`.
- Loading: skeleton rows styled as "initializing..." rather than generic gray boxes.

### Categories (`/categories`)
- Calls: `GET /categories`, `POST /categories`, `PATCH/DELETE /categories/:id`.
- Built-ins render with a locked icon, no edit/delete affordance (matches 403-on-mutation backend behavior); customs get edit/delete with a confirm step before DELETE.

### Instructions (`/categories/:id/instructions`)
- Calls: `GET /audit-instructions?categoryId=`, `GET /audit-instructions/active?categoryId=`, `POST /audit-instructions`.
- No in-place editing of an existing version (matches the backend's insert-only invariant) — only "Publish New Version" (creates `version + 1`) plus a read-only chronological version history, each entry showing version number, created date, and active flag. Frame as an audit trail / change log.

### Recordings (`/recordings`)
- Calls: `POST /recordings` (multipart), `GET /recordings`, `GET /recordings/:id/download`.
- Upload: drag-drop or file picker, client-side pre-check (type: mp3/wav/m4a/ogg, size: 100MB) before hitting the network — real enforcement stays server-side. Use `XMLHttpRequest` directly for upload progress (fetch doesn't expose it); don't add a library for this.
- List: filename, size, uploaded-at, status, "Run Audit" shortcut pre-filling `/audits/new`.
- Empty: "No recordings yet — upload a call to begin."

### Run an audit (`/audits/new`) — centerpiece screen
- Flow: pick recording + category → "Run Audit" → `POST /audits`.
- **Status pipeline component**, driven by poll-while-posting: `Uploaded → Transcribing → Scoring → Complete`, rendered as a horizontal pipeline of nodes/LEDs lighting up sequentially. Backend maps: `pending`→"Queued", `processing`→ shown as "Transcribing" then "Scoring" (cosmetic interpolation — backend only has one `processing` state between them; see Open Questions), `completed`→ all green, `failed`→ the stage it died at turns red with the sanitized `errorMessage`.
- Errors: `409` (duplicate running job) → specific inline message ("A scan is already running for this recording"). `429` → show `retryAfterSeconds`/`suggestion` from the error envelope directly.
- On success: reveal the result inline below the pipeline (avoids an extra click, keeps the "watch it complete" feel).

### Audit result detail (`/audits/:id`)
- Calls: `GET /audits/:id`.
- `completed`: score as a large color-banded badge (thresholds are a frontend assumption — see Open Questions), `summary` paragraph, `findings` (list[str]) as a vertical list with a uniform flag/checkmark icon per row, category + instruction version used (traceability), export buttons (CSV/PDF, file download not inline render).
- `pending`/`processing`: show the same status-pipeline component mid-flight.
- `failed`: sanitized `errorMessage` + "Run Again" button re-posting the same recording/category.

### Audit history (`/audits`)
- Calls: `GET /audits?status=&categoryId=&page=&pageSize=&sort=`, `GET /audits/export.csv`, `GET /audits/export.pdf`.
- Table/log view: timestamp, category, color-coded status chip, score, link to detail. Filters map to query params. Export via fetch-and-blob-download helper (since `<a href>` can't carry an Authorization header).

### Usage (`/usage`)
- Calls: `GET /usage?from=&to=`.
- Date-range picker + a single total count (backend only returns a total, not a time series) — shown plainly as a "throughput" counter; no faked chart off one number.

### Admin console home (`/admin`)
- Calls: `GET /admin/alerts` (unresolved count), `GET /admin/api-keys`, optionally `GET /readiness` if `features-plan.md` 9.4 is implemented.
- Status strip of indicator lights per subsystem (DB, AI service, each provider's key presence), unresolved-alert counter linking into the alert queue.

### Admin API keys (`/admin/api-keys`)
- Calls: `GET /admin/api-keys` (`[{provider, configured, last4, updatedAt}]`), `PUT /admin/api-keys/:provider`.
- Three rows (openai/gemini/groq), configured/not + masked last4 + updatedAt, "Rotate Key" action with a password-style input, never echoed back, cleared after submit.

### Admin alerts (`/admin/alerts`)
- Calls: `GET /admin/alerts?resolved=`, `PATCH /admin/alerts/:id/resolve`.
- Default: unresolved only, each showing `type` (currently only `provider_quota_exceeded`), `message`, `occurrenceCount`, `firstSeenAt`/`lastSeenAt`, a "Resolve" button. Toggle for resolved history. Literal "ALERT" treatment (red banner, pulsing while unresolved) earned here since it reflects a real unresolved operational problem.

## 4. Shared components (audit/robotic visual language)

- `StatusPipeline` — horizontal stage indicator (Queued → Transcribing → Scoring → Complete/Failed), driven by real polled status.
- `StatusChip` — small colored badge for job status, used in dashboard/history/detail.
- `ScoreBadge` — large numeric score with a color band (threshold convention needs confirmation — see Open Questions).
- `FindingsList` — renders `findings: string[]` as a vertical list with a uniform flag/marker icon.
- `AlertBanner` — persistent banner for unresolved alerts; pulsing/red while unresolved, muted once resolved.
- `SystemStatusStrip` — row of indicator lights (DB, AI service, provider keys) for dashboard/admin-home.
- `AuditTrailList` — generic "versioned history" list (timestamp + version + actor), reused for instruction version history.
- `EmptyState`, `LoadingState` (styled as "initializing"/"scanning"), `ErrorState` (maps `{error:{code,message}}` consistently, including rate-limit `retryAfterSeconds`/`suggestion`).
- `ConfirmDialog` — used for category delete and other destructive actions.
- `FileDropzone` — recording upload.

## 5. Build phases (sequencing)

1. **Scaffold + auth + shell** — Vite project, `apiClient.js`, `AuthContext`, `ProtectedRoute`, login/register, shell layout (nav + `SystemStatusStrip` placeholder). Nothing else works without this.
2. **Categories + instructions CRUD** — depends on 1 only. Pure CRUD, lowest risk, builds `AuditTrailList`/`ConfirmDialog` reused later.
3. **Recordings upload + library** — depends on 1 only; parallelizable with phase 2.
4. **Audit run flow (`/audits/new`) + `StatusPipeline`/`ScoreBadge`/`FindingsList`** — depends on 2 and 3 (needs a category with an active instruction, and a recording). The centerpiece; build the polling hook and pipeline visual here first.
5. **Audit history + detail view + CSV/PDF export** — depends on 4 existing (needs real audit jobs).
6. **Usage page** — depends on 4/5 existing; low priority, can slot anywhere after phase 4.
7. **Admin console** — depends on phase 1 (role on `/auth/me`) only, otherwise independent; can be built in parallel with 4–6. Recommend last anyway since it's lower-traffic for the primary demo flow.

## 6. Open questions / assumptions (gaps in existing backend)

- **Findings are plain strings, not structured.** No per-finding severity/pass-fail/confidence field anywhere in `ai-service` or the Node `AuditJob.result`. Real structured findings would require a schema change in `ai-service/app/schemas/audit_result.py` plus the provider's prompt — `features-plan.md` Phase 7.0 explicitly decided *against* this for now.
- **No confidence score field exists** anywhere in the current schema, despite the style brief mentioning it. Either drop confidence-score UI or treat it as a new backend field to request.
- **Status pipeline stages are a cosmetic interpolation.** The backend only has 4 job states (`pending/processing/completed/failed`); "Transcribing" vs "Scoring" as distinct visual stages within `processing` is inferred from `auditPipeline.js`'s known internal order, not an actually-reported status. Real sub-stage progress would need a new field (e.g. `currentStep`) on `AuditJob`.
- **No usage time series** — `GET /usage` only returns a total over a date range. The Usage page is intentionally a plain counter until/unless a new aggregation endpoint is added.
- **No readiness check for ai-service from Node yet** — `features-plan.md` 9.4 (composite readiness pinging `ai-service`'s `/health`) is marked "optional, DECISION NEEDED" and not confirmed built. The admin `SystemStatusStrip`'s "AI service reachable" light depends on it; recommend building 9.4 (one file, ~10 lines) since the frontend genuinely wants it.
- **Admin role has no self-service UI by design** (`ADMIN_EMAILS` env + promote-only bootstrap) — confirmed intentional in `DEVELOPER_GUIDE.md` §4, so no "manage admins" screen is planned.
- **Score thresholds/color bands for `ScoreBadge`** are a frontend-invented convention (e.g. red <60, amber 60–80, green >80) since no pass/fail cutoff exists server-side — confirm with the product owner, since "good score" may be category-dependent (collections vs. sales may have different norms).
- **Billing/Stripe confirmed out of scope** — no route exists in `server/`, matches `PROJECT_OVERVIEW.md`'s explicit descope note; `features-plan.md` 8.9's billing page should not be built against this backend as it stands.

### Critical files for implementation reference
- `server/src/routes/audits.js`
- `server/src/routes/auditInstructions.js`
- `server/src/routes/admin.js`
- `server/DEVELOPER_GUIDE.md`
- `ai-service/app/schemas/audit_result.py`
