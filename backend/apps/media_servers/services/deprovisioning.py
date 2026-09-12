import logging
from django.utils import timezone
from apps.media_servers.models import MediaAccountMapping
from apps.media_servers.connectors import get_connector, UserNotFoundError
from apps.accounts.models import AuditLog

logger = logging.getLogger(__name__)

class MediaAccountDeprovisioningService:
    """
    Handles suspension, reinstatement, and soft/hard deprovisioning of Media Server accounts.
    Ensures that when a user's subscription expires or account is revoked,
    access to LAN media streaming is immediately halted.
    """

    def disable_account(self, mapping: MediaAccountMapping, reason: str, actor=None) -> None:
        """
        Disables the user on the Media Server and sets is_active=False on the mapping.
        """
        connector = get_connector(mapping.media_server)
        if mapping.external_user_id:
            try:
                connector.disable_user(mapping.external_user_id)
            except UserNotFoundError:
                logger.warning(f"User {mapping.external_user_id} not found on server during disable.")
            except Exception as e:
                logger.error(f"Failed to disable user on server {mapping.media_server.name}: {e}")

        mapping.is_active = False
        mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.DISABLED
        mapping.disabled_at = timezone.now()
        mapping.disabled_reason = reason
        mapping.save(update_fields=['is_active', 'provisioning_status', 'disabled_at', 'disabled_reason'])

        self._audit(mapping, 'media_account.disabled', reason, actor)

    def enable_account(self, mapping: MediaAccountMapping, actor=None) -> None:
        """
        Re-enables the user on the Media Server and restores active status.
        """
        connector = get_connector(mapping.media_server)
        if mapping.external_user_id:
            try:
                connector.enable_user(mapping.external_user_id)
            except UserNotFoundError:
                logger.warning(f"User {mapping.external_user_id} not found on server during enable.")
            except Exception as e:
                logger.error(f"Failed to enable user on server {mapping.media_server.name}: {e}")

        mapping.is_active = True
        mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.COMPLETED
        mapping.disabled_at = None
        mapping.disabled_reason = None
        mapping.save(update_fields=['is_active', 'provisioning_status', 'disabled_at', 'disabled_reason'])

        self._audit(mapping, 'media_account.enabled', 'Reactivated', actor)

    def delete_account(self, mapping: MediaAccountMapping, reason: str, actor=None) -> None:
        """
        Removes the user from the Media Server (hard delete remotely),
        and applies a soft-delete stamp on Smart Lounge MediaAccountMapping.
        """
        connector = get_connector(mapping.media_server)
        if mapping.external_user_id:
            try:
                connector.delete_user(mapping.external_user_id)
            except UserNotFoundError:
                pass  # Idempotent deletion
            except Exception as e:
                logger.error(f"Error deleting external user {mapping.external_user_id}: {e}")

        mapping.is_active = False
        mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.DELETED
        mapping.deleted_at = timezone.now()
        mapping.deleted_reason = reason
        mapping.save(update_fields=['is_active', 'provisioning_status', 'deleted_at', 'deleted_reason'])

        self._audit(mapping, 'media_account.deleted', reason, actor)

    def bulk_disable_for_expired_subscriptions(self) -> dict:
        """
        Scans all active media account mappings belonging to users whose status is EXPIRED or SUSPENDED.
        Typically triggered via periodic Celery task.
        """
        from apps.accounts.models import User
        expired_users = User.objects.filter(status__in=[User.Status.EXPIRED, User.Status.SUSPENDED])
        mappings_to_disable = MediaAccountMapping.objects.filter(
            user__in=expired_users,
            is_active=True,
            deleted_at__isnull=True
        ).select_related('media_server', 'user')

        disabled_count = 0
        for m in mappings_to_disable:
            try:
                self.disable_account(m, reason='subscription_expired', actor=None)
                disabled_count += 1
            except Exception as e:
                logger.error(f"Failed bulk disabling mapping {m.id}: {e}")

        return {
            'scanned_users': expired_users.count(),
            'disabled_accounts': disabled_count
        }

    def _audit(self, mapping: MediaAccountMapping, event_type: str, reason: str, actor):
        try:
            AuditLog.objects.create(
                event_type=event_type,
                user=mapping.user,
                external_identity_ref=f"{mapping.media_server.name}:{mapping.external_username}",
                details={
                    'mapping_id': str(mapping.id),
                    'media_server_id': str(mapping.media_server_id),
                    'external_user_id': mapping.external_user_id,
                    'reason': reason,
                    'actor_id': str(actor.id) if actor else 'SYSTEM',
                }
            )
        except Exception:
            pass
