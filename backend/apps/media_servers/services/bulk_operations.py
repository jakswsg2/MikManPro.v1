import secrets
import string
import logging
from typing import List, Dict, Any
from apps.media_servers.models import MediaAccountMapping, MediaServer
from apps.accounts.models import User, AuditLog
from apps.media_servers.connectors import get_connector
from apps.core.crypto import encrypt_secret
from .provisioning import MediaAccountProvisioningService
from .deprovisioning import MediaAccountDeprovisioningService
from .policy_mapping import PolicyMappingService

logger = logging.getLogger(__name__)

class BulkAccountService:
    """
    Executes batch operations on Media Server accounts:
    - Bulk Provisioning
    - Bulk Suspension / Activation
    - Bulk Policy Refresh
    - Bulk Password Rotation
    """

    def __init__(self):
        self.provisioner = MediaAccountProvisioningService()
        self.deprovisioner = MediaAccountDeprovisioningService()
        self.policy_mapper = PolicyMappingService()

    def bulk_provision(self, user_ids: List[str], media_server_id: str, actor=None) -> Dict[str, Any]:
        server = MediaServer.objects.get(id=media_server_id)
        users = User.objects.filter(id__in=user_ids)
        successes = []
        failures = []

        for u in users:
            try:
                mapping = self.provisioner.provision_for_user(u, server, actor=actor)
                successes.append({
                    'user_id': str(u.id),
                    'username': u.username,
                    'external_username': mapping.external_username,
                    'status': mapping.provisioning_status,
                })
            except Exception as e:
                failures.append({
                    'user_id': str(u.id),
                    'username': u.username,
                    'error': str(e)
                })

        return {
            'total': len(user_ids),
            'success_count': len(successes),
            'failure_count': len(failures),
            'successes': successes,
            'failures': failures
        }

    def bulk_disable(self, mapping_ids: List[str], reason: str = "Admin bulk disable", actor=None) -> Dict[str, Any]:
        mappings = MediaAccountMapping.objects.filter(id__in=mapping_ids).select_related('media_server', 'user')
        disabled = []
        errors = []

        for m in mappings:
            try:
                self.deprovisioner.disable_account(m, reason=reason, actor=actor)
                disabled.append(str(m.id))
            except Exception as e:
                errors.append({'id': str(m.id), 'error': str(e)})

        return {
            'total': len(mapping_ids),
            'disabled_count': len(disabled),
            'error_count': len(errors),
            'disabled': disabled,
            'errors': errors
        }

    def bulk_apply_policy(self, mapping_ids: List[str], policy_override: Dict[str, Any] = None, actor=None) -> Dict[str, Any]:
        mappings = MediaAccountMapping.objects.filter(id__in=mapping_ids, is_active=True).select_related('media_server', 'user')
        updated = []
        errors = []

        for m in mappings:
            try:
                connector = get_connector(m.media_server)
                policy = self.policy_mapper.build_policy_from_user(m.user, m.media_server)
                if policy_override:
                    policy.update(policy_override)

                connector.update_user_policy(m.external_user_id, policy)
                m.media_server_policy = policy
                m.save(update_fields=['media_server_policy'])
                updated.append(str(m.id))
            except Exception as e:
                errors.append({'id': str(m.id), 'error': str(e)})

        return {
            'total': len(mapping_ids),
            'updated_count': len(updated),
            'error_count': len(errors),
            'updated': updated,
            'errors': errors
        }

    def bulk_reset_passwords(self, mapping_ids: List[str], actor=None) -> Dict[str, Any]:
        mappings = MediaAccountMapping.objects.filter(id__in=mapping_ids, is_active=True).select_related('media_server', 'user')
        reset_list = []
        errors = []
        alphabet = string.ascii_letters + string.digits + "!@#$*"

        for m in mappings:
            try:
                new_pw = ''.join(secrets.choice(alphabet) for _ in range(24))
                connector = get_connector(m.media_server)
                connector.update_user_password(m.external_user_id, new_pw)
                m.external_password_encrypted = encrypt_secret(new_pw)
                m.save(update_fields=['external_password_encrypted'])
                reset_list.append({
                    'mapping_id': str(m.id),
                    'username': m.external_username,
                    'new_password': new_pw
                })
            except Exception as e:
                errors.append({'id': str(m.id), 'error': str(e)})

        return {
            'total': len(mapping_ids),
            'reset_count': len(reset_list),
            'error_count': len(errors),
            'resets': reset_list,
            'errors': errors
        }
