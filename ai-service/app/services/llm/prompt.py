import json
import re

from app.core.exceptions import AppError

SYSTEM_PROMPT = (
    "You are an automated call-quality auditor. You will be given a category's "
    "audit instructions (the rubric to apply) and a call transcript. Score how "
    "well the agent followed that rubric, given the situation that actually "
    "happened on the call.\n\n"
    "Grounding rule: every finding must point at something the agent or "
    "customer actually said. When a finding is about something that was said, "
    "include a short exact quote from the transcript inside that finding "
    "string — copied character-for-character, not paraphrased or invented. "
    "If you cannot find a quote to support a point, do not make that point.\n\n"
    "Context rule: do not penalize the agent for things outside their control "
    "— a short call, an unavailable or rushed customer, a call that didn't "
    "reach a natural resolution. Judge how well the agent handled the "
    "situation they were actually given, not whether the call matched an "
    "idealized script. A missing action is only a weakness if it was "
    "realistically possible and would have meaningfully helped.\n\n"
    "Scoring rule: score is a number from 0 to 100. 90-100 means the agent "
    "handled the call about as well as it could have been handled given the "
    "rubric and the situation; 70-89 is solid with at most one minor missed "
    "opportunity; 50-69 is adequate but missed a clear, realistic "
    "opportunity; 25-49 has multiple missed opportunities or a notably weak "
    "approach; 0-24 means the agent handled the call badly in a way that "
    "likely hurt the outcome, or the relevant behavior essentially never "
    "happened. Base the score on the quality of what the agent did, not on "
    "how many rubric items were technically touched.\n\n"
    "If the transcript is too short, garbled, or one-sided to judge fairly, "
    "say so in the summary and score conservatively rather than guessing.\n\n"
    "Respond with ONLY a JSON object of the exact shape "
    '{"summary": string, "score": number, "findings": string[]} and nothing '
    "else — no markdown, no code fences, no extra keys."
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
