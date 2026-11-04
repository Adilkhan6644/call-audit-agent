import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.audit_instruction import AuditInstruction
from app.models.category import Category
from app.models.user import User
from app.services.audit_instructions import create_new_version

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(AuditInstruction).filter(
        AuditInstruction.content.like("test-%")
    ).delete()
    db.query(Category).filter(Category.name.like("test-%")).delete()
    db.query(User).filter(User.email.like("test-instrmodel-%@example.com")).delete()
    db.commit()
    db.close()


def test_create_new_version_marks_previous_inactive():
    db = SessionLocal()
    client.post(
        "/api/v1/auth/register",
        json={"email": "test-instrmodel-a@example.com", "password": "correctpass1"},
    )
    user = db.query(User).filter_by(email="test-instrmodel-a@example.com").first()
    category = Category(name="test-Cat", is_builtin=False, owner_id=user.id)
    db.add(category)
    db.commit()

    v1 = create_new_version(db, category.id, user.id, "test-content v1")
    v2 = create_new_version(db, category.id, user.id, "test-content v2")

    assert v1.version == 1
    assert v2.version == 2

    db.refresh(v1)
    assert v1.is_active is False
    assert v2.is_active is True

    active = (
        db.query(AuditInstruction)
        .filter_by(category_id=category.id, owner_id=user.id, is_active=True)
        .all()
    )
    assert len(active) == 1
    assert active[0].id == v2.id
    db.close()
