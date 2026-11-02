import pytest
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.category import Category
from app.models.user import User


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.query(Category).filter(Category.name.like("test-%")).delete()
        session.query(User).filter(User.email.like("test-%@example.com")).delete()
        session.commit()
        session.close()


def test_insert_builtin_category(db):
    category = Category(name="test-Medical Billing", is_builtin=True, owner_id=None)
    db.add(category)
    db.commit()

    fetched = db.query(Category).filter_by(name="test-Medical Billing").one()
    assert fetched.owner_id is None
    assert fetched.is_builtin is True


def test_insert_custom_category_for_owner(db):
    user = User(email="test-cat-owner@example.com", hashed_password="x")
    db.add(user)
    db.commit()

    category = Category(name="test-My Category", is_builtin=False, owner_id=user.id)
    db.add(category)
    db.commit()

    fetched = db.query(Category).filter_by(name="test-My Category").one()
    assert fetched.owner_id == user.id


def test_invalid_owner_id_rejected(db):
    db.add(Category(name="test-Bad Owner", is_builtin=False, owner_id=999999))
    with pytest.raises(IntegrityError):
        db.commit()
