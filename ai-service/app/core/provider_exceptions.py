from app.core.exceptions import AppError


class ProviderTimeoutError(AppError):
    def __init__(self, message: str = "AI provider timed out") -> None:
        super().__init__(message, status_code=504)
