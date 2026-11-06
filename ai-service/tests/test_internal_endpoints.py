import io

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.provider_exceptions import ProviderTimeoutError
from app.main import app
from app.services.llm.base import StructuredAuditResult
from app.services.stt.base import TranscriptResult, TranscriptSegment

client = TestClient(app)

MP3_HEADER = b"ID3" + b"\x00" * 13


@pytest.fixture(autouse=True)
def set_secret(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_secret", "test-shared-secret")


def _headers():
    return {"X-Internal-Secret": "test-shared-secret"}


class _FakeSttProvider:
    def transcribe(self, file_path):
        return TranscriptResult(
            text="hello",
            language="en",
            duration_seconds=1.0,
            segments=[TranscriptSegment(speaker="Speaker 1", text="hello", start=0.0, end=1.0)],
        )


class _TimeoutSttProvider:
    def transcribe(self, file_path):
        raise ProviderTimeoutError("provider timed out")


def test_transcribe_requires_internal_secret(monkeypatch):
    monkeypatch.setattr("app.api.v1.internal.get_stt_provider", lambda: _FakeSttProvider())
    response = client.post(
        "/api/v1/internal/transcribe",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER), "audio/mpeg")},
    )
    assert response.status_code == 401


def test_transcribe_returns_expected_shape(monkeypatch):
    monkeypatch.setattr("app.api.v1.internal.get_stt_provider", lambda: _FakeSttProvider())
    response = client.post(
        "/api/v1/internal/transcribe",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER), "audio/mpeg")},
        headers=_headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "hello"
    assert body["segments"][0]["speaker"] == "Speaker 1"


def test_transcribe_rejects_bad_extension():
    response = client.post(
        "/api/v1/internal/transcribe",
        files={"file": ("call.exe", io.BytesIO(b"not audio"), "application/octet-stream")},
        headers=_headers(),
    )
    assert response.status_code == 422


def test_transcribe_rejects_content_spoofed_as_audio():
    response = client.post(
        "/api/v1/internal/transcribe",
        files={"file": ("call.mp3", io.BytesIO(b"not actually audio"), "audio/mpeg")},
        headers=_headers(),
    )
    assert response.status_code == 422


def test_transcribe_provider_timeout_maps_to_error(monkeypatch):
    monkeypatch.setattr("app.api.v1.internal.get_stt_provider", lambda: _TimeoutSttProvider())
    response = client.post(
        "/api/v1/internal/transcribe",
        files={"file": ("call.mp3", io.BytesIO(MP3_HEADER), "audio/mpeg")},
        headers=_headers(),
    )
    assert response.status_code == 504


class _FakeLlmProvider:
    def audit(self, transcript, instructions):
        return StructuredAuditResult(summary="ok", score=0.9, findings=["good call"])


def test_audit_requires_internal_secret():
    response = client.post("/api/v1/internal/audit", json={"transcript": "hi", "instructions": "be nice"})
    assert response.status_code == 401


def test_audit_returns_schema_valid_result(monkeypatch):
    monkeypatch.setattr("app.api.v1.internal.get_llm_provider", lambda: _FakeLlmProvider())
    response = client.post(
        "/api/v1/internal/audit",
        json={"transcript": "hi", "instructions": "be nice"},
        headers=_headers(),
    )
    assert response.status_code == 200
    assert response.json() == {"summary": "ok", "score": 0.9, "findings": ["good call"]}
