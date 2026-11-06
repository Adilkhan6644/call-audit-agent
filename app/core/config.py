from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "AuditIQ"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    jwt_refresh_expire_minutes: int = 60 * 24 * 7
    supabase_url: str = "https://your-project.supabase.co"
    supabase_service_key: str = ""
    supabase_bucket_name: str = "recordings"

    stt_provider: str = "faster_whisper"  # one of: faster_whisper, openai_whisper, deepgram
    whisper_model_size: str = "base"
    deepgram_api_key: str = ""


settings = Settings()
