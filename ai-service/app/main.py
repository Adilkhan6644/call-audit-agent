from fastapi import FastAPI

from app.api.v1 import router as api_v1_router
from app.core.config import settings
from app.core.error_handlers import register_error_handlers

app = FastAPI(
    title=settings.app_name,
    openapi_tags=[
        {"name": "Health", "description": "Service status checks"},
        {"name": "Internal", "description": "Internal AI endpoints called only by the Node main backend"},
    ],
)
register_error_handlers(app)
app.include_router(api_v1_router)
