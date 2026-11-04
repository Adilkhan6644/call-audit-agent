from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Check if the API is running")
def health_check() -> dict:
    return {"status": "ok", "app_name": settings.app_name}
