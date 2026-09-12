import secrets
import string
import logging
from django.db import transaction
from django.utils import timezone
from apps.media_servers.models import MediaAccountMapping, MediaServer
from apps.media_servers.connectors import get_connector
from apps.core.crypto import encrypt_secret
from apps.accounts.models import AuditLog
from .policy_mapping import PolicyMappingService
from .conflict_resolution import UsernameConflictResolver

logger = logging.getLogger(__name__)

class MediaAccountProvisioningService:
    """
    Decision 11, 18 & 57:
    Core service responsible for user provisioning on Jellyfin and Emby media servers.
    Ensures idempotency, Fernet-encrypted password storage, tenant safety,
    and automatic policy application.
    """

    def __init__(self):
        self.policy_mapper = PolicyMappingService()
        self.conflict_resolver = UsernameConflictResolver()

    def provision_for_user(
        self,
        user,
        media_server: MediaServer,
        force_mode: str = None,
        actor = None
    ) -> MediaAccountMapping:
        """
        Creates or activates a MediaAccountMapping between a Lounge User and MediaServer.
        Strictly idempotent: multiple calls for the same user and server return the completed mapping.
        """
        mode = self._determine_mode(user, media_server, force_mode)

        with transaction.atomic():
            mapping, created = MediaAccountMapping.objects.get_or_create(
                user=user,
                media_server=media_server,
                defaults={
                    'tenant': getattr(user, 'tenant', None) or media_server.tenant,
                    'external_user_id': '',
                    'external_username': '',
                    'provisioning_mode': mode,
                    'provisioning_status': MediaAccountMapping.ProvisioningStatus.PENDING,
                    'is_active': True,
                }
            )

            # Idempotency check: if already completed and linked, return immediately
            if mapping.provisioning_status == MediaAccountMapping.ProvisioningStatus.COMPLETED and mapping.external_user_id:
                logger.info(f"Mapping for {user.username} on {media_server.name} already completed. Returning cached mapping.")
                return mapping

            if mode == MediaAccountMapping.ProvisioningMode.DISABLED:
                mapping.provisioning_mode = mode
                mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.DISABLED
                mapping.is_active = False
                mapping.save()
                return mapping

            mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.IN_PROGRESS
            mapping.save(update_fields=['provisioning_status'])

        try:
            self._do_provision(user, media_server, mapping, mode, actor)
        except Exception as e:
            logger.error(f"Provisioning failed for user {user.username} on {media_server.name}: {e}", exc_info=True)
            mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.FAILED
            mapping.provisioning_error = str(e)
            mapping.provisioning_attempts += 1
            mapping.save(update_fields=['provisioning_status', 'provisioning_error', 'provisioning_attempts'])
            
            # Audit failure safely
            try:
                AuditLog.objects.create(
                    event_type='media_account.provision_failed',
                    user=user,
                    external_identity_ref=f"{media_server.name}:{mapping.external_username or 'unknown'}",
                    details={
                        'media_server_id': str(media_server.id),
                        'error': str(e),
                        'mode': mode,
                    }
                )
            except Exception:
                pass
            raise

        return mapping

    def _do_provision(self, user, media_server: MediaServer, mapping: MediaAccountMapping, mode: str, actor):
        connector = get_connector(media_server)

        # 1. Generate base external username
        base_username = self._generate_username(user, media_server)

        # 2. Check if user exists on external server
        existing = connector.get_user_by_username(base_username)

        generated_password = None
        if existing:
            logger.info(f"External account '{base_username}' found on {media_server.name}. Linking existing user.")
            mapping.external_user_id = existing.get('Id')
            mapping.external_username = existing.get('Name', base_username)
            mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.COMPLETED
            mapping.last_provisioned_at = timezone.now()
            mapping.sync_status = MediaAccountMapping.SyncStatus.IN_SYNC
            mapping.save()
        elif mode == MediaAccountMapping.ProvisioningMode.MANUAL:
            logger.info(f"Server {media_server.name} set to MANUAL mode. Account not found; marking PENDING.")
            mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.PENDING
            mapping.external_username = base_username
            mapping.provisioning_error = "بانتظار الربط اليدوي من قِبل المشرف أو إنشاء الحساب على السيرفر."
            mapping.save()
            return
        else:
            # AUTO Creation mode
            final_username = self.conflict_resolver.resolve(media_server, base_username, connector)
            generated_password = self._generate_password()

            logger.info(f"Auto-creating user '{final_username}' on {media_server.name}...")
            result = connector.create_user(username=final_username, password=generated_password)

            mapping.external_user_id = result.get('Id')
            mapping.external_username = final_username
            mapping.external_password_encrypted = encrypt_secret(generated_password)
            mapping.provisioning_status = MediaAccountMapping.ProvisioningStatus.COMPLETED
            mapping.last_provisioned_at = timezone.now()
            mapping.sync_status = MediaAccountMapping.SyncStatus.IN_SYNC
            mapping.save()

        # 3. Apply Policy and Library Access
        try:
            policy = self.policy_mapper.build_policy_from_user(user, media_server)
            connector.update_user_policy(mapping.external_user_id, policy)
            mapping.media_server_policy = policy

            if media_server.default_library_ids:
                connector.set_user_libraries(mapping.external_user_id, media_server.default_library_ids)

            mapping.save(update_fields=['media_server_policy'])
        except Exception as policy_err:
            logger.warning(f"Could not apply policy/libraries to user {mapping.external_user_id}: {policy_err}")

        # 4. Audit Log
        try:
            AuditLog.objects.create(
                event_type='media_account.provisioned',
                user=user,
                external_identity_ref=f"{media_server.name}:{mapping.external_username}",
                details={
                    'mapping_id': str(mapping.id),
                    'media_server_id': str(media_server.id),
                    'external_user_id': mapping.external_user_id,
                    'external_username': mapping.external_username,
                    'mode': mode,
                    'actor_id': str(actor.id) if actor else 'SYSTEM',
                }
            )
        except Exception:
            pass

    def _determine_mode(self, user, media_server: MediaServer, force_mode: str = None) -> str:
        if force_mode:
            return force_mode
        return media_server.provisioning_mode or MediaAccountMapping.ProvisioningMode.AUTO

    def _generate_username(self, user, media_server: MediaServer) -> str:
        pattern = media_server.username_pattern or 'LU-{lounge_id}'
        lounge_id_clean = (user.lounge_id or '').replace('LU-', '')
        tenant_code = getattr(getattr(user, 'tenant', None), 'code', '') or 'TNT'
        
        username = pattern.format(
            lounge_id=lounge_id_clean,
            username=user.username,
            user_id=str(user.id)[:8],
            tenant=tenant_code,
        )
        if media_server.username_include_tenant and tenant_code:
            username = f"{tenant_code}-{username}"
        return username

    def _generate_password(self) -> str:
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(24))
