import io

import pytest
from botocore.stub import Stubber
from fastapi.testclient import TestClient

from app.core import storage
from app.db.session import SessionLocal
from app.main import app
from app.models.recording import Recording
from app.models.user import User

client = TestClient(app)

MP3_HEADER = b"ID3" + b"\x00" * 13


@pytest.fixture
def stubbed_r2(monkeypatch):
    r2_client = storage._client()
    stubber = Stubber(r2_client)
    stubber.activate()
    monkeypatch.setattr(storage, "_client", lambda: r2_client)
    yield stubber
    stubber.deactivate()


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


def test_upload_valid_file_returns_201(stubbed_r2):
    stubbed_r2.add_response("put_object", {})
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


def test_upload_oversized_file_returns_422_without_calling_r2(monkeypatch, stubbed_r2):
    monkeypatch.setattr(storage, "MAX_UPLOAD_SIZE_BYTES", 10)
    headers = _auth_headers("test-recupload-b@example.com")

    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER + b"way more than ten bytes"), "audio/mpeg")},
        headers=headers,
    )

    assert response.status_code == 422
    stubbed_r2.assert_no_pending_responses()


def test_upload_rejects_content_spoofed_as_audio():
    headers = _auth_headers("test-recupload-c@example.com")

    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(b"this is not audio at all"), "audio/mpeg")},
        headers=headers,
    )

    assert response.status_code == 422


def test_upload_requires_auth():
    response = client.post(
        "/api/v1/recordings",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER), "audio/mpeg")},
    )
    assert response.status_code == 401
