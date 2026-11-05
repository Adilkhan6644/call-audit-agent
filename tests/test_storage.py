import io

import pytest
from botocore.stub import Stubber

from app.core import storage
from app.core.exceptions import AppError

MP3_HEADER = b"ID3" + b"\x00" * 13
WAV_HEADER = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 4


@pytest.fixture
def stubbed_client(monkeypatch):
    client = storage._client()
    stubber = Stubber(client)
    stubber.activate()
    monkeypatch.setattr(storage, "_client", lambda: client)
    yield stubber
    stubber.deactivate()


def test_save_uploads_to_r2_and_returns_key_and_size(stubbed_client):
    stubbed_client.add_response("put_object", {})
    body = MP3_HEADER + b"rest of audio"

    key, size = storage.save("call.mp3", io.BytesIO(body))

    assert key.endswith(".mp3")
    assert size == len(body)
    stubbed_client.assert_no_pending_responses()


def test_save_rejects_disallowed_extension():
    with pytest.raises(AppError):
        storage.save("malware.exe", io.BytesIO(b"data"))


def test_save_rejects_content_spoofed_as_audio():
    with pytest.raises(AppError):
        storage.save("call.mp3", io.BytesIO(b"not actually audio"))


def test_save_generates_uuid_key_not_original_filename(stubbed_client):
    stubbed_client.add_response("put_object", {})

    key, _ = storage.save("../../etc/passwd.wav", io.BytesIO(WAV_HEADER))

    assert "passwd" not in key
    assert ".." not in key


def test_save_rejects_file_exceeding_max_size(monkeypatch):
    monkeypatch.setattr(storage, "MAX_UPLOAD_SIZE_BYTES", 10)

    with pytest.raises(AppError):
        storage.save("call.mp3", io.BytesIO(MP3_HEADER + b"way more than ten bytes"))
