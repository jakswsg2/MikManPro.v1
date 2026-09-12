from typing import Dict, Any, List
from django.utils import timezone
from apps.media_servers.models import MediaServer, MediaServerHealthCheck

class MediaServerMetricsService:
    """
    Exposes infrastructure metrics formatted for Prometheus scrapers
    and Smart Lounge administrative dashboards.
    """

    def generate_prometheus_metrics(self) -> str:
        """
        Generates standard OpenMetrics / Prometheus text output format.
        """
        servers = MediaServer.objects.all()
        lines = [
            "# HELP smartlounge_media_server_up Server operational state (1 = online, 0 = offline)",
            "# TYPE smartlounge_media_server_up gauge",
        ]

        for s in servers:
            is_up = 1 if (s.status == MediaServer.Status.ONLINE and s.circuit_breaker_state != MediaServer.CircuitBreakerState.OPEN) else 0
            lines.append(f'smartlounge_media_server_up{{id="{s.id}",name="{s.name}",type="{s.server_type}"}} {is_up}')

        lines.extend([
            "# HELP smartlounge_media_server_circuit_breaker_state Circuit breaker state (0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN)",
            "# TYPE smartlounge_media_server_circuit_breaker_state gauge",
        ])
        cb_map = {'CLOSED': 0, 'HALF_OPEN': 1, 'OPEN': 2}
        for s in servers:
            val = cb_map.get(s.circuit_breaker_state, 0)
            lines.append(f'smartlounge_media_server_circuit_breaker_state{{id="{s.id}",name="{s.name}"}} {val}')

        lines.extend([
            "# HELP smartlounge_media_server_latency_ms Average response time in milliseconds",
            "# TYPE smartlounge_media_server_latency_ms gauge",
        ])
        for s in servers:
            latency = s.avg_response_time_ms or 0
            lines.append(f'smartlounge_media_server_latency_ms{{id="{s.id}",name="{s.name}"}} {latency}')

        lines.extend([
            "# HELP smartlounge_media_server_consecutive_failures Number of consecutive failed requests",
            "# TYPE smartlounge_media_server_consecutive_failures counter",
        ])
        for s in servers:
            lines.append(f'smartlounge_media_server_consecutive_failures{{id="{s.id}",name="{s.name}"}} {s.consecutive_failures}')

        return "\n".join(lines) + "\n"

    def get_dashboard_summary(self) -> Dict[str, Any]:
        """
        Returns structured JSON payload for React / Admin dashboard.
        """
        servers = MediaServer.objects.all()
        total_servers = servers.count()
        healthy_count = servers.filter(health_status=MediaServer.HealthStatus.HEALTHY).count()
        degraded_count = servers.filter(health_status=MediaServer.HealthStatus.DEGRADED).count()
        unhealthy_count = servers.filter(health_status=MediaServer.HealthStatus.UNHEALTHY).count()
        open_circuit_count = servers.filter(circuit_breaker_state=MediaServer.CircuitBreakerState.OPEN).count()

        server_details = []
        for s in servers:
            server_details.append({
                'id': str(s.id),
                'name': s.name,
                'display_name': s.display_name or s.name,
                'server_type': s.server_type,
                'base_url': s.base_url,
                'is_active': s.is_active,
                'status': s.status,
                'health_status': s.health_status,
                'circuit_breaker_state': s.circuit_breaker_state,
                'avg_latency_ms': s.avg_response_time_ms,
                'p95_latency_ms': s.p95_response_time_ms,
                'priority': s.priority,
                'weight': s.weight,
                'consecutive_failures': s.consecutive_failures,
                'last_health_check': s.last_health_check.isoformat() if s.last_health_check else None,
            })

        return {
            'overview': {
                'total_servers': total_servers,
                'healthy_count': healthy_count,
                'degraded_count': degraded_count,
                'unhealthy_count': unhealthy_count,
                'open_circuit_count': open_circuit_count,
            },
            'servers': server_details,
            'timestamp': timezone.now().isoformat(),
        }
