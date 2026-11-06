from app.core.config import settings
from app.core.exceptions import AppError
from app.services.stt.base import SttProvider
from app.services.stt.deepgram_provider import DeepgramSttProvider
from app.services.stt.faster_whisper_provider import FasterWhisperSttProvider
from app.services.stt.openai_whisper_provider import OpenAiWhisperSttProvider

PROVIDERS = ("faster_whisper", "openai_whisper", "deepgram")


def get_stt_provider(name: str | None = None) -> SttProvider:
    """Explicit provider choice (never a fallback chain) — defaults to settings.stt_provider."""
    provider = name or settings.stt_provider

    if provider == "faster_whisper":
        return FasterWhisperSttProvider(settings.whisper_model_size)
    if provider == "openai_whisper":
        return OpenAiWhisperSttProvider(settings.whisper_model_size)
    if provider == "deepgram":
        return DeepgramSttProvider(settings.deepgram_api_key)

    raise AppError(f"Unknown STT provider: {provider!r}. Must be one of {PROVIDERS}", status_code=500)
