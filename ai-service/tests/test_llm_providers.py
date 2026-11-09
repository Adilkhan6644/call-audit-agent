import pytest

from app.core.exceptions import AppError
from app.services.llm.factory import get_llm_provider
from app.services.llm.gemini_provider import GeminiLlmProvider
from app.services.llm.grok_provider import GrokLlmProvider
from app.services.llm.mock import MockLlmProvider
from app.services.llm.openai_provider import OpenAiLlmProvider
from app.services.llm.prompt import parse_audit_json


def test_factory_returns_requested_provider_explicitly():
    assert isinstance(get_llm_provider("mock"), MockLlmProvider)
    assert isinstance(get_llm_provider("openai"), OpenAiLlmProvider)
    assert isinstance(get_llm_provider("gemini"), GeminiLlmProvider)
    assert isinstance(get_llm_provider("grok"), GrokLlmProvider)


def test_factory_rejects_unknown_provider():
    with pytest.raises(AppError):
        get_llm_provider("claude")


def test_parse_audit_json_extracts_object_wrapped_in_markdown_fences():
    text = '```json\n{"summary": "ok", "score": 8, "findings": ["a"]}\n```'
    assert parse_audit_json(text) == {"summary": "ok", "score": 8, "findings": ["a"]}


def test_parse_audit_json_raises_app_error_on_non_json():
    with pytest.raises(AppError):
        parse_audit_json("not json at all")


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_openai_provider_parses_response_into_structured_result(monkeypatch):
    payload = {"choices": [{"message": {"content": '{"summary": "Good call", "score": 9, "findings": []}'}}]}
    monkeypatch.setattr("app.services.llm.openai_provider.httpx.post", lambda *a, **k: _FakeResponse(200, payload))

    result = OpenAiLlmProvider(api_key="k", model="gpt-4o-mini").audit("transcript", "instructions")

    assert result.summary == "Good call"
    assert result.score == 9
    assert result.findings == []


def test_openai_provider_raises_app_error_on_failure(monkeypatch):
    monkeypatch.setattr("app.services.llm.openai_provider.httpx.post", lambda *a, **k: _FakeResponse(401, {}))

    with pytest.raises(AppError):
        OpenAiLlmProvider(api_key="bad", model="gpt-4o-mini").audit("t", "i")


def test_gemini_provider_parses_response_into_structured_result(monkeypatch):
    payload = {"candidates": [{"content": {"parts": [{"text": '{"summary": "Fine", "score": 7, "findings": ["late reply"]}'}]}}]}
    monkeypatch.setattr("app.services.llm.gemini_provider.httpx.post", lambda *a, **k: _FakeResponse(200, payload))

    result = GeminiLlmProvider(api_key="k", model="gemini-2.0-flash").audit("transcript", "instructions")

    assert result.summary == "Fine"
    assert result.score == 7
    assert result.findings == ["late reply"]


def test_gemini_provider_raises_app_error_on_failure(monkeypatch):
    monkeypatch.setattr("app.services.llm.gemini_provider.httpx.post", lambda *a, **k: _FakeResponse(403, {}))

    with pytest.raises(AppError):
        GeminiLlmProvider(api_key="bad", model="gemini-2.0-flash").audit("t", "i")


def test_grok_provider_parses_response_into_structured_result(monkeypatch):
    payload = {"choices": [{"message": {"content": '{"summary": "Solid", "score": 6, "findings": ["interrupted caller"]}'}}]}
    monkeypatch.setattr("app.services.llm.grok_provider.httpx.post", lambda *a, **k: _FakeResponse(200, payload))

    result = GrokLlmProvider(api_key="k", model="grok-2-latest").audit("transcript", "instructions")

    assert result.summary == "Solid"
    assert result.score == 6
    assert result.findings == ["interrupted caller"]


def test_grok_provider_raises_app_error_on_failure(monkeypatch):
    monkeypatch.setattr("app.services.llm.grok_provider.httpx.post", lambda *a, **k: _FakeResponse(500, {}))

    with pytest.raises(AppError):
        GrokLlmProvider(api_key="bad", model="grok-2-latest").audit("t", "i")
