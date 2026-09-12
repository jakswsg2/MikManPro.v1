from rest_framework import serializers
from apps.media_servers.models import (
    MediaServer, MediaServerHealthCheck, DiscoveredMediaServer, MediaServerCapability
)

class MediaServerHealthCheckSerializer(serializers.ModelSerializer):
    server_name = serializers.CharField(source='media_server.name', read_only=True)

    class Meta:
        model = MediaServerHealthCheck
        fields = [
            'id', 'media_server', 'server_name', 'checked_at', 'status',
            'response_time_ms', 'endpoint', 'http_status_code', 'error_message',
            'server_version', 'active_sessions', 'active_transcodes', 'metadata'
        ]
        read_only_fields = fields


class DiscoveredMediaServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscoveredMediaServer
        fields = [
            'id', 'tenant', 'discovered_at', 'discovery_method', 'host', 'port',
            'server_type_guess', 'version_guess', 'confidence_score', 'status',
            'approved_at', 'approved_by', 'ignored_at', 'ignore_reason',
            'created_media_server', 'raw_response'
        ]
        read_only_fields = [
            'id', 'discovered_at', 'status', 'approved_at', 'approved_by',
            'ignored_at', 'created_media_server'
        ]


class MediaServerCapabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaServerCapability
        fields = ['id', 'media_server', 'capability_key', 'capability_value', 'detected_at', 'is_active']
        read_only_fields = ['id', 'detected_at']


class MediaServerAdvancedDetailSerializer(serializers.ModelSerializer):
    """
    Comprehensive serializer for administrative management of Media Servers.
    """
    capabilities_summary = serializers.SerializerMethodField()
    recent_health_checks = serializers.SerializerMethodField()

    class Meta:
        model = MediaServer
        fields = [
            'id', 'name', 'display_name', 'server_type', 'local_url', 'server_url_internal',
            'server_url_external', 'use_internal_url', 'is_active', 'status', 'health_status',
            'circuit_breaker_state', 'avg_response_time_ms', 'p95_response_time_ms',
            'priority', 'weight', 'is_primary', 'fallback_server',
            'max_concurrent_streams', 'max_concurrent_transcodes',
            'consecutive_failures', 'consecutive_successes', 'last_error_message',
            'last_error_at', 'last_health_check', 'server_version', 'api_version',
            'maintenance_mode', 'maintenance_message', 'preferred_for_content_types',
            'excluded_from_playback', 'capabilities_summary', 'recent_health_checks'
        ]

    def get_capabilities_summary(self, obj):
        return obj.capabilities or {}

    def get_recent_health_checks(self, obj):
        checks = obj.health_checks.all().order_by('-checked_at')[:5]
        return MediaServerHealthCheckSerializer(checks, many=True).data
