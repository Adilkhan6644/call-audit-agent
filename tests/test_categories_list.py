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
    db.query(User).filter(User.email.like("test-catlist-%@example.com")).delete()
    db.commit()
    db.close()


def _auth_headers(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_includes_builtins_and_own_customs_only():
    headers_a = _auth_headers("test-catlist-a@example.com", "correctpass1")
    headers_b = _auth_headers("test-catlist-b@example.com", "correctpass1")

    db = SessionLocal()
    user_a = db.query(User).filter_by(email="test-catlist-a@example.com").one()
    user_b = db.query(User).filter_by(email="test-catlist-b@example.com").one()
    db.add(Category(name="test-A Custom", is_builtin=False, owner_id=user_a.id))
    db.add(Category(name="test-B Custom", is_builtin=False, owner_id=user_b.id))
    db.commit()
    db.close()

    response = client.get("/api/v1/categories", headers=headers_a)

    assert response.status_code == 200
    names = {c["name"] for c in response.json()}
    assert "Medical Billing" in names
    assert "test-A Custom" in names
    assert "test-B Custom" not in names


def test_list_requires_authentication():
    response = client.get("/api/v1/categories")

    assert response.status_code == 401
