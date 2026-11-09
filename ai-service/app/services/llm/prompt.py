import json
import re

from app.core.exceptions import AppError

SYSTEM_PROMPT = (
    "You are an automated call-quality auditor. Given a call transcript and a "
    "category's audit instructions, respond with ONLY a JSON object of the "
    'exact shape {"summary": string, "score": number, "findings": string[]} '
    "and nothing else — no markdown, no code fences, no extra keys."
)


def build_user_prompt(transcript: str, instructions: str) -> str:
    return f"Audit instructions:\n{instructions}\n\nCall transcript:\n{transcript}"


def parse_audit_json(text: str) -> dict:
    """Providers sometimes wrap JSON in markdown fences or add stray text — extract the object before parsing."""
    match = re.search(r"\{.*\}", text or "", re.DOTALL)
    candidate = match.group(0) if match else text
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError) as exc:
        raise AppError(f"LLM provider returned non-JSON output: {exc}", status_code=502) from exc
