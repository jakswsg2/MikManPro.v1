from rest_framework import serializers
from apps.playback.models import (
    WatchHistory, DevicePlayerPreference, PlaybackQualityLog,
    WatchPartySession, WatchPartyParticipant, CustomSubtitle,
    PlaybackSession, PlaybackToken
)

class DevicePlayerPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DevicePlayerPreference
        fields = [
            'id', 'user', 'device_id', 'tenant', 'default_quality', 'max_quality',
            'auto_play_next', 'auto_skip_intro', 'autoplay_preview',
            'preferred_audio_language', 'preferred_subtitle_language',
            'subtitle_enabled_by_default', 'subtitle_size', 'subtitle_color',
            'subtitle_background', 'subtitle_position', 'playback_speed_default',
            'volume_default', 'skip_forward_seconds', 'skip_backward_seconds',
            'keyboard_shortcuts_enabled', 'picture_in_picture_enabled',
            'external_player_preference', 'data_saver_mode', 'metadata',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'tenant', 'created_at', 'updated_at']

class WatchHistorySerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='media_item.title', read_only=True)
    poster_url = serializers.CharField(source='media_item.poster_url', read_only=True)
    backdrop_url = serializers.CharField(source='media_item.backdrop_url', read_only=True)

    class Meta:
        model = WatchHistory
        fields = [
            'id', 'media_item', 'title', 'poster_url', 'backdrop_url',
            'device_id', 'position_seconds', 'duration_seconds',
            'completion_percentage', 'is_completed', 'last_watched_at',
            'playback_method', 'preferred_quality', 'preferred_audio',
            'preferred_subtitle', 'watch_time_seconds', 'sync_version',
            'updated_by_device'
        ]
        read_only_fields = ['id', 'completion_percentage', 'is_completed', 'sync_version', 'last_watched_at']

class CustomSubtitleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomSubtitle
        fields = [
            'id', 'user', 'media_item', 'language', 'label',
            'file_path', 'file_format', 'offset_seconds', 'is_public',
            'approved', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'file_path', 'approved', 'created_at']

class WatchPartySessionSerializer(serializers.ModelSerializer):
    host_name = serializers.CharField(source='host.username', read_only=True)
    media_title = serializers.CharField(source='media_item.title', read_only=True)
    media_poster = serializers.CharField(source='media_item.poster_url', read_only=True)
    participants_count = serializers.SerializerMethodField()

    class Meta:
        model = WatchPartySession
        fields = [
            'id', 'host', 'host_name', 'media_item', 'media_title', 'media_poster',
            'status', 'scheduled_at', 'started_at', 'ended_at',
            'current_position_seconds', 'playback_rate', 'invite_code',
            'is_public', 'max_participants', 'participants_count', 'created_at'
        ]
        read_only_fields = ['id', 'host', 'invite_code', 'started_at', 'ended_at', 'created_at']

    def get_participants_count(self, obj):
        return obj.participants.filter(is_active=True).count()

class PlaybackQualityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaybackQualityLog
        fields = [
            'id', 'playback_session', 'quality', 'bitrate_kbps',
            'buffer_health_seconds', 'dropped_frames', 'playback_rate',
            'buffer_duration_seconds', 'event_type', 'metadata', 'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']
