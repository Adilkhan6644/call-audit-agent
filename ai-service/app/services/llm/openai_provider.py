import httpx

from app.core.exceptions import AppError
from app.services.llm.base import StructuredAuditResult
from app.services.llm.prompt import SYSTEM_PROMPT, build_user_prompt, parse_audit_json


class OpenAiLlmProvider:
    """Audit scoring via OpenAI's chat completions API."""

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def audit(self, transcript: str, instructions: str) -> StructuredAuditResult:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(transcript, instructions)},
                ],
                "response_format": {"type": "json_object"},
            },
            timeout=60,
        )
        if response.status_code >= 400:
            raise AppError("OpenAI audit request failed", status_code=502)

        content = response.json()["choices"][0]["message"]["content"]
        data = parse_audit_json(content)
        return StructuredAuditResult(
            summary=data.get("summary", ""),
            score=data.get("score", 0),
            findings=data.get("findings", []),
        )
