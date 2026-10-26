import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.main import app
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(User).filter(User.email.like("test-refresh-%@example.com")).delete()
    db.commit()
    db.close()


def _login(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    return client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()


def test_refresh_with_valid_refresh_token_returns_new_access_token():
    tokens = _login("test-refresh-ok@example.com", "correctpass1")

    response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )

    assert response.status_code == 200
    new_access_token = response.json()["access_token"]
    db = SessionLocal()
    user = db.query(User).filter_by(email="test-refresh-ok@example.com").one()
    db.close()
    assert decode_access_token(new_access_token)["sub"] == str(user.id)


def test_refresh_rejects_an_access_token_used_as_refresh_token():
    tokens = _login("test-refresh-wrongtype@example.com", "correctpass1")

    response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["access_token"]}
    )

    assert response.status_code == 401


def test_refresh_rejects_expired_refresh_token():
    expired = jwt.encode(
        {"sub": "1", "type": "refresh", "exp": 0},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": expired})

    assert response.status_code == 401
