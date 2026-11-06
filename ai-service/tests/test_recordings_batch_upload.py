import io

import pytest
from fastapi.testclient import TestClient

from app.core import storage
from app.db.session import SessionLocal
from app.main import app
from app.models.recording import Recording
from app.models.user import User

client = TestClient(app)

MP3_HEADER = b"ID3" + b"\x00" * 13


@pytest.fixture
def recorded_uploads(monkeypatch):
    uploaded = []
    monkeypatch.setattr(
        storage, "_upload", lambda key, content_type, body: uploaded.append(key)
    )
    monkeypatch.setattr(storage, "delete_many", lambda keys: None)
    return uploaded


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    test_user_ids = [
        row.id for row in db.query(User.id).filter(User.email.like("test-recbatch-%@example.com"))
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


def test_batch_upload_mixed_valid_and_oversized_returns_partial_success(
    monkeypatch, recorded_uploads
):
    monkeypatch.setattr(storage, "MAX_UPLOAD_SIZE_BYTES", 10)
    headers = _auth_headers("test-recbatch-a@example.com")

    response = client.post(
        "/api/v1/recordings/batch",
        files=[
            ("files", ("good.mp3", io.BytesIO(MP3_HEADER), "audio/mpeg")),
            (
                "files",
                ("bad.mp3", io.BytesIO(MP3_HEADER + b"way more than ten bytes"), "audio/mpeg"),
            ),
        ],
        headers=headers,
    )

    assert response.status_code == 201
    results = response.json()
    assert len(results) == 2

    good = next(r for r in results if r["filename"] == "good.mp3")
    bad = next(r for r in results if r["filename"] == "bad.mp3")
    assert good["success"] is True
    assert good["recording"]["status"] == "uploaded"
    assert bad["success"] is False
    assert bad["recording"] is None

    db = SessionLocal()
    user = db.query(User).filter_by(email="test-recbatch-a@example.com").first()
    persisted = db.query(Recording).filter_by(owner_id=user.id).all()
    assert len(persisted) == 1
    assert persisted[0].original_filename == "good.mp3"
    db.close()


def test_batch_upload_requires_auth():
    response = client.post(
        "/api/v1/recordings/batch",
        files=[("files", ("call.mp3", io.BytesIO(MP3_HEADER), "audio/mpeg"))],
    )
    assert response.status_code == 401
