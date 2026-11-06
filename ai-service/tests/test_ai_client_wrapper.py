import time

import pytest

from app.core.provider_exceptions import ProviderTimeoutError
from app.services.ai_client_wrapper import UsageCounter, call_with_retry


def test_successful_call_returns_result_and_counts_one_attempt():
    usage = UsageCounter()

    result = call_with_retry(lambda: "ok", usage=usage)

    assert result == "ok"
    assert usage.attempts == 1


def test_simulated_timeout_raises_typed_error_after_bounded_attempts():
    usage = UsageCounter()

    def always_slow():
        time.sleep(1)

    with pytest.raises(ProviderTimeoutError):
        call_with_retry(always_slow, timeout_seconds=0.05, max_attempts=3, usage=usage)

    assert usage.attempts == 3
