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
def stubbed_storage(monkeypatch):
    uploaded_bodies = {}

    def fake_upload(key, content_type, body):
        uploaded_bodies[key] = body

    def fake_download(key):
        return uploaded_bodies[key]

    monkeypatch.setattr(storage, "_upload", fake_upload)
    monkeypatch.setattr(storage, "download", fake_download)
    monkeypatch.setattr(storage, "delete_many", lambda keys: None)
    return uploaded_bodies


@pytest.fixture(autouse=True)
def cleanup():
    yield
    db = SessionLocal()
    test_user_ids = [
        row.id for row in db.query(User.id).filter(User.email.like("test-recget-%@example.com"))
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


def _upload(headers: dict, filename: str = "call.mp3", body: bytes = MP3_HEADER + b"audio") -> dict:
    return client.post(
        "/api/v1/recordings",
        files={"file": (filename, io.BytesIO(body), "audio/mpeg")},
        headers=headers,
    ).json()


def test_list_recordings_returns_only_own(stubbed_storage):
    headers_a = _auth_headers("test-recget-a@example.com")
    headers_b = _auth_headers("test-recget-b@example.com")
    _upload(headers_a)
    _upload(headers_b)

    response = client.get("/api/v1/recordings", headers=headers_a)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1


def test_get_own_recording_returns_200(stubbed_storage):
    headers = _auth_headers("test-recget-c@example.com")
    uploaded = _upload(headers)

    response = client.get(f"/api/v1/recordings/{uploaded['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == uploaded["id"]


def test_get_other_users_recording_returns_404(stubbed_storage):
    headers_a = _auth_headers("test-recget-d@example.com")
    headers_b = _auth_headers("test-recget-e@example.com")
    uploaded = _upload(headers_a)

    response = client.get(f"/api/v1/recordings/{uploaded['id']}", headers=headers_b)

    assert response.status_code == 404


def test_download_own_recording_returns_bytes(stubbed_storage):
    headers = _auth_headers("test-recget-f@example.com")
    body = MP3_HEADER + b"exact bytes to compare"
    uploaded = _upload(headers, body=body)

    response = client.get(f"/api/v1/recordings/{uploaded['id']}/download", headers=headers)

    assert response.status_code == 200
    assert response.content == body


def test_download_missing_storage_object_returns_404_not_502(stubbed_storage, monkeypatch):
    from app.core.exceptions import NotFoundError

    headers = _auth_headers("test-recget-i@example.com")
    uploaded = _upload(headers)

    def missing(key):
        raise NotFoundError("Recording file no longer exists in storage")

    monkeypatch.setattr(storage, "download", missing)

    response = client.get(f"/api/v1/recordings/{uploaded['id']}/download", headers=headers)

    assert response.status_code == 404


def test_download_other_users_recording_returns_404(stubbed_storage):
    headers_a = _auth_headers("test-recget-g@example.com")
    headers_b = _auth_headers("test-recget-h@example.com")
    uploaded = _upload(headers_a)

    response = client.get(f"/api/v1/recordings/{uploaded['id']}/download", headers=headers_b)

    assert response.status_code == 404
