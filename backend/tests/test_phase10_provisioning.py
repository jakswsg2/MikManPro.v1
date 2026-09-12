import unittest
from unittest.mock import MagicMock, patch
from tests.django_mock_env import bootstrap_django_env
bootstrap_django_env()
from apps.media_servers.models import MediaServer, MediaAccountMapping
from apps.media_servers.services import (
    MediaAccountProvisioningService,
    UsernameConflictResolver,
    PolicyMappingService,
)
from apps.core.crypto import encrypt_secret, decrypt_secret

class TestPhase10Provisioning(unittest.TestCase):
    """
    Tests for Phase 10 User Account Provisioning & Encryption.
    """

    def setUp(self):
        self.provisioner = MediaAccountProvisioningService()

    def test_fernet_crypto_encryption_and_decryption(self):
        secret_password = "UltraSecurePassword2026!#$%"
        encrypted_bytes = encrypt_secret(secret_password)
        self.assertIsInstance(encrypted_bytes, (bytes, str))
        self.assertNotEqual(encrypted_bytes, secret_password.encode('utf-8'))

        decrypted = decrypt_secret(encrypted_bytes)
        self.assertEqual(decrypted, secret_password)

    def test_username_generation(self):
        user = MagicMock()
        user.lounge_id = "LU-00045"
        user.username = "tariq"
        user.id = "c3f81e3a-1234-5678-90ab-cdef12345678"
        user.tenant = None

        server = MagicMock()
        server.username_pattern = "LU-{lounge_id}"
        server.username_include_tenant = False

        username = self.provisioner._generate_username(user, server)
        self.assertEqual(username, "LU-00045")

    def test_conflict_resolution_with_increments(self):
        server = MagicMock()
        server.name = "LAN Jellyfin"
        connector = MagicMock()

        # Simulate base exists, -2 exists, -3 is available
        def mock_get_user(name):
            if name in ["LU-00045", "LU-00045-2"]:
                return {'Id': '123', 'Name': name}
            return None

        connector.get_user_by_username.side_effect = mock_get_user
        resolver = UsernameConflictResolver()

        resolved = resolver.resolve(server, "LU-00045", connector=connector)
        self.assertEqual(resolved, "LU-00045-3")

    def test_policy_mapping_kids_profile(self):
        user = MagicMock()
        profile = MagicMock()
        profile.code = "KIDS_PROFILE"
        user.active_profile = profile
        user.is_superuser = False

        server = MagicMock()
        server.default_policy = {}
        server.default_library_ids = ['lib-cartoons-1']

        mapper = PolicyMappingService()
        policy = mapper.build_policy_from_user(user, server)

        self.assertEqual(policy.get('MaxParentalRating'), 7)
        self.assertIn('horror', policy.get('BlockedTags', []))
        self.assertFalse(policy.get('EnableAllFolders'))
        self.assertIn('lib-cartoons-1', policy.get('EnabledFolders', []))

    def test_policy_mapping_admin_superuser(self):
        user = MagicMock()
        user.active_profile = None
        user.is_superuser = True

        server = MagicMock()
        server.default_policy = {}
        server.default_library_ids = []

        mapper = PolicyMappingService()
        policy = mapper.build_policy_from_user(user, server)

        self.assertTrue(policy.get('IsAdministrator'))
        self.assertTrue(policy.get('EnableAllFolders'))
