# call-audit-agent

AI-powered call-auditing platform. Monorepo, three pieces:

- `ai-service/` — FastAPI AI microservice (STT transcription, LLM audit scoring, QA validation). No database.
- `server/` — Node.js + Express + MongoDB main backend (auth, categories, instructions, recordings, audits, billing).
- `client/` — React frontend. Not built yet.

`server/` is the only thing a frontend talks to. It calls `ai-service/`'s internal endpoints over REST using a shared secret.

## Prerequisites

- Python 3.11+ and a venv
- Node.js 18+
- A MongoDB instance reachable at the URI you put in `server/.env` (e.g. `mongodb://127.0.0.1:27017/call_auditing`)
- A Supabase project with a Storage bucket (for recordings)

## 1. Start MongoDB

Make sure MongoDB is running and reachable at the URI you'll put in `server/.env`. If you don't have one yet, either install it locally or create a free Atlas cluster and use its connection string.

## 2. Start `ai-service` (FastAPI)

```bash
cd ai-service
python -m venv ../venv          # shared venv lives at repo root
../venv/Scripts/activate        # Windows (use `source ../venv/bin/activate` on macOS/Linux)
pip install -r requirements-dev.txt
cp .env.example .env            # then fill in DATABASE_URL, SUPABASE_*, INTERNAL_API_SECRET, etc.
uvicorn app.main:app --reload
```

Runs on http://127.0.0.1:8000 — API docs at http://127.0.0.1:8000/docs

## 3. Start `server` (Node + Express)

In a second terminal:

```bash
cd server
npm install
cp .env.example .env            # fill in MONGODB_URI, JWT_SECRET, SUPABASE_*, and INTERNAL_API_SECRET
                                 # INTERNAL_API_SECRET must match the one in ai-service/.env exactly
npm run dev
```

Runs on http://127.0.0.1:4000 — check it came up with:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/readiness
```

## Running both together

Two terminals, one for each service, in this order: MongoDB → `ai-service` → `server`. There's no single combined start command yet (deliberately — see `plan.md` 9.1 if you're tracking the migration plan).

## Tests

```bash
# ai-service
cd ai-service
../venv/Scripts/python -m pytest

# server (needs MongoDB reachable, same as above)
cd server
npm test
```
