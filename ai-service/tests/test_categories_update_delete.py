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
    db.query(User).filter(User.email.like("test-catud-%@example.com")).delete()
    db.commit()
    db.close()


def _auth_headers(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _builtin_id() -> int:
    db = SessionLocal()
    builtin = db.query(Category).filter_by(is_builtin=True).first()
    builtin_id = builtin.id
    db.close()
    return builtin_id


def test_update_own_category_returns_200():
    headers = _auth_headers("test-catud-own@example.com", "correctpass1")
    created = client.post(
        "/api/v1/categories", json={"name": "test-Original"}, headers=headers
    ).json()

    response = client.patch(
        f"/api/v1/categories/{created['id']}",
        json={"name": "test-Renamed"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "test-Renamed"


def test_update_other_users_category_returns_404():
    headers_a = _auth_headers("test-catud-a@example.com", "correctpass1")
    headers_b = _auth_headers("test-catud-b@example.com", "correctpass1")
    created = client.post(
        "/api/v1/categories", json={"name": "test-A Owned"}, headers=headers_a
    ).json()

    response = client.patch(
        f"/api/v1/categories/{created['id']}",
        json={"name": "test-Hacked"},
        headers=headers_b,
    )

    assert response.status_code == 404


def test_update_builtin_category_returns_403():
    headers = _auth_headers("test-catud-builtin@example.com", "correctpass1")

    response = client.patch(
        f"/api/v1/categories/{_builtin_id()}",
        json={"name": "test-Hacked Builtin"},
        headers=headers,
    )

    assert response.status_code == 403


def test_delete_own_category_returns_204():
    headers = _auth_headers("test-catud-del@example.com", "correctpass1")
    created = client.post(
        "/api/v1/categories", json={"name": "test-To Delete"}, headers=headers
    ).json()

    response = client.delete(f"/api/v1/categories/{created['id']}", headers=headers)

    assert response.status_code == 204
    assert client.get(f"/api/v1/categories/{created['id']}", headers=headers).status_code == 404


def test_delete_builtin_category_returns_403():
    headers = _auth_headers("test-catud-delbuiltin@example.com", "correctpass1")

    response = client.delete(f"/api/v1/categories/{_builtin_id()}", headers=headers)

    assert response.status_code == 403
