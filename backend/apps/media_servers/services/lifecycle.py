import logging
from apps.media_servers.models import MediaServer, MediaAccountMapping
from .provisioning import MediaAccountProvisioningService
from .deprovisioning import MediaAccountDeprovisioningService

logger = logging.getLogger(__name__)

class MediaAccountLifecycleService:
    """
    Coordinates lifecycle events across Smart Lounge identities and external media accounts.
    Reacts to User Registration, Subscription Upgrades/Renewals, Expirations, and Account Deletions.
    """

    def __init__(self):
        self.provisioning_service = MediaAccountProvisioningService()
        self.deprovisioning_service = MediaAccountDeprovisioningService()

    def on_user_created(self, user):
        """
        Invoked when a new Lounge user is created.
        If active servers are configured for auto-creation on first login / account creation,
        auto-provisions an account on each matching server.
        """
        servers = MediaServer.objects.filter(
            is_active=True,
            provisioning_enabled=True,
            auto_create_on_first_login=True
        )
        if hasattr(user, 'tenant') and user.tenant:
            servers = servers.filter(tenant=user.tenant) | servers.filter(tenant__isnull=True)

        for server in servers:
            try:
                self.provisioning_service.provision_for_user(user, server)
                logger.info(f"Auto-provisioned account on {server.name} for newly created user {user.username}")
            except Exception as e:
                logger.error(f"Failed to auto-provision user {user.username} on {server.name}: {e}")

    def on_subscription_activated(self, user):
        """
        Invoked when a user's subscription becomes active or renewed.
        Reactivates any previously suspended or disabled media accounts.
        """
        mappings = MediaAccountMapping.objects.filter(
            user=user,
            is_active=False,
            provisioning_status=MediaAccountMapping.ProvisioningStatus.DISABLED,
            deleted_at__isnull=True
        )
        for mapping in mappings:
            try:
                self.deprovisioning_service.enable_account(mapping)
                logger.info(f"Re-enabled media account {mapping.external_username} on {mapping.media_server.name} for user {user.username}")
            except Exception as e:
                logger.error(f"Failed to re-enable mapping {mapping.id}: {e}")

    def on_subscription_expired(self, user):
        """
        Invoked when a user's subscription expires.
        Suspends media accounts on servers configured with auto_disable_on_subscription_expire.
        """
        mappings = MediaAccountMapping.objects.filter(
            user=user,
            is_active=True,
            deleted_at__isnull=True,
            media_server__auto_disable_on_subscription_expire=True
        )
        for mapping in mappings:
            try:
                self.deprovisioning_service.disable_account(mapping, reason="subscription_expired")
                logger.info(f"Disabled media account {mapping.external_username} on {mapping.media_server.name} due to subscription expiration.")
            except Exception as e:
                logger.error(f"Failed to disable mapping {mapping.id}: {e}")

    def on_user_deleted(self, user):
        """
        Invoked prior to user deletion.
        Either deletes remote accounts or marks mappings deleted based on server configuration.
        """
        mappings = MediaAccountMapping.objects.filter(
            user=user,
            deleted_at__isnull=True
        ).select_related('media_server')

        for mapping in mappings:
            try:
                if mapping.media_server.auto_delete_on_user_delete:
                    self.deprovisioning_service.delete_account(mapping, reason="user_deleted")
                else:
                    self.deprovisioning_service.disable_account(mapping, reason="user_deleted")
            except Exception as e:
                logger.error(f"Error handling user deletion for mapping {mapping.id}: {e}")
