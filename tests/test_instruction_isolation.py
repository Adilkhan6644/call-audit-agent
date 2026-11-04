import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.audit_instruction import AuditInstruction
from app.models.category import Category
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(AuditInstruction).filter(
        AuditInstruction.content.like("test-%")
    ).delete()
    db.query(Category).filter(Category.name.like("test-%")).delete()
    db.query(User).filter(User.email.like("test-isolation-%@example.com")).delete()
    db.commit()
    db.close()


def _auth_headers(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _own_category(headers: dict, name: str) -> int:
    return client.post(
        "/api/v1/categories", json={"name": name}, headers=headers
    ).json()["id"]


def test_instructions_never_leak_across_categories():
    headers = _auth_headers("test-isolation-a@example.com", "correctpass1")
    category_a = _own_category(headers, "test-Category A")
    category_b = _own_category(headers, "test-Category B")

    client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_a, "content": "test-only for A"},
        headers=headers,
    )

    listed_b = client.get(
        "/api/v1/audit-instructions",
        params={"category_id": category_b},
        headers=headers,
    ).json()
    assert listed_b == []

    active_b = client.get(
        "/api/v1/audit-instructions/active",
        params={"category_id": category_b},
        headers=headers,
    )
    assert active_b.status_code == 404

    contents_b = [item["content"] for item in listed_b]
    assert "test-only for A" not in contents_b
