from app.core.exceptions import AppError
from app.core.provider_exceptions import ProviderQuotaExceededError

# Case-insensitive substring markers for "this 429 means out of credits," not
# a plain rate limit. OpenAI/Groq (OpenAI-compatible) use error.code
# "insufficient_quota" (vs. "rate_limit_exceeded" for a plain limit); Gemini
# uses error.status "RESOURCE_EXHAUSTED" and sometimes mentions billing.
# NOTE: provider error-body shapes drift — re-verify against live docs/
# responses before relying on this in production.
_QUOTA_MARKERS = ("insufficient_quota", "resource_exhausted", "billing")


def classify_provider_failure(provider_name: str, response) -> AppError:
    """The one shared heuristic for "quota exhausted" vs. any other failure,
    so the three LLM providers don't each reimplement it.

    - HTTP 402 is always quota-exhausted.
    - HTTP 429 is quota-exhausted only if the body contains one of
      _QUOTA_MARKERS; otherwise it's a plain rate limit, not "credits
      ended" — that should not raise an admin alert.
    - Anything else is the existing generic failure.
    """
    if response.status_code == 402:
        return ProviderQuotaExceededError(f"{provider_name} audit request failed: quota exhausted")

    if response.status_code == 429:
        body_text = (getattr(response, "text", "") or "").lower()
        if any(marker in body_text for marker in _QUOTA_MARKERS):
            return ProviderQuotaExceededError(f"{provider_name} audit request failed: quota exhausted")

    return AppError(f"{provider_name} audit request failed", status_code=502)
