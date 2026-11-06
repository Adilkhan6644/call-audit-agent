import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError

from app.db.session import SessionLocal
from app.main import app
from app.models.recording import Recording, RecordingStatus
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    db.query(Recording).filter(Recording.storage_key.like("test-%")).delete()
    db.query(User).filter(User.email.like("test-recmodel-%@example.com")).delete()
    db.commit()
    db.close()


def _make_user(db, email: str) -> User:
    client.post("/api/v1/auth/register", json={"email": email, "password": "correctpass1"})
    return db.query(User).filter_by(email=email).first()


def test_create_recording_defaults_to_uploaded_status():
    db = SessionLocal()
    user = _make_user(db, "test-recmodel-a@example.com")

    recording = Recording(
        owner_id=user.id,
        original_filename="call.mp3",
        storage_key="test-key-1.mp3",
        content_type="audio/mpeg",
        size_bytes=123,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)

    assert recording.status == RecordingStatus.UPLOADED

    db.close()


def test_invalid_status_rejected_at_db_level():
    db = SessionLocal()
    user = _make_user(db, "test-recmodel-b@example.com")

    with pytest.raises((IntegrityError, DataError)):
        db.execute(
            text(
                "INSERT INTO recordings "
                "(owner_id, original_filename, storage_key, content_type, size_bytes, status, created_at) "
                "VALUES (:owner_id, 'call.mp3', 'test-key-2.mp3', 'audio/mpeg', 1, 'bogus', now())"
            ),
            {"owner_id": user.id},
        )
    db.rollback()
    db.close()
