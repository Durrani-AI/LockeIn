from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    allowed: bool
    remaining: int
    retry_after_seconds: int


class InMemoryRateLimiter:
    def __init__(self, *, max_keys: int = 50_000) -> None:
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()
        self._max_keys = max_keys

    def evaluate(self, *, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        if limit <= 0:
            raise ValueError("limit must be positive")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")

        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, int(bucket[0] + window_seconds - now))
                return RateLimitDecision(allowed=False, remaining=0, retry_after_seconds=retry_after)

            bucket.append(now)
            remaining = max(0, limit - len(bucket))

            if len(self._hits) > self._max_keys:
                self._evict_stale(cutoff=cutoff)

            return RateLimitDecision(allowed=True, remaining=remaining, retry_after_seconds=0)

    def _evict_stale(self, *, cutoff: float) -> None:
        keys_to_drop: list[str] = []

        for key, bucket in self._hits.items():
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if not bucket:
                keys_to_drop.append(key)
            if len(keys_to_drop) >= 256:
                break

        for key in keys_to_drop:
            self._hits.pop(key, None)
