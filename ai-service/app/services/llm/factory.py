from app.core.config import settings
from app.core.exceptions import AppError
from app.services.llm.base import LlmProvider
from app.services.llm.gemini_provider import GeminiLlmProvider
from app.services.llm.grok_provider import GrokLlmProvider
from app.services.llm.mock import MockLlmProvider
from app.services.llm.openai_provider import OpenAiLlmProvider

PROVIDERS = ("mock", "openai", "gemini", "grok")


def get_llm_provider(name: str | None = None) -> LlmProvider:
    """Explicit provider choice — defaults to settings.llm_provider."""
    provider = name or settings.llm_provider

    if provider == "mock":
        return MockLlmProvider()
    if provider == "openai":
        return OpenAiLlmProvider(settings.openai_api_key, settings.openai_model)
    if provider == "gemini":
        return GeminiLlmProvider(settings.gemini_api_key, settings.gemini_model)
    if provider == "grok":
        return GrokLlmProvider(settings.grok_api_key, settings.grok_model, settings.grok_max_input_tokens)

    raise AppError(f"Unknown LLM provider: {provider!r}. Must be one of {PROVIDERS}", status_code=500)
