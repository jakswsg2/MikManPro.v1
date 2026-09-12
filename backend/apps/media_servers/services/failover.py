import logging
from typing import Optional, List, Callable, Any
from apps.media_servers.models import MediaServer
from apps.media_servers.services.circuit_breaker import CircuitBreakerService
from apps.media_servers.services.load_balancer import MediaServerLoadBalancerService

logger = logging.getLogger(__name__)

class FailoverExhaustedError(Exception):
    """Raised when all primary and fallback servers have failed."""
    pass

class MediaServerFailoverService:
    """
    Automated Failover & Fallback Management.
    When an active server suffers connection dropouts or trips circuit breaker:
    1. Check if configured with an explicit fallback_server.
    2. If fallback_server is available and healthy, routes to it.
    3. Otherwise queries the Load Balancer for the next best healthy server in the pool.
    4. Logs failover incidents and notifies monitoring metrics.
    """

    def __init__(self):
        self.circuit_breaker = CircuitBreakerService()
        self.load_balancer = MediaServerLoadBalancerService()

    def get_fallback_server(self, failed_server: MediaServer) -> Optional[MediaServer]:
        """
        Determines the designated fallback server for a failing server.
        """
        # Option 1: Explicit direct fallback
        if failed_server.fallback_server:
            direct = failed_server.fallback_server
            if direct.is_active and not direct.maintenance_mode and self.circuit_breaker.can_execute(direct):
                logger.info(f"Direct fallback found: {direct.name} for failed server {failed_server.name}")
                return direct

        # Option 2: Best alternate server in the pool
        candidates = self.load_balancer.get_candidate_servers(tenant_id=str(failed_server.tenant_id) if failed_server.tenant_id else None)
        alternatives = [s for s in candidates if s.id != failed_server.id]

        if alternatives:
            # Score and pick highest
            scored = [(s, self.load_balancer.calculate_score(s)) for s in alternatives]
            scored.sort(key=lambda x: x[1], reverse=True)
            fallback = scored[0][0]
            logger.info(f"Pool fallback selected: {fallback.name} for failed server {failed_server.name}")
            return fallback

        logger.error(f"Failover exhausted: No fallback available for {failed_server.name}")
        return None

    def execute_with_failover(self, server: MediaServer, operation: Callable[[MediaServer], Any]) -> Any:
        """
        Executes an operation against a media server, automatically falling back
        to secondary servers if a failure occurs.
        """
        servers_to_try = [server]
        attempted_ids = set()

        while servers_to_try:
            current = servers_to_try.pop(0)
            attempted_ids.add(current.id)

            if not self.circuit_breaker.can_execute(current):
                logger.warning(f"Server {current.name} circuit breaker is OPEN, trying fallback...")
                next_fallback = self.get_fallback_server(current)
                if next_fallback and next_fallback.id not in attempted_ids:
                    servers_to_try.append(next_fallback)
                continue

            try:
                result = operation(current)
                self.circuit_breaker.record_success(current)
                return result
            except Exception as e:
                logger.warning(f"Operation failed on {current.name}: {e}. Tripping circuit breaker and evaluating failover...")
                self.circuit_breaker.record_failure(current, str(e))
                next_fallback = self.get_fallback_server(current)
                if next_fallback and next_fallback.id not in attempted_ids:
                    servers_to_try.append(next_fallback)

        raise FailoverExhaustedError(f"All candidate media servers failed for requested operation.")
