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


# ponytail: ~4 chars/token is a rough heuristic, not a real tokenizer — good enough
# to stay clear of a provider's context limit without adding a tokenizer dependency.
# Swap for a provider-specific tokenizer if a transcript ever gets rejected anyway.
CHARS_PER_TOKEN = 4


def truncate_transcript(transcript: str, max_tokens: int) -> str:
    """Cut a transcript down to roughly max_tokens worth of characters.

    Keeps the call's opening and closing — usually the most informative parts
    (greeting/consent, resolution/close) — and drops the middle instead of the
    tail, so a long call doesn't lose its ending to a hard cutoff.
    """
    if not transcript:
        return transcript

    max_chars = max_tokens * CHARS_PER_TOKEN
    if len(transcript) <= max_chars:
        return transcript

    half = max_chars // 2
    omitted = len(transcript) - max_chars
    return (
        f"{transcript[:half]}\n\n"
        f"[...{omitted} characters omitted from the middle of this transcript "
        "to fit the model's context window...]\n\n"
        f"{transcript[-half:]}"
    )


def parse_audit_json(text: str) -> dict:
    """Providers sometimes wrap JSON in markdown fences or add stray text — extract the object before parsing."""
    match = re.search(r"\{.*\}", text or "", re.DOTALL)
    candidate = match.group(0) if match else text
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError) as exc:
        raise AppError(f"LLM provider returned non-JSON output: {exc}", status_code=502) from exc
