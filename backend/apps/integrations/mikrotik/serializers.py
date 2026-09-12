from rest_framework import serializers
from .models import MikroTikRouter

class MikroTikRouterSerializer(serializers.ModelSerializer):
    class Meta:
        model = MikroTikRouter
        fields = [
            'id', 'name', 'host', 'port', 'use_ssl',
            'username', 'is_active', 'is_online',
            'last_seen_at', 'latency_ms', 'identity',
            'routeros_version', 'model', 'cpu_load',
            'memory_free_mb', 'uptime', 'active_hotspot_users_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_online', 'last_seen_at', 'latency_ms', 'identity', 'routeros_version', 'model', 'cpu_load', 'memory_free_mb', 'uptime', 'active_hotspot_users_count', 'created_at', 'updated_at']
