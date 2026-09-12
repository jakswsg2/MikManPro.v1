from rest_framework import serializers
from .models import RadiusServer

class RadiusServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = RadiusServer
        fields = [
            'id', 'name', 'host', 'auth_port', 'acct_port',
            'role', 'is_active', 'priority', 'status',
            'last_health_check', 'latency_ms',
            'total_requests', 'failed_requests',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'last_health_check', 'latency_ms', 'total_requests', 'failed_requests', 'created_at', 'updated_at']
