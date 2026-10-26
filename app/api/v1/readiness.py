from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.exceptions import AppError

router = APIRouter()


@router.get("/readiness")
def readiness_check(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise AppError("Database unavailable", status_code=503) from exc
    return {"status": "ready"}
