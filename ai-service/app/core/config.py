from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "AuditIQ"

    stt_provider: str = "faster_whisper"  # one of: faster_whisper, openai_whisper, deepgram
    whisper_model_size: str = "base"
    deepgram_api_key: str = ""

    internal_api_secret: str = ""
    llm_provider: str = "mock"  # one of: mock, openai, gemini, groq
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    # llama-3.3-70b-versatile's context window on Groq is 128K tokens; leave
    # headroom for the system prompt, instructions, and the model's own output.
    groq_max_input_tokens: int = 110000


settings = Settings()
