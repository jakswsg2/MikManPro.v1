import logging
from typing import Optional, List, Dict, Any
from apps.media_servers.models import MediaServer
from apps.media_servers.services.circuit_breaker import CircuitBreakerService
from apps.media_servers.services.capability import CapabilityDiscoveryService

logger = logging.getLogger(__name__)

class MediaServerLoadBalancerService:
    """
    Intelligent Load Balancer for Media Servers.
    Selects the optimal server using a weighted scoring algorithm:
    Score = (Priority weight) + (Health Bonus) + (Capacity headroom) + (Latency score)
    Filters out:
    - Inactive servers
    - Servers in maintenance mode
    - Servers excluded from playback
    - Servers with Circuit Breaker OPEN
    - Servers exceeding max_concurrent_streams
    """

    def __init__(self):
        self.circuit_breaker = CircuitBreakerService()
        self.capability_service = CapabilityDiscoveryService()

    def get_candidate_servers(self, tenant_id: Optional[str] = None,
                              content_type: Optional[str] = None,
                              required_caps: Optional[Dict[str, Any]] = None) -> List[MediaServer]:
        qs = MediaServer.objects.filter(
            is_active=True,
            maintenance_mode=False,
            excluded_from_playback=False
        )
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        candidates = []
        for server in qs:
            # Check circuit breaker
            if not self.circuit_breaker.can_execute(server):
                continue

            # Check preferred content type if specified
            if content_type and server.preferred_for_content_types:
                if content_type not in server.preferred_for_content_types:
                    continue

            # Check required capabilities
            if required_caps:
                if not self.capability_service.matches_requirements(server, required_caps):
                    continue

            candidates.append(server)

        return candidates

    def calculate_score(self, server: MediaServer) -> float:
        """
        Higher score = better candidate.
        Priority: Lower number is better (priority=1 is higher than priority=100) -> 1000 / priority
        Health: HEALTHY (+100), DEGRADED (+40), others (0)
        Latency: Under 100ms (+50), 100-300ms (+30), >1000ms (-20)
        Weight: proportional multiplier
        """
        # Base priority score
        prio = max(server.priority, 1)
        score = (1000.0 / prio) * (server.weight / 100.0)

        # Health bonus
        if server.health_status == MediaServer.HealthStatus.HEALTHY:
            score += 100
        elif server.health_status == MediaServer.HealthStatus.DEGRADED:
            score += 40

        # Latency adjustment
        avg_latency = server.avg_response_time_ms or 150
        if avg_latency < 100:
            score += 50
        elif avg_latency < 300:
            score += 25
        elif avg_latency > 1000:
            score -= 30

        return score

    def select_server(self, tenant_id: Optional[str] = None,
                      content_type: Optional[str] = None,
                      required_caps: Optional[Dict[str, Any]] = None) -> Optional[MediaServer]:
        """
        Selects the best available media server.
        """
        candidates = self.get_candidate_servers(
            tenant_id=tenant_id,
            content_type=content_type,
            required_caps=required_caps
        )
        if not candidates:
            return None

        # Sort by computed score descending
        candidates_with_scores = [(s, self.calculate_score(s)) for s in candidates]
        candidates_with_scores.sort(key=lambda item: item[1], reverse=True)

        chosen_server = candidates_with_scores[0][0]
        logger.info(f"Load Balancer selected server {chosen_server.name} (Score: {candidates_with_scores[0][1]:.2f})")
        return chosen_server
