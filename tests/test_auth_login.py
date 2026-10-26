import pytest
from fastapi.testclient import TestClient

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.main import app
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(User).filter(User.email.like("test-login-%@example.com")).delete()
    db.commit()
    db.close()


def _register(email: str, password: str) -> None:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})


def test_login_success_returns_valid_token():
    _register("test-login-ok@example.com", "correctpass1")

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test-login-ok@example.com", "password": "correctpass1"},
    )

    assert response.status_code == 200
    token = response.json()["access_token"]
    db = SessionLocal()
    user = db.query(User).filter_by(email="test-login-ok@example.com").one()
    db.close()
    assert decode_access_token(token)["sub"] == str(user.id)


def test_login_wrong_password_returns_401():
    _register("test-login-wrong@example.com", "correctpass1")

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "test-login-wrong@example.com", "password": "nope"},
    )

    assert response.status_code == 401


def test_login_nonexistent_email_returns_same_401_message():
    wrong_password = client.post(
        "/api/v1/auth/login",
        data={"username": "nonexistent@example.com", "password": "whatever1"},
    )
    _register("test-login-exists@example.com", "correctpass1")
    wrong_user = client.post(
        "/api/v1/auth/login",
        data={"username": "test-login-exists@example.com", "password": "nope"},
    )

    assert wrong_password.status_code == 401
    assert wrong_user.status_code == 401
    assert wrong_password.json() == wrong_user.json()
