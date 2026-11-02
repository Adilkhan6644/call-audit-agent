import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.category import Category
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(Category).filter(Category.name.like("test-%")).delete()
    db.query(User).filter(User.email.like("test-catget-%@example.com")).delete()
    db.commit()
    db.close()


def _auth_headers(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_get_own_category_returns_200():
    headers = _auth_headers("test-catget-own@example.com", "correctpass1")
    created = client.post(
        "/api/v1/categories", json={"name": "test-Owned"}, headers=headers
    ).json()

    response = client.get(f"/api/v1/categories/{created['id']}", headers=headers)

    assert response.status_code == 200


def test_get_builtin_category_returns_200():
    headers = _auth_headers("test-catget-builtin@example.com", "correctpass1")

    db = SessionLocal()
    builtin = db.query(Category).filter_by(is_builtin=True).first()
    builtin_id = builtin.id
    db.close()

    response = client.get(f"/api/v1/categories/{builtin_id}", headers=headers)

    assert response.status_code == 200


def test_get_other_users_category_returns_404():
    headers_a = _auth_headers("test-catget-a@example.com", "correctpass1")
    headers_b = _auth_headers("test-catget-b@example.com", "correctpass1")
    created = client.post(
        "/api/v1/categories", json={"name": "test-A Owned"}, headers=headers_a
    ).json()

    response = client.get(f"/api/v1/categories/{created['id']}", headers=headers_b)

    assert response.status_code == 404
