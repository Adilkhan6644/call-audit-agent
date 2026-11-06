from pydantic import BaseModel, ValidationError

from app.core.exceptions import AppError


class AuditResultSchema(BaseModel):
    summary: str
    score: float
    findings: list[str] = []

    model_config = {"extra": "forbid"}


def validate_audit_result(data: dict) -> AuditResultSchema:
    try:
        return AuditResultSchema(**data)
    except ValidationError as exc:
        raise AppError(f"Invalid AI provider output: {exc}", status_code=502) from exc
