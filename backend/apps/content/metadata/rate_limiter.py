"""
Phase 15: Thread-Safe Rate Limiter & Backoff Engine
Token Bucket algorithm with HTTP 429 / Retry-After resilience and exponential backoff with jitter.
"""
import time
import threading
import random
import logging
from typing import Callable, Any, Optional

logger = logging.getLogger(__name__)


class TokenBucketRateLimiter:
    """
    Thread-safe Token Bucket Rate Limiter.
    Allows bursting up to `capacity` tokens, replenishing at `rate` tokens per second.
    """
    def __init__(
        self,
        rate: float = 40.0,
        capacity: float = 50.0,
        max_retries: int = 3,
        initial_backoff: float = 1.0,
        max_backoff: float = 30.0,
        test_mode: bool = False
    ):
        self.rate = float(rate)
        self.capacity = float(capacity)
        self.tokens = float(capacity)
        self.last_check = time.monotonic()
        self.lock = threading.Lock()
        self.max_retries = max_retries
        self.initial_backoff = initial_backoff
        self.max_backoff = max_backoff
        self.test_mode = test_mode

    def _replenish(self):
        now = time.monotonic()
        elapsed = now - self.last_check
        self.last_check = now
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)

    def acquire(self, tokens: float = 1.0, block: bool = True) -> bool:
        """
        Attempts to acquire tokens from the bucket.
        If block is True, sleeps until sufficient tokens are available.
        """
        if self.test_mode:
            return True

        with self.lock:
            while True:
                self._replenish()
                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return True

                if not block:
                    return False

                # Calculate wait time needed for next token
                needed = tokens - self.tokens
                wait_time = needed / self.rate
                time.sleep(max(0.01, min(wait_time, 2.0)))

    def execute_with_retry(
        self,
        func: Callable[..., Any],
        *args,
        retry_on_429: bool = True,
        **kwargs
    ) -> Any:
        """
        Executes a callable, applying rate limiting and handling HTTP 429
        (Too Many Requests) or network transient errors with backoff and jitter.
        """
        attempt = 0
        backoff = self.initial_backoff

        while attempt <= self.max_retries:
            self.acquire(1.0, block=True)
            try:
                result = func(*args, **kwargs)

                # Check if result is a requests.Response-like object
                status_code = getattr(result, 'status_code', None)
                if status_code == 429 and retry_on_429:
                    attempt += 1
                    if attempt > self.max_retries:
                        logger.warning("Rate limit retries exhausted on HTTP 429")
                        return result

                    # Check for Retry-After header
                    retry_after = None
                    headers = getattr(result, 'headers', {})
                    if 'Retry-After' in headers:
                        try:
                            retry_after = float(headers['Retry-After'])
                        except (ValueError, TypeError):
                            retry_after = None

                    sleep_time = retry_after if retry_after is not None else backoff
                    # Add jitter (+- 20%)
                    jitter = sleep_time * random.uniform(0.1, 0.3)
                    wait_duration = min(self.max_backoff, sleep_time + jitter)

                    logger.warning(
                        f"Rate limited (HTTP 429). Waiting {wait_duration:.2f}s (Attempt {attempt}/{self.max_retries})"
                    )
                    if not self.test_mode:
                        time.sleep(wait_duration)
                    backoff = min(self.max_backoff, backoff * 2.0)
                    continue

                return result

            except Exception as e:
                attempt += 1
                if attempt > self.max_retries:
                    raise e

                jitter = backoff * random.uniform(0.1, 0.25)
                wait_duration = min(self.max_backoff, backoff + jitter)
                logger.warning(f"Request exception '{e}'. Retrying in {wait_duration:.2f}s ({attempt}/{self.max_retries})")
                if not self.test_mode:
                    time.sleep(wait_duration)
                backoff = min(self.max_backoff, backoff * 2.0)
