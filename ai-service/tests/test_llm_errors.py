import pytest

from app.core.exceptions import AppError
from app.core.provider_exceptions import ProviderQuotaExceededError
from app.services.llm.errors import classify_provider_failure


class _FakeResponse:
    def __init__(self, status_code, text=""):
        self.status_code = status_code
        self.text = text


@pytest.mark.parametrize(
    ("status_code", "body_text", "expected_type"),
    [
        (402, "", ProviderQuotaExceededError),
        (429, '{"error": {"code": "insufficient_quota"}}', ProviderQuotaExceededError),
        (429, '{"error": {"status": "RESOURCE_EXHAUSTED"}}', ProviderQuotaExceededError),
        (429, '{"error": {"message": "over your billing limit"}}', ProviderQuotaExceededError),
        (429, '{"error": {"code": "rate_limit_exceeded"}}', AppError),
        (500, "internal server error", AppError),
        (401, "invalid api key", AppError),
    ],
)
def test_classify_provider_failure(status_code, body_text, expected_type):
    error = classify_provider_failure("TestProvider", _FakeResponse(status_code, body_text))
    assert isinstance(error, expected_type)


def test_classify_provider_failure_plain_rate_limit_is_not_quota():
    error = classify_provider_failure("TestProvider", _FakeResponse(429, '{"error": {"code": "rate_limit_exceeded"}}'))
    assert not isinstance(error, ProviderQuotaExceededError)
