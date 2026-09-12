from typing import Dict, Any, Optional
from django.utils import timezone
from apps.media_servers.models import MediaAccountMapping, MediaServer, MediaServerOrphanUser, MediaServerUserSync

class ProvisioningHealthService:
    """
    Computes health scores, success rates, and diagnostic metrics
    for the Media Server Account Provisioning infrastructure.
    """

    def get_health_metrics(self, media_server_id: Optional[str] = None) -> Dict[str, Any]:
        mapping_qs = MediaAccountMapping.objects.filter(deleted_at__isnull=True)
        orphan_qs = MediaServerOrphanUser.objects.all()
        sync_qs = MediaServerUserSync.objects.all()

        if media_server_id:
            mapping_qs = mapping_qs.filter(media_server_id=media_server_id)
            orphan_qs = orphan_qs.filter(media_server_id=media_server_id)
            sync_qs = sync_qs.filter(media_server_id=media_server_id)

        total_mappings = mapping_qs.count()
        completed = mapping_qs.filter(provisioning_status=MediaAccountMapping.ProvisioningStatus.COMPLETED).count()
        failed = mapping_qs.filter(provisioning_status=MediaAccountMapping.ProvisioningStatus.FAILED).count()
        pending = mapping_qs.filter(provisioning_status=MediaAccountMapping.ProvisioningStatus.PENDING).count()
        disabled = mapping_qs.filter(provisioning_status=MediaAccountMapping.ProvisioningStatus.DISABLED).count()
        in_sync = mapping_qs.filter(sync_status=MediaAccountMapping.SyncStatus.IN_SYNC).count()
        out_of_sync = mapping_qs.filter(sync_status=MediaAccountMapping.SyncStatus.OUT_OF_SYNC).count()

        active_orphans = orphan_qs.filter(status=MediaServerOrphanUser.Status.NEW).count()

        considered = completed + failed
        success_rate = round((completed / considered * 100), 1) if considered > 0 else 100.0

        if success_rate >= 95 and out_of_sync == 0 and failed == 0:
            health_status = 'HEALTHY'
        elif success_rate >= 80 or out_of_sync > 0 or active_orphans > 0:
            health_status = 'DEGRADED'
        else:
            health_status = 'UNHEALTHY'

        last_sync = sync_qs.order_by('-started_at').first()

        return {
            'health_status': health_status,
            'success_rate': success_rate,
            'total_mappings': total_mappings,
            'completed': completed,
            'failed': failed,
            'pending': pending,
            'disabled': disabled,
            'in_sync': in_sync,
            'out_of_sync': out_of_sync,
            'active_orphans': active_orphans,
            'last_sync_at': last_sync.started_at.isoformat() if last_sync else None,
            'last_sync_status': last_sync.status if last_sync else None,
        }
