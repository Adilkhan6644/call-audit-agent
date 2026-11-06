from app.services.llm.base import StructuredAuditResult
from app.services.llm.mock import MockLlmProvider


def test_mock_returns_schema_valid_result_for_normal_input():
    result = MockLlmProvider().audit("a normal transcript", "score politeness")

    assert isinstance(result, StructuredAuditResult)
    assert isinstance(result.summary, str)
    assert isinstance(result.score, float)
    assert isinstance(result.findings, list)


def test_mock_returns_schema_valid_result_for_empty_input():
    result = MockLlmProvider().audit("", "")

    assert isinstance(result, StructuredAuditResult)
    assert isinstance(result.summary, str)


def test_mock_returns_schema_valid_result_for_malformed_input():
    result = MockLlmProvider().audit(None, 12345)  # type: ignore[arg-type]

    assert isinstance(result, StructuredAuditResult)
