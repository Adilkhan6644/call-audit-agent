import pytest
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.user import User


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.query(User).filter(User.email.like("test-%@example.com")).delete()
        session.commit()
        session.close()


def test_insert_and_query_user(db):
    user = User(email="test-alice@example.com", hashed_password="x")
    db.add(user)
    db.commit()

    fetched = db.query(User).filter_by(email="test-alice@example.com").one()
    assert fetched.hashed_password == "x"
    assert fetched.is_active is True


def test_duplicate_email_rejected(db):
    db.add(User(email="test-bob@example.com", hashed_password="x"))
    db.commit()

    db.add(User(email="test-bob@example.com", hashed_password="y"))
    with pytest.raises(IntegrityError):
        db.commit()
