from django.contrib import admin
from django.utils.html import format_html
from .models import (
    MediaServer, SyncJob,
    MediaAccountMapping, MediaServerUserSync, MediaServerOrphanUser,
    MediaServerHealthCheck, DiscoveredMediaServer, MediaServerCapability
)

@admin.register(MediaServer)
class MediaServerAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'display_name', 'server_type', 'priority', 'weight',
        'circuit_breaker_badge', 'health_badge', 'avg_response_time_ms',
        'is_active', 'maintenance_mode'
    )
    list_filter = (
        'server_type', 'health_status', 'circuit_breaker_state',
        'is_active', 'maintenance_mode', 'is_primary'
    )
    search_fields = ('name', 'display_name', 'local_url', 'server_url_internal', 'server_url_external')
    fieldsets = (
        ('General Info', {
            'fields': (
                'name', 'display_name', 'server_type', 'tenant', 'internal_notes',
                'is_active', 'status', 'health_status', 'maintenance_mode', 'maintenance_message'
            )
        }),
        ('Network Endpoints & Auth', {
            'fields': (
                'local_url', 'server_url_internal', 'server_url_external',
                'use_internal_url', 'api_key', 'api_timeout_seconds'
            )
        }),
        ('Load Balancing & Failover', {
            'fields': (
                'priority', 'weight', 'is_primary', 'fallback_server',
                'max_concurrent_streams', 'max_concurrent_transcodes',
                'preferred_for_content_types', 'excluded_from_playback'
            )
        }),
        ('Circuit Breaker & Health Monitoring', {
            'fields': (
                'circuit_breaker_state', 'circuit_breaker_opened_at', 'circuit_breaker_next_attempt_at',
                'consecutive_failures', 'consecutive_successes',
                'consecutive_failures_threshold', 'consecutive_success_threshold',
                'health_check_interval_seconds', 'auto_disable_on_repeated_failures',
                'last_health_check', 'last_error_message', 'last_error_at',
                'avg_response_time_ms', 'p95_response_time_ms'
            )
        }),
        ('Capabilities & Versions', {
            'fields': (
                'server_version', 'api_version', 'capabilities_discovered_at',
                'last_version_check_at', 'capabilities', 'server_info'
            )
        }),
        ('Provisioning & Account Sync Policies', {
            'fields': (
                'provisioning_enabled', 'provisioning_mode',
                'auto_create_on_first_login', 'auto_create_on_playback',
                'auto_disable_on_subscription_expire', 'auto_delete_on_user_delete',
                'username_pattern', 'username_include_tenant',
                'default_library_ids', 'default_policy',
                'sync_interval_minutes', 'last_full_sync_at', 'last_user_sync_at'
            )
        }),
    )

    def circuit_breaker_badge(self, obj):
        colors = {
            'CLOSED': '#16a34a',
            'OPEN': '#dc2626',
            'HALF_OPEN': '#ca8a04',
        }
        c = colors.get(obj.circuit_breaker_state, '#6b7280')
        return format_html(f'<span style="background-color: {c}; color: white; padding: 2px 7px; border-radius: 4px; font-size: 11px;">{obj.get_circuit_breaker_state_display()}</span>')
    circuit_breaker_badge.short_description = 'قاطع الدائرة'

    def health_badge(self, obj):
        colors = {
            'HEALTHY': '#16a34a',
            'DEGRADED': '#ca8a04',
            'UNHEALTHY': '#dc2626',
            'TIMEOUT': '#ef4444',
            'OFFLINE': '#64748b',
        }
        c = colors.get(obj.health_status, '#6b7280')
        return format_html(f'<span style="color: {c}; font-weight: bold;">{obj.get_health_status_display()}</span>')
    health_badge.short_description = 'الجاهزية'


@admin.register(MediaServerHealthCheck)
class MediaServerHealthCheckAdmin(admin.ModelAdmin):
    list_display = ('media_server', 'status', 'response_time_ms', 'http_status_code', 'checked_at')
    list_filter = ('status', 'http_status_code', 'media_server')
    search_fields = ('media_server__name', 'endpoint', 'error_message')
    readonly_fields = ('checked_at', 'created_at')


@admin.register(DiscoveredMediaServer)
class DiscoveredMediaServerAdmin(admin.ModelAdmin):
    list_display = (
        'host', 'port', 'server_type_guess', 'version_guess',
        'discovery_method', 'confidence_score', 'status', 'discovered_at'
    )
    list_filter = ('server_type_guess', 'discovery_method', 'status', 'tenant')
    search_fields = ('host', 'version_guess')
    readonly_fields = ('discovered_at', 'created_at')


@admin.register(MediaServerCapability)
class MediaServerCapabilityAdmin(admin.ModelAdmin):
    list_display = ('media_server', 'capability_key', 'is_active', 'detected_at')
    list_filter = ('capability_key', 'is_active', 'media_server')
    search_fields = ('media_server__name', 'capability_key')


@admin.register(MediaAccountMapping)
class MediaAccountMappingAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'media_server', 'external_username',
        'provisioning_mode', 'provisioning_status_badge',
        'sync_status_badge', 'is_active', 'last_sync_at'
    )
    list_filter = ('provisioning_status', 'sync_status', 'provisioning_mode', 'is_active', 'media_server')
    search_fields = ('user__username', 'user__lounge_id', 'external_username', 'external_user_id')
    readonly_fields = ('external_password_encrypted', 'created_at', 'updated_at', 'last_provisioned_at', 'last_sync_at')

    def provisioning_status_badge(self, obj):
        colors = {
            'COMPLETED': '#16a34a',
            'PENDING': '#ca8a04',
            'IN_PROGRESS': '#2563eb',
            'FAILED': '#dc2626',
            'DISABLED': '#64748b',
            'DELETED': '#991b1b',
        }
        c = colors.get(obj.provisioning_status, '#6b7280')
        return format_html(f'<span style="background-color: {c}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px;">{obj.get_provisioning_status_display()}</span>')
    provisioning_status_badge.short_description = 'حالة التزويد'

    def sync_status_badge(self, obj):
        colors = {
            'IN_SYNC': '#16a34a',
            'OUT_OF_SYNC': '#dc2626',
            'UNKNOWN': '#64748b',
            'ERROR': '#ef4444',
        }
        c = colors.get(obj.sync_status, '#6b7280')
        return format_html(f'<span style="color: {c}; font-weight: bold;">{obj.get_sync_status_display()}</span>')
    sync_status_badge.short_description = 'التطابق'


@admin.register(MediaServerUserSync)
class MediaServerUserSyncAdmin(admin.ModelAdmin):
    list_display = ('media_server', 'sync_type', 'status', 'started_at', 'users_checked', 'orphans_found', 'conflicts_found', 'triggered_by')
    list_filter = ('sync_type', 'status', 'triggered_by', 'media_server')
    readonly_fields = ('id', 'correlation_id', 'started_at', 'completed_at')


@admin.register(MediaServerOrphanUser)
class MediaServerOrphanUserAdmin(admin.ModelAdmin):
    list_display = ('external_username', 'media_server', 'status', 'detected_at', 'claimed_by_user')
    list_filter = ('status', 'media_server')
    search_fields = ('external_username', 'external_user_id')
