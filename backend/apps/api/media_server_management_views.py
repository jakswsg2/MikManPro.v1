import logging
from django.utils import timezone
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.decorators import action

from apps.media_servers.models import (
    MediaServer, MediaServerHealthCheck, DiscoveredMediaServer, MediaServerCapability
)
from apps.media_servers.services import (
    LanDiscoveryService, CapabilityDiscoveryService, CircuitBreakerService,
    MediaServerHealthMonitorService, MediaServerLoadBalancerService,
    MediaServerFailoverService, VersionCompatibilityService, MediaServerMetricsService
)
from .media_server_serializers import (
    MediaServerHealthCheckSerializer, DiscoveredMediaServerSerializer,
    MediaServerCapabilitySerializer, MediaServerAdvancedDetailSerializer
)

logger = logging.getLogger(__name__)

class AdminMediaServerDiscoveryView(APIView):
    """
    POST /api/v1/admin/media-servers/discovery/scan/
    GET /api/v1/admin/media-servers/discovery/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status')
        qs = DiscoveredMediaServer.objects.all()
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = DiscoveredMediaServerSerializer(qs[:100], many=True)
        return Response(serializer.data)

    def post(self, request):
        subnet = request.data.get('subnet_prefix', '192.168.1')
        tenant_id = getattr(request.user, 'tenant_id', None)
        service = LanDiscoveryService()
        discovered = service.scan_subnet(subnet_prefix=subnet, tenant_id=tenant_id)
        return Response({
            'message': f"Scan completed for subnet {subnet}",
            'count': len(discovered),
            'discovered': discovered
        }, status=status.HTTP_200_OK)


class AdminMediaServerDiscoveryActionView(APIView):
    """
    POST /api/v1/admin/media-servers/discovery/<uuid:pk>/approve/
    POST /api/v1/admin/media-servers/discovery/<uuid:pk>/ignore/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action_name):
        try:
            discovery = DiscoveredMediaServer.objects.get(pk=pk)
        except DiscoveredMediaServer.DoesNotExist:
            return Response({'error': 'Discovered record not found'}, status=status.HTTP_404_NOT_FOUND)

        if action_name == 'approve':
            api_key = request.data.get('api_key')
            name = request.data.get('name', f"{discovery.server_type_guess} LAN ({discovery.host})")
            if not api_key:
                return Response({'error': 'api_key is required to approve and provision this server.'}, status=status.HTTP_400_BAD_REQUEST)

            server_type = MediaServer.ServerType.JELLYFIN
            if discovery.server_type_guess == DiscoveredMediaServer.ServerTypeGuess.EMBY:
                server_type = MediaServer.ServerType.EMBY
            elif discovery.server_type_guess == DiscoveredMediaServer.ServerTypeGuess.PLEX:
                server_type = MediaServer.ServerType.PLEX

            local_url = f"http://{discovery.host}:{discovery.port}"
            new_server = MediaServer.objects.create(
                tenant=discovery.tenant,
                name=name,
                server_type=server_type,
                local_url=local_url,
                server_url_internal=local_url,
                api_key=api_key,
                is_active=True,
                status=MediaServer.Status.ONLINE,
                server_version=discovery.version_guess
            )

            discovery.status = DiscoveredMediaServer.Status.APPROVED
            discovery.approved_at = timezone.now()
            discovery.approved_by = request.user
            discovery.created_media_server = new_server
            discovery.save()

            # Trigger capability discovery immediately
            try:
                cap_service = CapabilityDiscoveryService()
                cap_service.discover_and_update(new_server)
            except Exception as e:
                logger.error(f"Capability discovery after approve error: {e}")

            return Response({
                'message': 'Media server approved and provisioned successfully.',
                'server_id': str(new_server.id),
                'name': new_server.name,
            }, status=status.HTTP_201_CREATED)

        elif action_name == 'ignore':
            reason = request.data.get('reason', 'Ignored by admin')
            discovery.status = DiscoveredMediaServer.Status.IGNORED
            discovery.ignored_at = timezone.now()
            discovery.ignored_by = request.user
            discovery.ignore_reason = reason
            discovery.save()
            return Response({'message': 'Server discovery ignored.'}, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


class AdminMediaServerCircuitBreakerResetView(APIView):
    """
    POST /api/v1/admin/media-servers/<uuid:pk>/circuit-breaker/reset/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            server = MediaServer.objects.get(pk=pk)
        except MediaServer.DoesNotExist:
            return Response({'error': 'Media server not found'}, status=status.HTTP_404_NOT_FOUND)

        service = CircuitBreakerService()
        service.manual_reset(server, to_closed=True)
        return Response({
            'message': f"Circuit breaker for {server.name} reset to CLOSED.",
            'circuit_breaker_state': server.circuit_breaker_state,
            'health_status': server.health_status,
        }, status=status.HTTP_200_OK)


class AdminMediaServerHealthCheckTriggerView(APIView):
    """
    POST /api/v1/admin/media-servers/<uuid:pk>/health-check/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            server = MediaServer.objects.get(pk=pk)
        except MediaServer.DoesNotExist:
            return Response({'error': 'Media server not found'}, status=status.HTTP_404_NOT_FOUND)

        monitor = MediaServerHealthMonitorService()
        result = monitor.check_server_health(server)
        return Response(result, status=status.HTTP_200_OK)


class AdminMediaServerCapabilityRefreshView(APIView):
    """
    POST /api/v1/admin/media-servers/<uuid:pk>/capabilities/refresh/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            server = MediaServer.objects.get(pk=pk)
        except MediaServer.DoesNotExist:
            return Response({'error': 'Media server not found'}, status=status.HTTP_404_NOT_FOUND)

        service = CapabilityDiscoveryService()
        caps = service.discover_and_update(server)
        return Response({
            'message': f"Capabilities refreshed for {server.name}",
            'capabilities': caps
        }, status=status.HTTP_200_OK)


class AdminMediaServerVersionCheckView(APIView):
    """
    GET /api/v1/admin/media-servers/<uuid:pk>/version-check/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            server = MediaServer.objects.get(pk=pk)
        except MediaServer.DoesNotExist:
            return Response({'error': 'Media server not found'}, status=status.HTTP_404_NOT_FOUND)

        checker = VersionCompatibilityService()
        result = checker.check_compatibility(server)
        return Response(result, status=status.HTTP_200_OK)


class AdminMediaServerLoadBalanceSimulateView(APIView):
    """
    POST /api/v1/admin/media-servers/load-balance/simulate/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        content_type = request.data.get('content_type')
        required_caps = request.data.get('required_caps', {})
        tenant_id = getattr(request.user, 'tenant_id', None)

        lb = MediaServerLoadBalancerService()
        candidates = lb.get_candidate_servers(tenant_id=tenant_id, content_type=content_type, required_caps=required_caps)
        scored = []
        for c in candidates:
            scored.append({
                'id': str(c.id),
                'name': c.name,
                'score': round(lb.calculate_score(c), 2),
                'priority': c.priority,
                'weight': c.weight,
                'health_status': c.health_status,
                'avg_latency_ms': c.avg_response_time_ms,
            })
        scored.sort(key=lambda x: x['score'], reverse=True)

        selected = scored[0] if scored else None

        return Response({
            'selected_server': selected,
            'total_candidates': len(candidates),
            'candidates_scored': scored,
        }, status=status.HTTP_200_OK)


class AdminMediaServerDashboardView(APIView):
    """
    GET /api/v1/admin/media-servers/dashboard/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        service = MediaServerMetricsService()
        data = service.get_dashboard_summary()
        return Response(data, status=status.HTTP_200_OK)


class PrometheusMetricsView(APIView):
    """
    GET /metrics or /api/v1/metrics/prometheus/
    Public or token-secured infrastructure scraper endpoint.
    """
    permission_classes = []

    def get(self, request):
        service = MediaServerMetricsService()
        content = service.generate_prometheus_metrics()
        return HttpResponse(content, content_type="text/plain; version=0.0.4; charset=utf-8")
