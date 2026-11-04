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
    db.query(User).filter(User.email.like("test-instrapi-%@example.com")).delete()
    db.commit()
    db.close()


def _auth_headers(email: str, password: str) -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _own_category(headers: dict) -> int:
    return client.post(
        "/api/v1/categories", json={"name": "test-Cat"}, headers=headers
    ).json()["id"]


def test_create_v1_then_v2_and_list_ordered_by_version():
    headers = _auth_headers("test-instrapi-a@example.com", "correctpass1")
    category_id = _own_category(headers)

    v1 = client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_id, "content": "test-v1 content"},
        headers=headers,
    ).json()
    v2 = client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_id, "content": "test-v2 content"},
        headers=headers,
    ).json()

    assert v1["version"] == 1
    assert v2["version"] == 2

    listed = client.get(
        "/api/v1/audit-instructions",
        params={"category_id": category_id},
        headers=headers,
    ).json()
    assert [item["version"] for item in listed] == [1, 2]
    assert listed[0]["content"] == "test-v1 content"


def test_v1_still_retrievable_via_list_after_v2():
    headers = _auth_headers("test-instrapi-b@example.com", "correctpass1")
    category_id = _own_category(headers)

    client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_id, "content": "test-v1 content"},
        headers=headers,
    )
    client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_id, "content": "test-v2 content"},
        headers=headers,
    )

    listed = client.get(
        "/api/v1/audit-instructions",
        params={"category_id": category_id},
        headers=headers,
    ).json()
    v1_entry = next(item for item in listed if item["version"] == 1)
    assert v1_entry["content"] == "test-v1 content"
    assert v1_entry["is_active"] is False


def test_get_active_returns_latest_version():
    headers = _auth_headers("test-instrapi-c@example.com", "correctpass1")
    category_id = _own_category(headers)

    client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_id, "content": "test-v1 content"},
        headers=headers,
    )
    client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_id, "content": "test-v2 content"},
        headers=headers,
    )

    active = client.get(
        "/api/v1/audit-instructions/active",
        params={"category_id": category_id},
        headers=headers,
    ).json()
    assert active["version"] == 2
    assert active["content"] == "test-v2 content"


def test_get_active_returns_404_when_none_exist():
    headers = _auth_headers("test-instrapi-d@example.com", "correctpass1")
    category_id = _own_category(headers)

    response = client.get(
        "/api/v1/audit-instructions/active",
        params={"category_id": category_id},
        headers=headers,
    )
    assert response.status_code == 404


def test_cannot_attach_instruction_to_other_users_category():
    headers_a = _auth_headers("test-instrapi-e@example.com", "correctpass1")
    headers_b = _auth_headers("test-instrapi-f@example.com", "correctpass1")
    category_id = _own_category(headers_a)

    response = client.post(
        "/api/v1/audit-instructions",
        json={"category_id": category_id, "content": "test-hacked content"},
        headers=headers_b,
    )
    assert response.status_code == 404
