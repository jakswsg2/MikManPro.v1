import logging
from apps.media_servers.models import MediaAccountMapping
from .provisioning import MediaAccountProvisioningService

logger = logging.getLogger(__name__)

class ProvisioningRetryService:
    """
    Scans for failed media account provisioning tasks and retries them automatically,
    respecting maximum retry bounds.
    """

    def __init__(self):
        self.provisioner = MediaAccountProvisioningService()

    def retry_failed(self, max_attempts: int = 3) -> dict:
        failed_mappings = MediaAccountMapping.objects.filter(
            provisioning_status=MediaAccountMapping.ProvisioningStatus.FAILED,
            provisioning_attempts__lt=max_attempts,
            deleted_at__isnull=True
        ).select_related('user', 'media_server')

        retried = 0
        succeeded = 0
        failed = 0

        for mapping in failed_mappings:
            retried += 1
            try:
                self.provisioner.provision_for_user(mapping.user, mapping.media_server)
                succeeded += 1
                logger.info(f"Successfully recovered provisioning for mapping {mapping.id}")
            except Exception as e:
                failed += 1
                logger.warning(f"Retry attempt failed for mapping {mapping.id}: {e}")

        return {
            'total_retried': retried,
            'succeeded': succeeded,
            'still_failed': failed,
        }
