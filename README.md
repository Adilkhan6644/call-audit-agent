# call-audit-agent

AI-powered call-auditing platform. Monorepo:

- `ai-service/` — FastAPI AI microservice (STT transcription, LLM audit scoring, QA validation). See `ai-service/README.md`.
- `server/` — Node.js + Express + MongoDB main backend (auth, categories, recordings, audits, billing). Not built yet.
- `client/` — React frontend. Not built yet.

## Run `ai-service` locally

```bash
cd ai-service
python -m venv ../venv        # shared venv lives at repo root
../venv/Scripts/activate      # Windows
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

## Test

```bash
cd ai-service
pytest
```
