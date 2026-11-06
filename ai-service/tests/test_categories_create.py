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
    db.query(User).filter(User.email.like("test-catcreate-%@example.com")).delete()
    db.commit()
    db.close()


def _auth_headers(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_category_sets_owner_from_current_user():
    headers = _auth_headers("test-catcreate-ok@example.com", "correctpass1")

    response = client.post(
        "/api/v1/categories", json={"name": "test-My New Category"}, headers=headers
    )

    assert response.status_code == 201
    body = response.json()
    assert body["is_builtin"] is False

    db = SessionLocal()
    user = db.query(User).filter_by(email="test-catcreate-ok@example.com").one()
    db.close()
    assert body["owner_id"] == user.id


def test_create_category_ignores_client_supplied_owner_id():
    headers = _auth_headers("test-catcreate-spoof@example.com", "correctpass1")

    response = client.post(
        "/api/v1/categories",
        json={"name": "test-Spoofed", "owner_id": 999999},
        headers=headers,
    )

    db = SessionLocal()
    user = db.query(User).filter_by(email="test-catcreate-spoof@example.com").one()
    db.close()
    assert response.json()["owner_id"] == user.id
