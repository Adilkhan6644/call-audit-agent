from fastapi import APIRouter

from app.api.v1.audit_instructions import router as audit_instructions_router
from app.api.v1.auth import router as auth_router
from app.api.v1.categories import router as categories_router
from app.api.v1.health import router as health_router
from app.api.v1.readiness import router as readiness_router
from app.api.v1.recordings import router as recordings_router

router = APIRouter(prefix="/api/v1")
router.include_router(health_router)
router.include_router(readiness_router)
router.include_router(auth_router)
router.include_router(categories_router)
router.include_router(audit_instructions_router)
router.include_router(recordings_router)
