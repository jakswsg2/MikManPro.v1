import logging
from django.utils import timezone
from apps.media_servers.models import MediaAccountMapping, MediaServer, MediaServerOrphanUser
from apps.media_servers.connectors import get_connector, UserNotFoundError
from apps.accounts.models import AuditLog

logger = logging.getLogger(__name__)

class AccountAlreadyLinked(Exception):
    """Raised when an external media server account is already bound to another Lounge user."""
    pass

class ExternalUserNotFound(Exception):
    """Raised when the specified external user ID does not exist on the media server."""
    pass

class ManualLinkingService:
    """
    Decision 11: Manual Linking Service.
    Enables administrators to attach an existing Jellyfin/Emby user account to a Smart Lounge user,
    resolving orphan accounts or onboarding legacy local users.
    """

    def link_existing_account(
        self,
        user,
        media_server: MediaServer,
        external_user_id: str,
        actor = None
    ) -> MediaAccountMapping:
        # 1. Prevent double linking across different users
        existing_conflict = MediaAccountMapping.objects.filter(
            media_server=media_server,
            external_user_id=external_user_id,
            deleted_at__isnull=True
        ).exclude(user=user).first()

        if existing_conflict:
            raise AccountAlreadyLinked(
                f"External account '{external_user_id}' is already linked to user {existing_conflict.user.username} ({existing_conflict.user.lounge_id})."
            )

        # 2. Fetch user information from Media Server
        connector = get_connector(media_server)
        try:
            external_user = connector.get_user(external_user_id)
        except (UserNotFoundError, Exception) as e:
            raise ExternalUserNotFound(f"User with ID '{external_user_id}' not found on {media_server.name}: {e}")

        # 3. Create or update mapping
        mapping, created = MediaAccountMapping.objects.update_or_create(
            user=user,
            media_server=media_server,
            defaults={
                'tenant': getattr(user, 'tenant', None) or media_server.tenant,
                'external_user_id': external_user_id,
                'external_username': external_user.get('Name', ''),
                'provisioning_mode': MediaAccountMapping.ProvisioningMode.MANUAL,
                'provisioning_status': MediaAccountMapping.ProvisioningStatus.COMPLETED,
                'last_provisioned_at': timezone.now(),
                'sync_status': MediaAccountMapping.SyncStatus.IN_SYNC,
                'is_active': not external_user.get('Policy', {}).get('IsDisabled', False),
                'media_server_policy': external_user.get('Policy', {}),
                'deleted_at': None,
                'deleted_reason': None,
            }
        )

        # 4. If an Orphan record exists for this account, mark as CLAIMED
        orphan = MediaServerOrphanUser.objects.filter(
            media_server=media_server,
            external_user_id=external_user_id
        ).first()
        if orphan:
            orphan.status = MediaServerOrphanUser.Status.CLAIMED
            orphan.claimed_by_user = user
            orphan.claimed_at = timezone.now()
            orphan.resolved_by = actor
            orphan.resolution_note = f"Manually claimed by admin {actor.username if actor else 'SYSTEM'}"
            orphan.save(update_fields=['status', 'claimed_by_user', 'claimed_at', 'resolved_by', 'resolution_note'])

        # 5. Audit Log
        try:
            AuditLog.objects.create(
                event_type='media_account.linked_manually',
                user=user,
                external_identity_ref=f"{media_server.name}:{external_user.get('Name')}",
                details={
                    'mapping_id': str(mapping.id),
                    'media_server_id': str(media_server.id),
                    'external_user_id': external_user_id,
                    'external_username': external_user.get('Name'),
                    'actor_id': str(actor.id) if actor else 'SYSTEM',
                }
            )
        except Exception:
            pass

        return mapping

    def unlink_account(
        self,
        mapping: MediaAccountMapping,
        keep_on_server: bool = True,
        actor = None
    ) -> None:
        """
        Unlinks an external account from the Lounge user.
        If keep_on_server is False, also permanently deletes user from Jellyfin/Emby.
        """
        if not keep_on_server:
            connector = get_connector(mapping.media_server)
            try:
                connector.delete_user(mapping.external_user_id)
            except Exception as e:
                logger.warning(f"Failed deleting remote user during unlink: {e}")

        mapping.is_active = False
        mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.DELETED
        mapping.deleted_at = timezone.now()
        mapping.deleted_reason = "Unlinked manually"
        mapping.save(update_fields=['is_active', 'provisioning_status', 'deleted_at', 'deleted_reason'])

        try:
            AuditLog.objects.create(
                event_type='media_account.unlinked',
                user=mapping.user,
                external_identity_ref=f"{mapping.media_server.name}:{mapping.external_username}",
                details={
                    'mapping_id': str(mapping.id),
                    'keep_on_server': keep_on_server,
                    'actor_id': str(actor.id) if actor else 'SYSTEM',
                }
            )
        except Exception:
            pass
