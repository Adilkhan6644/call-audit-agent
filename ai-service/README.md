# ai-call-audit-platform 

AI-powered call-auditing backend. FastAPI + PostgreSQL. Frontend not started yet.

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
