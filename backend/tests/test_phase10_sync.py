import unittest
from unittest.mock import MagicMock, patch
from tests.django_mock_env import bootstrap_django_env
bootstrap_django_env()
from apps.media_servers.services import MediaServerAccountSyncService

class TestPhase10Sync(unittest.TestCase):
    """
    Tests for Account Synchronization & Orphan User Detection.
    """

    def setUp(self):
        self.sync_service = MediaServerAccountSyncService()

    @patch('apps.media_servers.services.account_sync.get_connector')
    @patch('apps.media_servers.models.MediaAccountMapping.objects.filter')
    @patch('apps.media_servers.models.MediaServerUserSync.objects.create')
    def test_sync_reconciliation_detects_orphans(self, mock_create_sync, mock_filter_mappings, mock_get_connector):
        server = MagicMock()
        server.name = "Test Jellyfin"
        server.tenant = None

        mock_sync_record = MagicMock()
        mock_sync_record.users_checked = 0
        mock_sync_record.users_updated = 0
        mock_sync_record.orphans_found = 0
        mock_sync_record.conflicts_found = 0
        mock_create_sync.return_value = mock_sync_record

        # Remote server has 2 users: user1 (mapped) and rogue_user (orphan)
        connector = MagicMock()
        connector.list_users.return_value = [
            {'Id': 'user-1-id', 'Name': 'LU-00001'},
            {'Id': 'rogue-orphan-id', 'Name': 'UnlinkedGuest'},
        ]
        mock_get_connector.return_value = connector

        # Local database has mapping for user-1-id
        m1 = MagicMock()
        m1.external_user_id = 'user-1-id'
        m1.external_username = 'LU-00001'
        m1.provisioning_status = 'COMPLETED'
        mock_filter_mappings.return_value.select_related.return_value = [m1]

        with patch.object(self.sync_service, '_record_orphan_user') as mock_orphan:
            with patch.object(self.sync_service, '_update_mapping_sync') as mock_update:
                self.sync_service._do_sync(server, mock_sync_record)

                mock_update.assert_called_once()
                mock_orphan.assert_called_once()
                self.assertEqual(mock_sync_record.users_checked, 2)
                self.assertEqual(mock_sync_record.orphans_found, 1)
