import io

import pytest

from app.core import storage
from app.core.exceptions import AppError

MP3_HEADER = b"ID3" + b"\x00" * 13
WAV_HEADER = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 4


@pytest.fixture
def recorded_uploads(monkeypatch):
    calls = []
    monkeypatch.setattr(
        storage, "_upload", lambda key, content_type, body: calls.append((key, content_type, body))
    )
    return calls


def test_save_uploads_and_returns_key_and_size(recorded_uploads):
    body = MP3_HEADER + b"rest of audio"

    key, size = storage.save("call.mp3", io.BytesIO(body))

    assert key.endswith(".mp3")
    assert size == len(body)
    assert recorded_uploads == [(key, "audio/mpeg", body)]


def test_save_rejects_disallowed_extension(recorded_uploads):
    with pytest.raises(AppError):
        storage.save("malware.exe", io.BytesIO(b"data"))
    assert recorded_uploads == []


def test_save_rejects_content_spoofed_as_audio(recorded_uploads):
    with pytest.raises(AppError):
        storage.save("call.mp3", io.BytesIO(b"not actually audio"))
    assert recorded_uploads == []


def test_save_generates_uuid_key_not_original_filename(recorded_uploads):
    key, _ = storage.save("../../etc/passwd.wav", io.BytesIO(WAV_HEADER))

    assert "passwd" not in key
    assert ".." not in key


def test_save_rejects_file_exceeding_max_size(monkeypatch, recorded_uploads):
    monkeypatch.setattr(storage, "MAX_UPLOAD_SIZE_BYTES", 10)

    with pytest.raises(AppError):
        storage.save("call.mp3", io.BytesIO(MP3_HEADER + b"way more than ten bytes"))
    assert recorded_uploads == []


def test_upload_failure_raises_app_error(monkeypatch):
    class _FakeResponse:
        status_code = 400

    monkeypatch.setattr(storage.httpx, "post", lambda *a, **k: _FakeResponse())

    with pytest.raises(AppError):
        storage.save("call.mp3", io.BytesIO(MP3_HEADER))
