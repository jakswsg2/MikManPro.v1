import time
import logging
import requests
from typing import Dict, Any, Optional
from django.utils import timezone
from apps.media_servers.models import MediaServer, MediaServerHealthCheck
from apps.media_servers.services.circuit_breaker import CircuitBreakerService

logger = logging.getLogger(__name__)

class MediaServerHealthMonitorService:
    """
    Periodic background health monitoring service (60s cycle).
    Performs latency measurement, active session metrics extraction,
    records MediaServerHealthCheck, updates rolling averages and p95,
    and feeds outcomes into the CircuitBreakerService.
    """

    def __init__(self):
        self.circuit_breaker = CircuitBreakerService()

    def check_server_health(self, media_server: MediaServer) -> Dict[str, Any]:
        """
        Executes a targeted health probe against the media server.
        """
        endpoint = '/System/Info/Public'
        url = f"{media_server.base_url}{endpoint}"
        start_time = time.perf_counter()

        status_code = None
        error_msg = None
        response_time_ms = 0
        server_version = None
        active_sessions = 0
        active_transcodes = 0

        try:
            timeout = min(media_server.api_timeout_seconds, 10)
            headers = {
                'X-Emby-Token': media_server.api_key,
                'User-Agent': 'SmartLounge-HealthCheck/1.0'
            }
            resp = requests.get(url, headers=headers, timeout=timeout)
            status_code = resp.status_code
            elapsed = (time.perf_counter() - start_time) * 1000
            response_time_ms = int(elapsed)

            if resp.status_code == 200:
                data = resp.json()
                server_version = data.get('Version', media_server.server_version)

                # Determine health grading
                if response_time_ms < 500:
                    health_status = MediaServerHealthCheck.Status.HEALTHY
                elif response_time_ms < 2000:
                    health_status = MediaServerHealthCheck.Status.DEGRADED
                else:
                    health_status = MediaServerHealthCheck.Status.DEGRADED

                # Try fetching active sessions count
                try:
                    sess_resp = requests.get(f"{media_server.base_url}/Sessions", headers=headers, timeout=5)
                    if sess_resp.status_code == 200:
                        sess_data = sess_resp.json()
                        active_sessions = len(sess_data)
                        for s in sess_data:
                            if s.get('TranscodingInfo'):
                                active_transcodes += 1
                except Exception:
                    pass

                self.circuit_breaker.record_success(media_server)
            else:
                health_status = MediaServerHealthCheck.Status.UNHEALTHY
                error_msg = f"HTTP {status_code}: {resp.text[:100]}"
                self.circuit_breaker.record_failure(media_server, error_msg)

        except requests.Timeout:
            elapsed = (time.perf_counter() - start_time) * 1000
            response_time_ms = int(elapsed)
            health_status = MediaServerHealthCheck.Status.TIMEOUT
            error_msg = "Connection timed out"
            self.circuit_breaker.record_failure(media_server, error_msg)
        except Exception as e:
            elapsed = (time.perf_counter() - start_time) * 1000
            response_time_ms = int(elapsed)
            health_status = MediaServerHealthCheck.Status.UNHEALTHY
            error_msg = str(e)
            self.circuit_breaker.record_failure(media_server, error_msg)

        now = timezone.now()
        media_server.last_health_check = now
        if status_code == 200:
            media_server.last_ping_at = now
            if server_version:
                media_server.server_version = server_version

        # Record check history
        check_record = MediaServerHealthCheck.objects.create(
            media_server=media_server,
            tenant=media_server.tenant,
            checked_at=now,
            status=health_status,
            response_time_ms=response_time_ms,
            endpoint=endpoint,
            http_status_code=status_code,
            error_message=error_msg,
            server_version=server_version,
            active_sessions=active_sessions,
            active_transcodes=active_transcodes
        )

        # Update running averages & p95 on MediaServer
        self._update_latency_aggregates(media_server)

        return {
            'check_id': str(check_record.id),
            'server_id': str(media_server.id),
            'server_name': media_server.name,
            'status': health_status,
            'response_time_ms': response_time_ms,
            'active_sessions': active_sessions,
            'active_transcodes': active_transcodes,
            'circuit_breaker_state': media_server.circuit_breaker_state,
        }

    def _update_latency_aggregates(self, media_server: MediaServer):
        """Calculates avg_response_time_ms and p95_response_time_ms across recent checks."""
        recent_checks = list(
            MediaServerHealthCheck.objects.filter(
                media_server=media_server,
                status__in=[MediaServerHealthCheck.Status.HEALTHY, MediaServerHealthCheck.Status.DEGRADED]
            ).order_by('-checked_at')[:50].values_list('response_time_ms', flat=True)
        )
        if recent_checks:
            avg_val = int(sum(recent_checks) / len(recent_checks))
            sorted_checks = sorted(recent_checks)
            p95_idx = int(len(sorted_checks) * 0.95)
            p95_val = sorted_checks[min(p95_idx, len(sorted_checks) - 1)]

            media_server.avg_response_time_ms = avg_val
            media_server.p95_response_time_ms = p95_val
            media_server.save(update_fields=['last_health_check', 'last_ping_at', 'avg_response_time_ms', 'p95_response_time_ms', 'server_version'])
        else:
            media_server.save(update_fields=['last_health_check', 'last_ping_at', 'server_version'])

    def check_all_servers(self, tenant_id: Optional[str] = None):
        """Monitors all active media servers across tenants."""
        qs = MediaServer.objects.filter(is_active=True)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        results = []
        for server in qs:
            try:
                res = self.check_server_health(server)
                results.append(res)
            except Exception as e:
                logger.error(f"Error checking health for server {server.name}: {e}")
        return results
