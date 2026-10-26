# ai-call-audit-platform (working name)

AI-powered call-auditing backend. FastAPI + PostgreSQL. Frontend not started yet.

## Setup

```bash
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements-dev.txt
cp .env.example .env
```

## Run

```bash
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

## Test

```bash
pytest
```
