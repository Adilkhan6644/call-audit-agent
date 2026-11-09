import httpx

from app.core.exceptions import AppError
from app.services.llm.base import StructuredAuditResult
from app.services.llm.prompt import SYSTEM_PROMPT, build_user_prompt, parse_audit_json, truncate_transcript


class GrokLlmProvider:
    """Audit scoring via xAI's Grok API (OpenAI-compatible chat completions shape)."""

    def __init__(self, api_key: str, model: str, max_input_tokens: int) -> None:
        self._api_key = api_key
        self._model = model
        self._max_input_tokens = max_input_tokens

    def audit(self, transcript: str, instructions: str) -> StructuredAuditResult:
        transcript = truncate_transcript(transcript, self._max_input_tokens)
        response = httpx.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(transcript, instructions)},
                ],
            },
            timeout=60,
        )
        if response.status_code >= 400:
            raise AppError("Grok audit request failed", status_code=502)

        content = response.json()["choices"][0]["message"]["content"]
        data = parse_audit_json(content)
        return StructuredAuditResult(
            summary=data.get("summary", ""),
            score=data.get("score", 0),
            findings=data.get("findings", []),
        )
