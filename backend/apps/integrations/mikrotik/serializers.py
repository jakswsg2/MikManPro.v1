from rest_framework import serializers
from .models import MikroTikRouter
from apps.core.crypto import encrypt_secret

class MikroTikRouterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = MikroTikRouter
        fields = [
            'id', 'name', 'host', 'port', 'use_ssl',
            'username', 'password', 'is_active', 'is_online',
            'last_seen_at', 'latency_ms', 'identity',
            'routeros_version', 'model', 'cpu_load',
            'memory_free_mb', 'uptime', 'active_hotspot_users_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_online', 'last_seen_at', 'latency_ms', 'identity', 'routeros_version', 'model', 'cpu_load', 'memory_free_mb', 'uptime', 'active_hotspot_users_count', 'created_at', 'updated_at']

    def create(self, validated_data):
        password = validated_data.pop('password', '')
        validated_data['password_encrypted'] = encrypt_secret(password).decode('utf-8')
        return super().create(validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            validated_data['password_encrypted'] = encrypt_secret(password).decode('utf-8')
        return super().update(instance, validated_data)
