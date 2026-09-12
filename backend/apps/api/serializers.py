from rest_framework import serializers
from apps.accounts.models import User, ExternalIdentity, LoungeSession, AuditLog
from apps.profiles.models import Profile, UserProfileAssignment
from apps.permissions.models import (
    Permission, UserPermissionOverride, Role, RolePermission,
    UserRoleAssignment, PermissionGroup, GroupPermission,
    UserGroupAssignment, ResourcePermissionOverride
)
from apps.permissions.engine import PermissionEngine
from apps.media_servers.models import (
    MediaServer, SyncJob, MediaAccountMapping,
    MediaServerUserSync, MediaServerOrphanUser
)
from apps.core.crypto import decrypt_secret
from apps.content.models import Library, MediaItem, Season, Episode, MediaSource, LogicalContentGroup
from apps.integrations.mikrotik.models import MikroTikRouter
from apps.integrations.radius.models import RadiusServer

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            'id', 'code', 'name', 'category', 'resource_type',
            'action', 'description', 'is_system', 'requires_scope'
        ]

class RolePermissionSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source='permission.code', read_only=True)
    permission_name = serializers.CharField(source='permission.name', read_only=True)

    class Meta:
        model = RolePermission
        fields = ['id', 'role', 'permission', 'permission_code', 'permission_name', 'effect']

class RoleSerializer(serializers.ModelSerializer):
    permissions_count = serializers.SerializerMethodField()
    permissions_map = RolePermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = [
            'id', 'code', 'name', 'description', 'is_system',
            'scope_level', 'is_assignable', 'permissions_count', 'permissions_map'
        ]

    def get_permissions_count(self, obj):
        return obj.permissions_map.count()

class UserRoleAssignmentSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_code = serializers.CharField(source='role.code', read_only=True)
    role_scope = serializers.CharField(source='role.scope_level', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    site_name = serializers.CharField(source='site.name', read_only=True)

    class Meta:
        model = UserRoleAssignment
        fields = [
            'id', 'user', 'role', 'role_name', 'role_code', 'role_scope',
            'tenant', 'tenant_name', 'site', 'site_name',
            'assigned_at', 'expires_at', 'is_active', 'revoked_at', 'revoked_reason'
        ]

class GroupPermissionSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source='permission.code', read_only=True)
    permission_name = serializers.CharField(source='permission.name', read_only=True)

    class Meta:
        model = GroupPermission
        fields = ['id', 'group', 'permission', 'permission_code', 'permission_name', 'effect']

class PermissionGroupSerializer(serializers.ModelSerializer):
    permissions_list = GroupPermissionSerializer(source='group_permissions', many=True, read_only=True)
    members_count = serializers.SerializerMethodField()

    class Meta:
        model = PermissionGroup
        fields = [
            'id', 'code', 'name', 'description', 'tenant', 'role',
            'is_system', 'priority', 'permissions_list', 'members_count'
        ]

    def get_members_count(self, obj):
        return obj.members.count()

class UserGroupAssignmentSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    group_code = serializers.CharField(source='group.code', read_only=True)
    priority = serializers.IntegerField(source='group.priority', read_only=True)

    class Meta:
        model = UserGroupAssignment
        fields = ['id', 'user', 'group', 'group_name', 'group_code', 'priority', 'tenant', 'site', 'is_active']

class ResourcePermissionOverrideSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source='permission.code', read_only=True)
    permission_name = serializers.CharField(source='permission.name', read_only=True)

    class Meta:
        model = ResourcePermissionOverride
        fields = [
            'id', 'user', 'resource_type', 'resource_id',
            'permission', 'permission_code', 'permission_name',
            'is_granted', 'reason', 'expires_at'
        ]

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            'id', 'name', 'code', 'description', 'is_system',
            'permissions', 'max_devices', 'max_concurrent_sessions'
        ]

class UserProfileAssignmentSerializer(serializers.ModelSerializer):
    profile_details = ProfileSerializer(source='profile', read_only=True)

    class Meta:
        model = UserProfileAssignment
        fields = ['id', 'profile', 'profile_details', 'assigned_at', 'is_active']

class UserPermissionOverrideSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source='permission.code', read_only=True)
    permission_name = serializers.CharField(source='permission.name', read_only=True)

    class Meta:
        model = UserPermissionOverride
        fields = ['id', 'permission', 'permission_code', 'permission_name', 'is_granted', 'reason', 'expires_at']

class UserSerializer(serializers.ModelSerializer):
    active_profile = ProfileSerializer(read_only=True)
    effective_permissions = serializers.SerializerMethodField()
    entitlements = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'lounge_id', 'username', 'email', 'full_name',
            'phone', 'language', 'timezone', 'status', 'is_active',
            'is_staff', 'is_superuser', 'active_profile', 'effective_permissions',
            'entitlements', 'created_at'
        ]
        read_only_fields = ['id', 'lounge_id', 'created_at']

    def get_effective_permissions(self, obj):
        return sorted(list(PermissionEngine.get_effective_permissions(obj)))

    def get_entitlements(self, obj):
        return PermissionEngine.get_user_entitlement_summary(obj)

class MediaServerSerializer(serializers.ModelSerializer):
    server_type_display = serializers.CharField(source='get_server_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    libraries_count = serializers.IntegerField(source='libraries.count', read_only=True)

    class Meta:
        model = MediaServer
        fields = [
            'id', 'name', 'server_type', 'server_type_display',
            'local_url', 'api_key', 'is_active', 'status', 'status_display',
            'last_ping_at', 'last_sync_at', 'server_info', 'libraries_count'
        ]
        extra_kwargs = {
            'api_key': {'write_only': True}
        }

class LibrarySerializer(serializers.ModelSerializer):
    server_name = serializers.CharField(source='server.name', read_only=True)

    class Meta:
        model = Library
        fields = [
            'id', 'server', 'server_name', 'external_id', 'name',
            'collection_type', 'required_permission', 'is_enabled',
            'synced_items_count'
        ]

class EpisodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Episode
        fields = ['id', 'episode_number', 'title', 'duration_minutes', 'stream_url']

class SeasonSerializer(serializers.ModelSerializer):
    episodes = EpisodeSerializer(many=True, read_only=True)

    class Meta:
        model = Season
        fields = ['id', 'season_number', 'title', 'episodes']

class MediaSourceSerializer(serializers.ModelSerializer):
    server_name = serializers.CharField(source='media_server.name', read_only=True)

    class Meta:
        model = MediaSource
        fields = [
            'id', 'media_item', 'media_server', 'server_name', 'external_id',
            'external_library_id', 'file_path', 'file_size', 'container',
            'video_codec', 'audio_codec', 'resolution', 'bitrate',
            'duration_seconds', 'has_subtitles', 'subtitle_languages',
            'audio_languages', 'is_available', 'last_seen_at'
        ]

class LogicalContentGroupSerializer(serializers.ModelSerializer):
    primary_item_title = serializers.CharField(source='primary_item.title', read_only=True)

    class Meta:
        model = LogicalContentGroup
        fields = [
            'id', 'canonical_title', 'canonical_year', 'content_type',
            'primary_item', 'primary_item_title', 'member_count',
            'created_at', 'updated_at'
        ]

class SyncJobSerializer(serializers.ModelSerializer):
    server_name = serializers.CharField(source='media_server.name', read_only=True)
    sync_type_display = serializers.CharField(source='get_sync_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SyncJob
        fields = [
            'id', 'media_server', 'server_name', 'sync_type', 'sync_type_display',
            'status', 'status_display', 'started_at', 'finished_at',
            'items_scanned', 'items_created', 'items_updated',
            'items_marked_unavailable', 'items_deduplicated',
            'error_message', 'details', 'created_at'
        ]

class MediaItemSerializer(serializers.ModelSerializer):
    library_name = serializers.CharField(source='library.name', read_only=True)
    server_id = serializers.CharField(source='library.server_id', read_only=True)
    server_name = serializers.CharField(source='library.server.name', read_only=True)
    can_download = serializers.SerializerMethodField()
    can_play = serializers.SerializerMethodField()
    seasons = SeasonSerializer(many=True, read_only=True)
    sources = MediaSourceSerializer(many=True, read_only=True)

    class Meta:
        model = MediaItem
        fields = [
            'id', 'library', 'library_name', 'server_id', 'server_name',
            'external_id', 'title', 'original_title', 'item_type', 'year',
            'duration_minutes', 'rating', 'community_rating', 'official_rating',
            'overview', 'genres', 'tags', 'studios', 'poster_url', 'backdrop_url',
            'resolution', 'is_premium', 'is_kids', 'audio_languages',
            'subtitle_languages', 'stream_url', 'view_count',
            'content_hash', 'normalized_title', 'sort_title',
            'is_logical_primary', 'logical_group_id',
            'can_download', 'can_play', 'seasons', 'sources'
        ]

    def get_can_download(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        return PermissionEngine.has_permission(request.user, 'content.download')

    def get_can_play(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        
        # Check kids filter
        if obj.is_kids and not PermissionEngine.has_permission(request.user, 'content.kids.view'):
            return False

        # Check premium requirement
        if obj.is_premium and not PermissionEngine.has_permission(request.user, 'content.premium.view'):
            return False

        # Check collection type permission
        req_perm = obj.library.required_permission
        if req_perm and not PermissionEngine.has_permission(request.user, req_perm):
            return False

        return True


class ExternalIdentitySerializer(serializers.ModelSerializer):
    user_lounge_id = serializers.CharField(source='user.lounge_id', read_only=True)
    user_full_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = ExternalIdentity
        fields = [
            'id', 'user', 'user_lounge_id', 'user_full_name',
            'identity_type', 'external_id', 'external_metadata',
            'is_primary', 'is_verified', 'first_seen_at',
            'last_seen_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_lounge_id', 'user_full_name', 'first_seen_at', 'created_at', 'updated_at']


class LoungeSessionSerializer(serializers.ModelSerializer):
    user_lounge_id = serializers.CharField(source='user.lounge_id', read_only=True)
    user_full_name = serializers.CharField(source='user.full_name', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = LoungeSession
        fields = [
            'id', 'user', 'user_lounge_id', 'user_full_name',
            'external_identity', 'ip_address', 'user_agent',
            'device_fingerprint', 'mikrotik_session_id', 'radius_session_id',
            'source', 'status', 'is_valid', 'issued_at',
            'expires_at', 'last_activity_at', 'revoked_at', 'revoked_reason'
        ]
        read_only_fields = [
            'id', 'user_lounge_id', 'user_full_name', 'is_valid',
            'issued_at', 'expires_at', 'last_activity_at', 'revoked_at', 'revoked_reason'
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    user_lounge_id = serializers.CharField(source='user.lounge_id', read_only=True)
    user_full_name = serializers.CharField(source='user.full_name', read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'event_type', 'event_type_display',
            'user', 'user_lounge_id', 'user_full_name',
            'external_identity_ref', 'ip_address', 'user_agent',
            'details', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CaptivePortalLoginSerializer(serializers.Serializer):
    external_id = serializers.CharField(required=True, max_length=128)
    identity_type = serializers.ChoiceField(
        choices=ExternalIdentity.IdentityType.choices,
        default=ExternalIdentity.IdentityType.RADIUS
    )
    password = serializers.CharField(required=False, allow_blank=True, default='')
    ip_address = serializers.IPAddressField(required=False, allow_null=True)
    mac_address = serializers.CharField(required=False, allow_blank=True, max_length=32)
    user_agent = serializers.CharField(required=False, allow_blank=True)
    device_fingerprint = serializers.CharField(required=False, allow_blank=True)


class SSOExchangeSerializer(serializers.Serializer):
    one_time_token = serializers.CharField(required=True)
    ip_address = serializers.IPAddressField(required=False, allow_null=True)
    user_agent = serializers.CharField(required=False, allow_blank=True)


class SessionRefreshSerializer(serializers.Serializer):
    refresh_token = serializers.CharField(required=True)


class SessionRevokeSerializer(serializers.Serializer):
    session_id = serializers.UUIDField(required=True)
    reason = serializers.CharField(required=False, default='User requested logout')


class LinkCardSerializer(serializers.Serializer):
    card_number = serializers.CharField(required=True, max_length=128)
    identity_type = serializers.ChoiceField(
        choices=ExternalIdentity.IdentityType.choices,
        default=ExternalIdentity.IdentityType.RADIUS
    )


# =========================================================================
# Phase 10: Media Server Account Management Serializers
# =========================================================================

class MediaAccountMappingSerializer(serializers.ModelSerializer):
    media_server_name = serializers.CharField(source='media_server.name', read_only=True)
    media_server_url = serializers.CharField(source='media_server.local_url', read_only=True)
    server_type = serializers.CharField(source='media_server.server_type', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_lounge_id = serializers.CharField(source='user.lounge_id', read_only=True)
    has_stored_password = serializers.SerializerMethodField()

    class Meta:
        model = MediaAccountMapping
        fields = [
            'id', 'media_server', 'media_server_name', 'media_server_url', 'server_type',
            'user', 'user_username', 'user_lounge_id',
            'external_user_id', 'external_username', 'has_stored_password',
            'provisioning_mode', 'provisioning_status', 'provisioning_error',
            'provisioning_attempts', 'sync_status', 'sync_details',
            'media_server_policy', 'is_active', 'disabled_at', 'disabled_reason',
            'last_sync_at', 'last_provisioned_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'has_stored_password', 'last_sync_at', 'last_provisioned_at',
            'created_at', 'updated_at'
        ]

    def get_has_stored_password(self, obj):
        return bool(obj.external_password_encrypted)


class MediaServerUserSyncSerializer(serializers.ModelSerializer):
    media_server_name = serializers.CharField(source='media_server.name', read_only=True)
    triggered_by_username = serializers.CharField(source='triggered_by_user.username', read_only=True, default=None)

    class Meta:
        model = MediaServerUserSync
        fields = [
            'id', 'media_server', 'media_server_name', 'sync_type', 'status',
            'started_at', 'completed_at', 'users_checked', 'users_created',
            'users_updated', 'users_disabled', 'users_deleted', 'mappings_fixed',
            'orphans_found', 'conflicts_found', 'last_error', 'triggered_by',
            'triggered_by_username', 'correlation_id', 'metadata'
        ]


class MediaServerOrphanUserSerializer(serializers.ModelSerializer):
    media_server_name = serializers.CharField(source='media_server.name', read_only=True)
    claimed_by_username = serializers.CharField(source='claimed_by_user.username', read_only=True, default=None)
    resolved_by_username = serializers.CharField(source='resolved_by.username', read_only=True, default=None)

    class Meta:
        model = MediaServerOrphanUser
        fields = [
            'id', 'media_server', 'media_server_name', 'external_user_id',
            'external_username', 'detected_at', 'status', 'claimed_by_user',
            'claimed_by_username', 'claimed_at', 'resolved_by',
            'resolved_by_username', 'resolution_note', 'metadata'
        ]


class ProvisioningConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaServer
        fields = [
            'id', 'name', 'provisioning_enabled', 'provisioning_mode',
            'auto_create_on_first_login', 'auto_create_on_playback',
            'auto_disable_on_subscription_expire', 'auto_delete_on_user_delete',
            'username_pattern', 'username_include_tenant',
            'default_library_ids', 'default_policy', 'sync_interval_minutes',
            'last_full_sync_at', 'last_user_sync_at'
        ]


class ManualLinkUserSerializer(serializers.Serializer):
    user_id = serializers.UUIDField(required=True)
    external_user_id = serializers.CharField(required=True, max_length=128)


class BulkProvisionSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.UUIDField(), required=True)
    media_server_id = serializers.UUIDField(required=True)


class BulkDisableSerializer(serializers.Serializer):
    mapping_ids = serializers.ListField(child=serializers.UUIDField(), required=True)
    reason = serializers.CharField(required=False, default="Admin bulk suspension")


class BulkPolicySerializer(serializers.Serializer):
    mapping_ids = serializers.ListField(child=serializers.UUIDField(), required=True)
    policy_override = serializers.DictField(required=False, default=dict)
