import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.error_handlers import register_error_handlers
from app.core.internal_auth import require_internal_secret

app = FastAPI()
register_error_handlers(app)


@app.get("/internal/ping", dependencies=[Depends(require_internal_secret)])
def ping():
    return {"ok": True}


client = TestClient(app)


@pytest.fixture(autouse=True)
def set_secret(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_secret", "test-shared-secret")


def test_missing_header_returns_401():
    response = client.get("/internal/ping")
    assert response.status_code == 401


def test_wrong_secret_returns_401():
    response = client.get("/internal/ping", headers={"X-Internal-Secret": "wrong"})
    assert response.status_code == 401


def test_correct_secret_passes():
    response = client.get("/internal/ping", headers={"X-Internal-Secret": "test-shared-secret"})
    assert response.status_code == 200


def test_unconfigured_secret_always_rejects(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_secret", "")
    response = client.get("/internal/ping", headers={"X-Internal-Secret": ""})
    assert response.status_code == 401
