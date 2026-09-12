import unittest
from unittest.mock import MagicMock, patch
from tests.django_mock_env import bootstrap_django_env
bootstrap_django_env()
from apps.media_servers.services import MediaAccountLifecycleService

class TestPhase10Lifecycle(unittest.TestCase):
    """
    Tests for User Lifecycle Signals & Media Account Reactions.
    """

    def setUp(self):
        self.lifecycle = MediaAccountLifecycleService()

    @patch('apps.media_servers.models.MediaAccountMapping.objects.filter')
    def test_subscription_expired_disables_accounts(self, mock_filter):
        user = MagicMock()
        user.username = "tariq"

        m1 = MagicMock()
        m1.id = "map-1"
        m1.external_username = "LU-00045"
        m1.media_server.name = "LAN Jellyfin"
        m1.media_server.auto_disable_on_subscription_expire = True

        mock_filter.return_value = [m1]

        with patch.object(self.lifecycle.deprovisioning_service, 'disable_account') as mock_disable:
            self.lifecycle.on_subscription_expired(user)
            mock_disable.assert_called_once_with(m1, reason="subscription_expired")

    @patch('apps.media_servers.models.MediaAccountMapping.objects.filter')
    def test_subscription_activated_enables_accounts(self, mock_filter):
        user = MagicMock()
        user.username = "tariq"

        m1 = MagicMock()
        m1.id = "map-1"
        m1.external_username = "LU-00045"
        m1.media_server.name = "LAN Jellyfin"

        mock_filter.return_value = [m1]

        with patch.object(self.lifecycle.deprovisioning_service, 'enable_account') as mock_enable:
            self.lifecycle.on_subscription_activated(user)
            mock_enable.assert_called_once_with(m1)
