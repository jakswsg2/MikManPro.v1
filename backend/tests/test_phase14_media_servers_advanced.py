import unittest
from unittest.mock import MagicMock, patch
from tests.django_mock_env import bootstrap_django_env

bootstrap_django_env()

from apps.media_servers.models import MediaServer, DiscoveredMediaServer
from apps.media_servers.services.circuit_breaker import CircuitBreakerService
from apps.media_servers.services.load_balancer import MediaServerLoadBalancerService
from apps.media_servers.services.failover import MediaServerFailoverService, FailoverExhaustedError
from apps.media_servers.services.version_checker import VersionCompatibilityService
from apps.media_servers.services.connection_pool import ConnectionPoolManager
from apps.media_servers.services.metrics import MediaServerMetricsService

class Phase14EnterpriseServicesTest(unittest.TestCase):

    def setUp(self):
        self.server = MagicMock(spec=MediaServer)
        self.server.id = '00000000-0000-0000-0000-000000000001'
        self.server.name = 'Test Jellyfin LAN'
        self.server.server_type = MediaServer.ServerType.JELLYFIN
        self.server.circuit_breaker_state = MediaServer.CircuitBreakerState.CLOSED
        self.server.consecutive_failures = 0
        self.server.consecutive_successes = 0
        self.server.consecutive_failures_threshold = 3
        self.server.consecutive_success_threshold = 2
        self.server.circuit_breaker_next_attempt_at = None
        self.server.auto_disable_on_repeated_failures = True
        self.server.priority = 10
        self.server.weight = 100
        self.server.health_status = MediaServer.HealthStatus.HEALTHY
        self.server.avg_response_time_ms = 45
        self.server.server_version = '10.8.13'
        self.server.fallback_server = None
        self.server.is_active = True
        self.server.maintenance_mode = False
        self.server.excluded_from_playback = False
        self.server.save = MagicMock()

    def test_circuit_breaker_transition_closed_to_open(self):
        cb = CircuitBreakerService()
        self.assertTrue(cb.can_execute(self.server))

        # Record 2 failures -> should still remain CLOSED
        cb.record_failure(self.server, "Network error 1")
        self.assertEqual(self.server.consecutive_failures, 1)
        self.assertEqual(self.server.circuit_breaker_state, MediaServer.CircuitBreakerState.CLOSED)

        cb.record_failure(self.server, "Network error 2")
        self.assertEqual(self.server.consecutive_failures, 2)
        self.assertEqual(self.server.circuit_breaker_state, MediaServer.CircuitBreakerState.CLOSED)

        # 3rd failure reaches threshold -> trips to OPEN
        cb.record_failure(self.server, "Network error 3")
        self.assertEqual(self.server.consecutive_failures, 3)
        self.assertEqual(self.server.circuit_breaker_state, MediaServer.CircuitBreakerState.OPEN)
        self.assertIsNotNone(self.server.circuit_breaker_next_attempt_at)

    def test_circuit_breaker_half_open_recovery(self):
        cb = CircuitBreakerService()
        self.server.circuit_breaker_state = MediaServer.CircuitBreakerState.HALF_OPEN
        self.server.consecutive_successes = 0

        # 1st success in HALF_OPEN
        cb.record_success(self.server)
        self.assertEqual(self.server.consecutive_successes, 1)
        self.assertEqual(self.server.circuit_breaker_state, MediaServer.CircuitBreakerState.HALF_OPEN)

        # 2nd success reaches threshold (2) -> recovers to CLOSED
        cb.record_success(self.server)
        self.assertEqual(self.server.circuit_breaker_state, MediaServer.CircuitBreakerState.CLOSED)
        self.assertEqual(self.server.health_status, MediaServer.HealthStatus.HEALTHY)

    def test_version_compatibility_checker(self):
        checker = VersionCompatibilityService()

        # Jellyfin recommended 10.8.13
        res = checker.check_compatibility(self.server)
        self.assertEqual(res['status'], 'COMPATIBLE')
        self.assertTrue(res['is_compatible'])

        # Incompatible old version 10.7.0
        self.server.server_version = '10.7.7'
        res_old = checker.check_compatibility(self.server)
        self.assertEqual(res_old['status'], 'INCOMPATIBLE')
        self.assertFalse(res_old['is_compatible'])

    def test_load_balancer_scoring(self):
        lb = MediaServerLoadBalancerService()
        score = lb.calculate_score(self.server)
        self.assertGreater(score, 100.0)

    def test_failover_routing(self):
        failover = MediaServerFailoverService()
        fallback_target = MagicMock(spec=MediaServer)
        fallback_target.id = '00000000-0000-0000-0000-000000000002'
        fallback_target.name = 'Fallback Emby'
        fallback_target.is_active = True
        fallback_target.maintenance_mode = False
        fallback_target.circuit_breaker_state = MediaServer.CircuitBreakerState.CLOSED

        self.server.fallback_server = fallback_target

        resolved = failover.get_fallback_server(self.server)
        self.assertEqual(resolved, fallback_target)

    def test_connection_pool_session_reuse(self):
        s1 = ConnectionPoolManager.get_session('server-1')
        s2 = ConnectionPoolManager.get_session('server-1')
        self.assertIs(s1, s2)
        ConnectionPoolManager.close_session('server-1')

    def test_prometheus_metrics_generation(self):
        metrics_svc = MediaServerMetricsService()
        with patch.object(MediaServer.objects, 'all', return_value=[self.server]):
            output = metrics_svc.generate_prometheus_metrics()
            self.assertIn('smartlounge_media_server_up', output)
            self.assertIn('smartlounge_media_server_circuit_breaker_state', output)
            self.assertIn('smartlounge_media_server_latency_ms', output)

if __name__ == '__main__':
    unittest.main()
