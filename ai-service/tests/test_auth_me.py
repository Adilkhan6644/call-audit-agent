import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.main import app
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(User).filter(User.email.like("test-me-%@example.com")).delete()
    db.commit()
    db.close()


def _register_and_login(email: str, password: str) -> str:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    response = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )
    return response.json()["access_token"]


def test_me_with_valid_token_returns_current_user():
    token = _register_and_login("test-me-ok@example.com", "correctpass1")

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "test-me-ok@example.com"


def test_me_without_token_returns_401():
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_with_tampered_token_returns_401():
    token = _register_and_login("test-me-tamper@example.com", "correctpass1")

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}x"}
    )

    assert response.status_code == 401


def test_me_with_expired_token_returns_401():
    expired = jwt.encode(
        {"sub": "1", "exp": 0}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"}
    )

    assert response.status_code == 401


def test_me_for_nonexistent_user_returns_401_not_500():
    token = create_access_token(subject="999999")

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401
