import httpx

from app.services.llm.base import StructuredAuditResult
from app.services.llm.errors import classify_provider_failure
from app.services.llm.prompt import SYSTEM_PROMPT, build_user_prompt, parse_audit_json


class GeminiLlmProvider:
    """Audit scoring via Google's Gemini generateContent API."""

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def audit(self, transcript: str, instructions: str) -> StructuredAuditResult:
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent",
            params={"key": self._api_key},
            json={
                "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                "contents": [{"role": "user", "parts": [{"text": build_user_prompt(transcript, instructions)}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            },
            timeout=60,
        )
        if response.status_code >= 400:
            raise classify_provider_failure("Gemini", response)

        content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = parse_audit_json(content)
        return StructuredAuditResult(
            summary=data.get("summary", ""),
            score=data.get("score", 0),
            findings=data.get("findings", []),
        )
