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
    calls = []
    monkeypatch.setattr(
        storage, "_upload", lambda key, content_type, body: calls.append((key, content_type, body))
    )
    return calls


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    test_user_ids = [
        row.id for row in db.query(User.id).filter(User.email.like("test-recupload-%@example.com"))
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


def test_upload_valid_file_returns_201(recorded_uploads):
    headers = _auth_headers("test-recupload-a@example.com")

    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER + b"audio data"), "audio/mpeg")},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["original_filename"] == "call.mp3"
    assert body["status"] == "uploaded"
    assert "storage_key" not in body
    assert len(recorded_uploads) == 1


def test_upload_oversized_file_returns_422_without_uploading(monkeypatch, recorded_uploads):
    monkeypatch.setattr(storage, "MAX_UPLOAD_SIZE_BYTES", 10)
    headers = _auth_headers("test-recupload-b@example.com")

    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER + b"way more than ten bytes"), "audio/mpeg")},
        headers=headers,
    )

    assert response.status_code == 422
    assert recorded_uploads == []


def test_upload_rejects_content_spoofed_as_audio(recorded_uploads):
    headers = _auth_headers("test-recupload-c@example.com")

    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(b"this is not audio at all"), "audio/mpeg")},
        headers=headers,
    )

    assert response.status_code == 422
    assert recorded_uploads == []


def test_upload_requires_auth():
    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER), "audio/mpeg")},
    )
    assert response.status_code == 401
