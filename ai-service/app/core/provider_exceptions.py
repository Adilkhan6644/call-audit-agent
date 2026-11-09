from app.core.exceptions import AppError


class ProviderTimeoutError(AppError):
    def __init__(self, message: str = "AI provider timed out") -> None:
        super().__init__(message, status_code=504)


class ProviderQuotaExceededError(AppError):
    """The provider account is out of credits/quota — distinct from a plain
    rate limit or any other failure, because the caller should stop retrying
    and an admin should be told, rather than just seeing a generic 502."""

    def __init__(self, message: str = "AI provider quota exceeded") -> None:
        super().__init__(message, status_code=429)
