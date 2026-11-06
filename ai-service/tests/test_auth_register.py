import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(User).filter(User.email.like("test-%@example.com")).delete()
    db.commit()
    db.close()


def test_register_success_hides_hashed_password():
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test-register@example.com", "password": "supersecret1"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "test-register@example.com"
    assert "hashed_password" not in body
    assert "password" not in body


def test_register_duplicate_email_returns_409():
    client.post(
        "/api/v1/auth/register",
        json={"email": "test-dup@example.com", "password": "supersecret1"},
    )

    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test-dup@example.com", "password": "anotherpass1"},
    )

    assert response.status_code == 409


def test_register_weak_password_returns_422():
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test-weak@example.com", "password": "short"},
    )

    assert response.status_code == 422
