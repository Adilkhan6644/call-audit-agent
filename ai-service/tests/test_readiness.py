from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_readiness_ok_when_internal_secret_configured(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_secret", "some-secret")

    response = client.get("/api/v1/readiness")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readiness_returns_503_when_internal_secret_missing(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_secret", "")

    response = client.get("/api/v1/readiness")

    assert response.status_code == 503
