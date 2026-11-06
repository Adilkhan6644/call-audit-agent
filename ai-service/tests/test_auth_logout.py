import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.revoked_token import RevokedToken
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(RevokedToken).delete()
    db.query(User).filter(User.email.like("test-logout-%@example.com")).delete()
    db.commit()
    db.close()


def _login(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    return client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()


def test_logout_revokes_refresh_token():
    tokens = _login("test-logout-ok@example.com", "correctpass1")

    logout_response = client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )
    refresh_response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    assert logout_response.status_code == 204
    assert refresh_response.status_code == 401


def test_logout_with_garbage_token_is_idempotent():
    response = client.post("/api/v1/auth/logout", json={"refresh_token": "not-a-token"})

    assert response.status_code == 204
