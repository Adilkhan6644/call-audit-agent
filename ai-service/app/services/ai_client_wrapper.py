from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Callable, TypeVar

from app.core.provider_exceptions import ProviderTimeoutError

T = TypeVar("T")


class UsageCounter:
    def __init__(self) -> None:
        self.attempts = 0

    def increment(self) -> None:
        self.attempts += 1


def call_with_retry(
    fn: Callable[..., T],
    *args,
    timeout_seconds: float = 10.0,
    max_attempts: int = 3,
    usage: UsageCounter | None = None,
    **kwargs,
) -> T:
    """Run fn under a bounded timeout, retrying up to max_attempts total attempts.

    ponytail: thread-based timeout (stdlib only, no new dependency); a timed-out
    call's thread keeps running in the background since Python can't kill a thread.
    Fine for the low-volume synchronous pipeline this backs — switch to a
    subprocess-based timeout if a provider call can leak unbounded resources.
    """
    last_timeout: Exception | None = None
    for _ in range(max_attempts):
        if usage is not None:
            usage.increment()
        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(fn, *args, **kwargs)
        try:
            result = future.result(timeout=timeout_seconds)
        except FutureTimeoutError as exc:
            last_timeout = exc
            executor.shutdown(wait=False)
            continue
        executor.shutdown(wait=False)
        return result

    raise ProviderTimeoutError(f"AI provider timed out after {max_attempts} attempts") from last_timeout
