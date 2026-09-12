import uuid
import logging
from django.utils import timezone
from apps.media_servers.models import MediaServer, MediaAccountMapping, MediaServerUserSync, MediaServerOrphanUser
from apps.media_servers.connectors import get_connector
from apps.accounts.models import AuditLog

logger = logging.getLogger(__name__)

class MediaServerAccountSyncService:
    """
    Decision 11 & Decision 18:
    Reconciliation & Account Sync Service between Smart Lounge and Media Servers.
    Detects orphan accounts on Jellyfin/Emby, detects deleted or missing remote users,
    and refreshes synchronization state without destructive automatic deletes.
    """

    def sync_users(
        self,
        media_server: MediaServer,
        sync_type: str = 'INCREMENTAL',
        actor = None
    ) -> MediaServerUserSync:
        sync_record = MediaServerUserSync.objects.create(
            media_server=media_server,
            tenant=media_server.tenant,
            sync_type=sync_type,
            status=MediaServerUserSync.Status.RUNNING,
            started_at=timezone.now(),
            triggered_by=MediaServerUserSync.TriggerSource.MANUAL if actor else MediaServerUserSync.TriggerSource.SCHEDULED,
            triggered_by_user=actor,
            correlation_id=uuid.uuid4(),
            metadata={'server_name': media_server.name}
        )

        try:
            self._do_sync(media_server, sync_record)
            sync_record.status = MediaServerUserSync.Status.COMPLETED
            sync_record.completed_at = timezone.now()
        except Exception as e:
            logger.error(f"MediaServerAccountSyncService failed for {media_server.name}: {e}", exc_info=True)
            sync_record.status = MediaServerUserSync.Status.FAILED
            sync_record.last_error = str(e)
            sync_record.completed_at = timezone.now()
        finally:
            sync_record.save()

        return sync_record

    def _do_sync(self, media_server: MediaServer, sync_record: MediaServerUserSync):
        connector = get_connector(media_server)

        # 1. Fetch all external users from the media server
        external_user_list = connector.list_users()
        external_users = {u.get('Id'): u for u in external_user_list if u.get('Id')}
        sync_record.users_checked = len(external_users)

        # 2. Fetch all existing mappings for this media server
        existing_mappings = {
            m.external_user_id: m
            for m in MediaAccountMapping.objects.filter(
                media_server=media_server,
                deleted_at__isnull=True
            ).select_related('user')
        }

        # 3. Reconcile external users -> mappings
        for ext_id, ext_user in external_users.items():
            if ext_id in existing_mappings:
                # User exists in both Smart Lounge and Media Server -> In Sync
                mapping = existing_mappings[ext_id]
                self._update_mapping_sync(mapping, ext_user)
                sync_record.users_updated += 1
            else:
                # User exists on Media Server but no mapping exists in Smart Lounge -> Orphan
                self._record_orphan_user(media_server, ext_user)
                sync_record.orphans_found += 1

        # 4. Check mappings whose external accounts disappeared from the server
        for ext_id, mapping in existing_mappings.items():
            if ext_id not in external_users and mapping.provisioning_status == MediaAccountMapping.ProvisioningStatus.COMPLETED:
                mapping.sync_status = MediaAccountMapping.SyncStatus.OUT_OF_SYNC
                mapping.sync_details = {
                    'error': 'external_user_not_found_on_server',
                    'checked_at': timezone.now().isoformat()
                }
                mapping.save(update_fields=['sync_status', 'sync_details'])
                sync_record.conflicts_found += 1

        # 5. Update media server timestamp
        media_server.last_user_sync_at = timezone.now()
        if sync_record.sync_type == MediaServerUserSync.SyncType.FULL:
            media_server.last_full_sync_at = timezone.now()
        media_server.save(update_fields=['last_user_sync_at', 'last_full_sync_at'])

        # 6. Audit
        try:
            AuditLog.objects.create(
                event_type='media_account.synced',
                user=sync_record.triggered_by_user,
                external_identity_ref=f"{media_server.name}:sync",
                details={
                    'sync_id': str(sync_record.id),
                    'users_checked': sync_record.users_checked,
                    'orphans_found': sync_record.orphans_found,
                    'conflicts_found': sync_record.conflicts_found,
                }
            )
        except Exception:
            pass

    def _update_mapping_sync(self, mapping: MediaAccountMapping, external_user: dict):
        mapping.external_username = external_user.get('Name', mapping.external_username)
        mapping.sync_status = MediaAccountMapping.SyncStatus.IN_SYNC
        is_disabled = external_user.get('Policy', {}).get('IsDisabled', False)
        mapping.sync_details = {
            'last_login_date': external_user.get('LastLoginDate'),
            'last_activity_date': external_user.get('LastActivityDate'),
            'is_disabled_on_server': is_disabled,
            'verified_at': timezone.now().isoformat()
        }
        mapping.last_sync_at = timezone.now()
        # Sync active state with remote state if disabled
        if is_disabled and mapping.is_active:
            mapping.is_active = False
            mapping.disabled_reason = "Disabled directly on media server"
            mapping.disabled_at = timezone.now()
        mapping.save(update_fields=['external_username', 'sync_status', 'sync_details', 'last_sync_at', 'is_active', 'disabled_reason', 'disabled_at'])

    def _record_orphan_user(self, media_server: MediaServer, external_user: dict):
        ext_id = external_user.get('Id')
        ext_name = external_user.get('Name', 'Unknown')

        # Check if already ignored or claimed
        orphan = MediaServerOrphanUser.objects.filter(
            media_server=media_server,
            external_user_id=ext_id
        ).first()

        if orphan:
            if orphan.status == MediaServerOrphanUser.Status.DELETED:
                return
            orphan.detected_at = timezone.now()
            orphan.metadata = {
                'last_login': external_user.get('LastLoginDate'),
                'is_disabled': external_user.get('Policy', {}).get('IsDisabled', False)
            }
            orphan.save(update_fields=['detected_at', 'metadata'])
        else:
            MediaServerOrphanUser.objects.create(
                media_server=media_server,
                tenant=media_server.tenant,
                external_user_id=ext_id,
                external_username=ext_name,
                detected_at=timezone.now(),
                status=MediaServerOrphanUser.Status.NEW,
                metadata={
                    'last_login': external_user.get('LastLoginDate'),
                    'is_disabled': external_user.get('Policy', {}).get('IsDisabled', False)
                }
            )
