"""Unit tests for app.services.rate_limiter — sliding-window rate limiter."""

import pytest

from app.services.rate_limiter import InMemoryRateLimiter, RateLimitDecision


class TestRateLimitDecision:
    """The decision dataclass behaves correctly."""

    def test_allowed_decision_fields(self):
        d = RateLimitDecision(allowed=True, remaining=5, retry_after_seconds=0)
        assert d.allowed is True
        assert d.remaining == 5
        assert d.retry_after_seconds == 0

    def test_blocked_decision_fields(self):
        d = RateLimitDecision(allowed=False, remaining=0, retry_after_seconds=30)
        assert d.allowed is False
        assert d.retry_after_seconds == 30


class TestEvaluate:
    """Core evaluate() behaviour."""

    def test_first_request_is_allowed(self):
        limiter = InMemoryRateLimiter()
        result = limiter.evaluate(key="user-1", limit=5, window_seconds=60)
        assert result.allowed is True
        assert result.remaining == 4

    def test_requests_up_to_limit_are_allowed(self):
        limiter = InMemoryRateLimiter()
        for i in range(5):
            result = limiter.evaluate(key="user-1", limit=5, window_seconds=60)
            assert result.allowed is True
            assert result.remaining == 4 - i

    def test_request_beyond_limit_is_blocked(self):
        limiter = InMemoryRateLimiter()
        for _ in range(5):
            limiter.evaluate(key="user-1", limit=5, window_seconds=60)

        result = limiter.evaluate(key="user-1", limit=5, window_seconds=60)
        assert result.allowed is False
        assert result.remaining == 0
        assert result.retry_after_seconds >= 1

    def test_different_keys_are_independent(self):
        limiter = InMemoryRateLimiter()
        # Exhaust user-1
        for _ in range(3):
            limiter.evaluate(key="user-1", limit=3, window_seconds=60)

        blocked = limiter.evaluate(key="user-1", limit=3, window_seconds=60)
        assert blocked.allowed is False

        # user-2 should still be allowed
        allowed = limiter.evaluate(key="user-2", limit=3, window_seconds=60)
        assert allowed.allowed is True

    def test_limit_of_one_blocks_second_request(self):
        limiter = InMemoryRateLimiter()
        first = limiter.evaluate(key="k", limit=1, window_seconds=60)
        assert first.allowed is True
        assert first.remaining == 0

        second = limiter.evaluate(key="k", limit=1, window_seconds=60)
        assert second.allowed is False


class TestValidation:
    """Input validation on evaluate()."""

    def test_zero_limit_raises(self):
        limiter = InMemoryRateLimiter()
        with pytest.raises(ValueError, match="limit must be positive"):
            limiter.evaluate(key="k", limit=0, window_seconds=60)

    def test_negative_limit_raises(self):
        limiter = InMemoryRateLimiter()
        with pytest.raises(ValueError, match="limit must be positive"):
            limiter.evaluate(key="k", limit=-1, window_seconds=60)

    def test_zero_window_raises(self):
        limiter = InMemoryRateLimiter()
        with pytest.raises(ValueError, match="window_seconds must be positive"):
            limiter.evaluate(key="k", limit=5, window_seconds=0)

    def test_negative_window_raises(self):
        limiter = InMemoryRateLimiter()
        with pytest.raises(ValueError, match="window_seconds must be positive"):
            limiter.evaluate(key="k", limit=5, window_seconds=-10)


class TestEviction:
    """Stale key eviction under memory pressure."""

    def test_eviction_runs_when_max_keys_exceeded(self):
        limiter = InMemoryRateLimiter(max_keys=5)
        # Create 10 keys — should trigger eviction without crashing
        for i in range(10):
            result = limiter.evaluate(key=f"user-{i}", limit=100, window_seconds=60)
            assert result.allowed is True
