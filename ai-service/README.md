# ai-service

Stateless FastAPI AI microservice for call-audit-agent. No database, no auth of its own — exposes `/internal/transcribe` (STT) and `/internal/audit` (LLM audit scoring + QA validation) over REST, gated by a shared secret header, called only by `server/` (the Node main backend).

## Setup

```bash
python -m venv ../venv       # shared venv lives at repo root
../venv/Scripts/activate     # Windows
pip install -r requirements-dev.txt
cp .env.example .env
```

## Run

```bash
uvicorn app.main:app --reload --port 8001
```

API docs: http://127.0.0.1:8001/docs

## Test

```bash
pytest
```
