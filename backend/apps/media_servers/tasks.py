import logging
from celery import shared_task
from apps.media_servers.models import MediaServer
from apps.accounts.models import User
from .services import (
    MediaAccountProvisioningService,
    MediaServerAccountSyncService,
    ProvisioningRetryService,
    MediaAccountDeprovisioningService,
)

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def provision_single_task(self, user_id: str, media_server_id: str, actor_id: str = None):
    """
    Celery background worker task to provision an individual account idempotently.
    """
    try:
        user = User.objects.get(id=user_id)
        server = MediaServer.objects.get(id=media_server_id)
        actor = User.objects.filter(id=actor_id).first() if actor_id else None

        service = MediaAccountProvisioningService()
        mapping = service.provision_for_user(user, server, actor=actor)
        logger.info(f"Task finished: provisioned {user.username} on {server.name} (Mapping: {mapping.id})")
        return {'status': 'COMPLETED', 'mapping_id': str(mapping.id)}
    except Exception as exc:
        logger.error(f"Task provision_single_task error for user {user_id}: {exc}")
        raise self.retry(exc=exc)

@shared_task
def sync_accounts_task(media_server_id: str, sync_type: str = 'INCREMENTAL', actor_id: str = None):
    """
    Executes reconciliation and user synchronization for a specific Media Server.
    """
    try:
        server = MediaServer.objects.get(id=media_server_id)
        actor = User.objects.filter(id=actor_id).first() if actor_id else None
        sync_service = MediaServerAccountSyncService()
        sync_record = sync_service.sync_users(server, sync_type=sync_type, actor=actor)
        return {
            'sync_id': str(sync_record.id),
            'status': sync_record.status,
            'checked': sync_record.users_checked,
            'orphans': sync_record.orphans_found
        }
    except Exception as e:
        logger.error(f"sync_accounts_task failed for server {media_server_id}: {e}")
        return {'status': 'FAILED', 'error': str(e)}

@shared_task
def scheduled_user_sync():
    """
    Periodic cron task: loops over all active media servers and reconciles accounts.
    """
    servers = MediaServer.objects.filter(is_active=True, provisioning_enabled=True)
    results = []
    sync_service = MediaServerAccountSyncService()

    for server in servers:
        try:
            record = sync_service.sync_users(server, sync_type='INCREMENTAL')
            results.append({'server': server.name, 'status': record.status})
        except Exception as e:
            logger.error(f"Scheduled sync failed on {server.name}: {e}")
            results.append({'server': server.name, 'status': 'FAILED', 'error': str(e)})

    return results

@shared_task
def retry_failed_provisionings_task():
    """
    Periodic task: automatically retries transiently failed user provisioning jobs.
    """
    retry_service = ProvisioningRetryService()
    return retry_service.retry_failed(max_attempts=3)

@shared_task
def bulk_disable_expired_task():
    """
    Periodic task: suspends media accounts for expired subscriptions.
    """
    deprovisioner = MediaAccountDeprovisioningService()
    return deprovisioner.bulk_disable_for_expired_subscriptions()


# =========================================================================
# Phase 14: Background Periodic Tasks (Health Monitoring & Discovery)
# =========================================================================

@shared_task
def check_all_media_servers_health_task():
    """
    Periodic task (every 60s): checks latency, active sessions, and circuit breaker
    states across all active media servers.
    """
    from apps.media_servers.services.health_monitor import MediaServerHealthMonitorService
    monitor = MediaServerHealthMonitorService()
    results = monitor.check_all_servers()
    logger.info(f"Health monitor completed for {len(results)} servers.")
    return results

@shared_task
def discover_lan_media_servers_task(subnet_prefix: str = '192.168.1', tenant_id: str = None):
    """
    Background LAN scanner task searching for unmanaged Jellyfin/Emby/Plex instances.
    """
    from apps.media_servers.services.discovery import LanDiscoveryService
    discovery = LanDiscoveryService()
    found = discovery.scan_subnet(subnet_prefix=subnet_prefix, tenant_id=tenant_id)
    logger.info(f"LAN discovery completed for subnet {subnet_prefix}. Found {len(found)} candidate servers.")
    return found

@shared_task
def update_media_server_capabilities_task(media_server_id: str):
    """
    Periodically refreshes server capabilities (plugins, codecs, transcode hardware).
    """
    from apps.media_servers.services.capability import CapabilityDiscoveryService
    server = MediaServer.objects.get(id=media_server_id)
    service = CapabilityDiscoveryService()
    caps = service.discover_and_update(server)
    return caps

