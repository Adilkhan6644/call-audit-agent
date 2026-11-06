import secrets

from fastapi import Header

from app.core.config import settings
from app.core.exceptions import UnauthorizedError


def require_internal_secret(x_internal_secret: str = Header(default="")) -> None:
    """Gate for /internal/* routes called only by the Node main backend."""
    if not settings.internal_api_secret or not secrets.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise UnauthorizedError("Invalid or missing internal secret")
