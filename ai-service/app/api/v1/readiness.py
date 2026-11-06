from fastapi import APIRouter

from app.core.config import settings
from app.core.exceptions import AppError

router = APIRouter(tags=["Health"])


@router.get("/readiness", summary="Check the service is configured to serve its internal endpoints")
def readiness_check() -> dict:
    if not settings.internal_api_secret:
        raise AppError("Service misconfigured: INTERNAL_API_SECRET not set", status_code=503)
    return {"status": "ready"}
