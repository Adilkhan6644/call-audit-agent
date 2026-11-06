import pytest

from app.core.exceptions import AppError
from app.schemas.audit_result import AuditResultSchema, validate_audit_result


def test_valid_shape_passes():
    result = validate_audit_result({"summary": "ok", "score": 0.8, "findings": ["a"]})

    assert isinstance(result, AuditResultSchema)
    assert result.score == 0.8


def test_missing_field_raises():
    with pytest.raises(AppError):
        validate_audit_result({"score": 0.8})


def test_extra_field_rejected():
    with pytest.raises(AppError):
        validate_audit_result({"summary": "ok", "score": 0.8, "unexpected": "nope"})
