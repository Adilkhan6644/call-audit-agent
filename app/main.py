from fastapi import FastAPI

from app.api.v1 import router as api_v1_router
from app.core.config import settings
from app.core.error_handlers import register_error_handlers

app = FastAPI(
    title=settings.app_name,
    openapi_tags=[
        {"name": "Health", "description": "Service and database status checks"},
        {"name": "Authentication", "description": "Register, log in, and manage tokens"},
        {"name": "Categories", "description": "Built-in and custom call categories"},
        {
            "name": "Audit Instructions",
            "description": "Versioned grading instructions attached to a category",
        },
        {"name": "Recordings", "description": "Audio recording uploads"},
    ],
)
register_error_handlers(app)
app.include_router(api_v1_router)
