import logging
import datetime
from django.utils import timezone
from apps.media_servers.models import MediaServer

logger = logging.getLogger(__name__)

class CircuitBreakerError(Exception):
    """Raised when a request is attempted against an OPEN circuit breaker."""
    pass

class CircuitBreakerService:
    """
    Implements the Circuit Breaker pattern (CLOSED -> OPEN -> HALF_OPEN).
    State Transitions:
    - CLOSED -> OPEN: Triggered when consecutive_failures >= consecutive_failures_threshold (default: 3).
      Cool-down period: 60 seconds (circuit_breaker_next_attempt_at).
    - OPEN -> HALF_OPEN: When now() >= circuit_breaker_next_attempt_at, allows a single probe request.
    - HALF_OPEN -> CLOSED: When consecutive_successes >= consecutive_success_threshold (default: 2).
    - HALF_OPEN -> OPEN: On any failure during HALF_OPEN state.
    """
    DEFAULT_COOLDOWN_SECONDS = 60

    def can_execute(self, media_server: MediaServer) -> bool:
        """
        Determines whether requests can be dispatched to the media server.
        Transitions OPEN -> HALF_OPEN if the cool-down timer has elapsed.
        """
        state = media_server.circuit_breaker_state

        if state == MediaServer.CircuitBreakerState.CLOSED:
            return True

        now = timezone.now()
        if state == MediaServer.CircuitBreakerState.OPEN:
            if media_server.circuit_breaker_next_attempt_at and now >= media_server.circuit_breaker_next_attempt_at:
                logger.info(f"Cool-down elapsed for {media_server.name}. Moving Circuit Breaker to HALF_OPEN.")
                media_server.circuit_breaker_state = MediaServer.CircuitBreakerState.HALF_OPEN
                media_server.consecutive_successes = 0
                media_server.save(update_fields=['circuit_breaker_state', 'consecutive_successes'])
                return True
            return False

        if state == MediaServer.CircuitBreakerState.HALF_OPEN:
            return True

        return False

    def record_success(self, media_server: MediaServer):
        """
        Records a successful operation or health check.
        In HALF_OPEN state, transitions to CLOSED if consecutive successes reach the threshold.
        """
        media_server.consecutive_failures = 0
        media_server.consecutive_successes += 1

        if media_server.circuit_breaker_state == MediaServer.CircuitBreakerState.HALF_OPEN:
            if media_server.consecutive_successes >= media_server.consecutive_success_threshold:
                logger.info(f"Circuit Breaker for {media_server.name} restored to CLOSED (Healthy).")
                media_server.circuit_breaker_state = MediaServer.CircuitBreakerState.CLOSED
                media_server.circuit_breaker_opened_at = None
                media_server.circuit_breaker_next_attempt_at = None
                media_server.health_status = MediaServer.HealthStatus.HEALTHY
                media_server.status = MediaServer.Status.ONLINE

        media_server.save(update_fields=[
            'consecutive_failures', 'consecutive_successes', 'circuit_breaker_state',
            'circuit_breaker_opened_at', 'circuit_breaker_next_attempt_at',
            'health_status', 'status'
        ])

    def record_failure(self, media_server: MediaServer, error_message: str):
        """
        Records a failed operation or health check.
        Triggers transition to OPEN if failures exceed the threshold or if in HALF_OPEN state.
        """
        now = timezone.now()
        media_server.consecutive_failures += 1
        media_server.consecutive_successes = 0
        media_server.last_error_message = error_message
        media_server.last_error_at = now

        should_open = False

        if media_server.circuit_breaker_state == MediaServer.CircuitBreakerState.HALF_OPEN:
            # Immediate trip back to OPEN
            should_open = True
            logger.warning(f"Probe failed in HALF_OPEN for {media_server.name}. Tripping back to OPEN.")
        elif media_server.circuit_breaker_state == MediaServer.CircuitBreakerState.CLOSED:
            if media_server.consecutive_failures >= media_server.consecutive_failures_threshold:
                should_open = True
                logger.warning(f"Circuit Breaker tripped for {media_server.name} after {media_server.consecutive_failures} failures.")

        if should_open:
            media_server.circuit_breaker_state = MediaServer.CircuitBreakerState.OPEN
            media_server.circuit_breaker_opened_at = now
            media_server.circuit_breaker_next_attempt_at = now + datetime.timedelta(seconds=self.DEFAULT_COOLDOWN_SECONDS)
            media_server.health_status = MediaServer.HealthStatus.UNHEALTHY

        # Auto-disable safety if failures exceed 10 and setting enabled
        if media_server.auto_disable_on_repeated_failures and media_server.consecutive_failures >= 10:
            media_server.is_active = False
            logger.error(f"Auto-disabling {media_server.name} due to repeated failures >= 10.")

        media_server.save(update_fields=[
            'consecutive_failures', 'consecutive_successes', 'last_error_message',
            'last_error_at', 'circuit_breaker_state', 'circuit_breaker_opened_at',
            'circuit_breaker_next_attempt_at', 'health_status', 'is_active'
        ])

    def manual_reset(self, media_server: MediaServer, to_closed: bool = True):
        """Allows administrator to manually reset circuit breaker state."""
        media_server.circuit_breaker_state = MediaServer.CircuitBreakerState.CLOSED if to_closed else MediaServer.CircuitBreakerState.OPEN
        media_server.consecutive_failures = 0
        media_server.consecutive_successes = 0
        media_server.circuit_breaker_opened_at = None
        media_server.circuit_breaker_next_attempt_at = None
        if to_closed:
            media_server.health_status = MediaServer.HealthStatus.HEALTHY
        media_server.save()
