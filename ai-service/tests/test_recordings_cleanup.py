import io
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core import storage
from app.db.session import SessionLocal
from app.main import app
from app.models.recording import Recording
from app.models.user import User
from app.services.recordings import delete_previous_days_recordings

client = TestClient(app)

MP3_HEADER = b"ID3" + b"\x00" * 13


@pytest.fixture
def recorded_uploads(monkeypatch):
    uploaded = []
    deleted = []
    monkeypatch.setattr(
        storage, "_upload", lambda key, content_type, body: uploaded.append(key)
    )
    monkeypatch.setattr(storage, "delete_many", lambda keys: deleted.append(keys))
    return {"uploaded": uploaded, "deleted": deleted}


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    test_user_ids = [
        row.id for row in db.query(User.id).filter(User.email.like("test-reccleanup-%@example.com"))
    ]
    db.query(Recording).filter(Recording.owner_id.in_(test_user_ids)).delete(
        synchronize_session=False
    )
    db.query(User).filter(User.id.in_(test_user_ids)).delete(synchronize_session=False)
    db.commit()
    db.close()


def _auth_headers(email: str, password: str = "correctpass1") -> dict:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_user(db, email: str) -> User:
    client.post("/api/v1/auth/register", json={"email": email, "password": "correctpass1"})
    return db.query(User).filter_by(email=email).first()


def test_delete_previous_days_recordings_removes_only_old_rows(monkeypatch):
    deleted_keys = []
    monkeypatch.setattr(storage, "delete_many", lambda keys: deleted_keys.append(keys))

    db = SessionLocal()
    user = _make_user(db, "test-reccleanup-a@example.com")

    yesterday = Recording(
        owner_id=user.id,
        original_filename="old.mp3",
        storage_key="test-old-key.mp3",
        content_type="audio/mpeg",
        size_bytes=10,
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    today = Recording(
        owner_id=user.id,
        original_filename="new.mp3",
        storage_key="test-new-key.mp3",
        content_type="audio/mpeg",
        size_bytes=10,
    )
    db.add_all([yesterday, today])
    db.commit()

    delete_previous_days_recordings(db, user.id)

    remaining = db.query(Recording).filter_by(owner_id=user.id).all()
    assert [r.storage_key for r in remaining] == ["test-new-key.mp3"]
    assert deleted_keys == [["test-old-key.mp3"]]
    db.close()


def test_delete_previous_days_recordings_never_touches_other_users(monkeypatch):
    deleted_keys = []
    monkeypatch.setattr(storage, "delete_many", lambda keys: deleted_keys.append(keys))

    db = SessionLocal()
    user_a = _make_user(db, "test-reccleanup-b@example.com")
    user_b = _make_user(db, "test-reccleanup-c@example.com")

    other_users_old = Recording(
        owner_id=user_b.id,
        original_filename="old.mp3",
        storage_key="test-other-old-key.mp3",
        content_type="audio/mpeg",
        size_bytes=10,
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db.add(other_users_old)
    db.commit()

    delete_previous_days_recordings(db, user_a.id)

    assert deleted_keys == []
    assert db.query(Recording).filter_by(owner_id=user_b.id).count() == 1
    db.close()


def test_upload_triggers_cleanup_of_own_previous_day_recordings(recorded_uploads):
    db = SessionLocal()
    user = _make_user(db, "test-reccleanup-d@example.com")
    user_id = user.id
    stale = Recording(
        owner_id=user_id,
        original_filename="old.mp3",
        storage_key="test-stale-key.mp3",
        content_type="audio/mpeg",
        size_bytes=10,
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db.add(stale)
    db.commit()
    db.close()

    headers = _auth_headers("test-reccleanup-d@example.com")
    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER + b"audio data"), "audio/mpeg")},
        headers=headers,
    )

    assert response.status_code == 201
    assert recorded_uploads["deleted"] == [["test-stale-key.mp3"]]

    db = SessionLocal()
    remaining_keys = [
        r.storage_key for r in db.query(Recording).filter_by(owner_id=user_id).all()
    ]
    assert "test-stale-key.mp3" not in remaining_keys
    db.close()
