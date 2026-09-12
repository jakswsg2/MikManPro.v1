import os
import sys
import unittest
from unittest.mock import MagicMock

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from tests.django_mock_env import bootstrap_django_env
bootstrap_django_env()

from apps.playback.services.adaptive_bitrate import AdaptiveBitrateService
from apps.playback.services.subtitle import SubtitleService
from apps.playback.services.external_player import ExternalPlayerLauncher
from apps.playback.services.casting import CastingService
from apps.playback.services.intro_detection import IntroDetectionService
from apps.playback.services.next_episode import NextEpisodeService

class PlaybackPhase13Tests(unittest.TestCase):

    def setUp(self):
        self.user = MagicMock()
        self.user.id = 1
        self.user.username = 'ahmed_viewer'
        self.user.is_authenticated = True
        self.user.tenant = None

        self.media_item = MagicMock()
        self.media_item.id = '99999999-9999-9999-9999-999999999999'
        self.media_item.title = 'Inception (2010)'
        self.media_item.duration_minutes = 148
        self.media_item.overview = 'A thief who steals corporate secrets through dream-sharing...'
        self.media_item.poster_url = 'https://example.com/poster.jpg'
        self.media_item.subtitle_languages = ['ar', 'en']
        self.media_item.tags = ['intro:120:180']
        self.media_item.provider_ids = {}

    def test_adaptive_bitrate_selection(self):
        service = AdaptiveBitrateService()

        # High speed should select 4K
        q_4k = service.select_initial_quality(
            user=self.user,
            network_speed_kbps=20000,
            max_user_allowed_quality='4K'
        )
        self.assertEqual(q_4k, '4K')

        # Medium speed should select 1080p
        q_1080 = service.select_initial_quality(
            user=self.user,
            network_speed_kbps=8000,
            max_user_allowed_quality='4K'
        )
        self.assertEqual(q_1080, '1080p')

        # Low speed should select 480p
        q_low = service.select_initial_quality(
            user=self.user,
            network_speed_kbps=1500,
            max_user_allowed_quality='4K'
        )
        self.assertEqual(q_low, '480p')

    def test_adaptive_bitrate_buffer_adjust(self):
        service = AdaptiveBitrateService()

        # Low buffer health (< 5s) triggers downgrade
        downgraded = service.adjust_for_buffer('1080p', buffer_health_seconds=3.0)
        self.assertEqual(downgraded, '720p')

        # High buffer health (> 30s) triggers upgrade
        upgraded = service.adjust_for_buffer('720p', buffer_health_seconds=35.0)
        self.assertEqual(upgraded, '1080p')

    def test_subtitle_srt_to_vtt_conversion(self):
        service = SubtitleService()
        sample_srt = (
            "1\n"
            "00:00:01,000 --> 00:00:04,000\n"
            "مرحباً بكم في Smart Lounge\n\n"
            "2\n"
            "00:00:05,250 --> 00:00:09,800\n"
            "نتمنى لكم مشاهدة ممتعة\n"
        )
        vtt = service.convert_srt_to_vtt(sample_srt)
        self.assertTrue(vtt.startswith('WEBVTT'))
        self.assertIn('00:00:01.000 --> 00:00:04.000', vtt)
        self.assertIn('00:00:05.250 --> 00:00:09.800', vtt)
        self.assertIn('مرحباً بكم في Smart Lounge', vtt)

    def test_external_player_launch(self):
        launcher = ExternalPlayerLauncher()
        result = launcher.launch(
            user=self.user,
            media_item=self.media_item,
            player='vlc',
            platform='windows'
        )
        self.assertEqual(result['player'], 'vlc')
        self.assertIn('vlc://', result['deep_link'])
        self.assertIn('token=', result['stream_url'])
        self.assertTrue('instructions_ar' in result)

    def test_casting_service(self):
        caster = CastingService()
        cast_data = caster.prepare_cast_session(
            user=self.user,
            media_item=self.media_item,
            cast_device_id='tv-living-room',
            cast_device_name='Samsung OLED TV'
        )
        self.assertIn('stream_url', cast_data)
        self.assertIn('token=', cast_data['stream_url'])
        self.assertEqual(cast_data['content_type'], 'application/x-mpegURL')
        self.assertEqual(cast_data['metadata']['title'], 'Inception (2010)')

    def test_intro_marker_detection(self):
        service = IntroDetectionService()
        intro = service.get_intro_range(self.media_item)
        self.assertIsNotNone(intro)
        self.assertEqual(intro['start_seconds'], 120)
        self.assertEqual(intro['end_seconds'], 180)
        self.assertEqual(intro['duration_seconds'], 60)

if __name__ == '__main__':
    unittest.main()
