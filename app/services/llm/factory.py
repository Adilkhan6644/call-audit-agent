from app.core.config import settings
from app.core.exceptions import AppError
from app.services.llm.base import LlmProvider
from app.services.llm.mock import MockLlmProvider

PROVIDERS = ("mock",)


def get_llm_provider(name: str | None = None) -> LlmProvider:
    """Explicit provider choice — defaults to settings.llm_provider. Real providers join PROVIDERS as they're built."""
    provider = name or settings.llm_provider

    if provider == "mock":
        return MockLlmProvider()

    raise AppError(f"Unknown LLM provider: {provider!r}. Must be one of {PROVIDERS}", status_code=500)
