# server

Node.js + Express + MongoDB main backend for call-audit-agent. Owns auth, categories, versioned audit instructions, and recording metadata (audio bytes live in Supabase Storage). Calls `ai-service/` internally for STT transcription and LLM audit scoring.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
- `MONGODB_URI` — your MongoDB connection string
- `JWT_SECRET` — any long random string
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_BUCKET_NAME` — same Supabase project `ai-service` uses
- `AI_SERVICE_URL` — where `ai-service` is running
- `INTERNAL_API_SECRET` — must match `ai-service/.env`'s value exactly

## Run

```bash
npm run dev     # auto-restarts on file changes
npm start       # plain run
```

Defaults to port 4000 (override with `PORT`).

## Test

```bash
npm test
```

Needs MongoDB reachable at `MONGODB_URI`. Tests run serially (`maxWorkers: 1` in `package.json`) because they share one test database.
