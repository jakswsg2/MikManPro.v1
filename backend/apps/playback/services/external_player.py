import hashlib
import secrets
import urllib.parse
from datetime import timedelta
from django.utils import timezone
from apps.playback.models import PlaybackToken
from apps.playback.constants import PlaybackScope

class ExternalPlayerLauncher:
    """
    خدمة تشغيل الوسائط عبر المشغلات الخارجية المتقدمة (External Players Deep Integration).
    تدعم: VLC, Infuse, Kodi, MX Player, IINA, nPlayer.
    
    القواعد الأمنية الصارمة:
    1. إصدار Playback Token مشفر وقصير الأجل جداً (60 ثانية للفتح فقط).
    2. عدم كشف عناوين الخوادم الحقيقية أو بيانات الاعتماد السرية.
    3. إنشاء Deep Link متوافق بدقة مع نظام التشغيل (Android Intents, iOS URL Schemes, Desktop).
    """

    PLAYERS = {
        'vlc': {
            'name': 'VLC Media Player',
            'platforms': ['windows', 'macos', 'linux', 'android', 'ios'],
            'url_scheme': 'vlc://',
            'ios_scheme': 'vlc-x-callback://x-callback-url/stream?url=',
            'instructions_ar': 'سيتم فتح الرابط مباشرة في مشغل VLC. إذا لم يعمل، انسخ الرابط الموقّع والصقه في Open Network Stream.',
            'instructions_en': 'Link will open in VLC. If it fails to launch, copy and paste the signed stream URL into Open Network Stream.',
        },
        'infuse': {
            'name': 'Infuse Pro',
            'platforms': ['ios', 'macos', 'tvos'],
            'url_scheme': 'infuse://x-callback-url/play?url=',
            'ios_scheme': 'infuse://x-callback-url/play?url=',
            'instructions_ar': 'فتح المشاهدة مباشرة بجودة فائقة و HDR عبر تطبيق Infuse على Apple.',
            'instructions_en': 'Open directly in Infuse with full HDR and spatial audio playback.',
        },
        'kodi': {
            'name': 'Kodi Home Theater',
            'platforms': ['windows', 'macos', 'linux', 'android'],
            'url_scheme': 'kodi://',
            'instructions_ar': 'استخدم الرابط الموقّع داخل قائمة Play URL أو إضافة Smart Lounge في Kodi.',
            'instructions_en': 'Play via Kodi Play URL or Smart Lounge addon.',
        },
        'mx_player': {
            'name': 'MX Player',
            'platforms': ['android'],
            'url_scheme': 'intent:...',
            'instructions_ar': 'سيتم إرسال أمر تشغيل فوري مع تسريع العتاد HW+ إلى تطبيق MX Player.',
            'instructions_en': 'Direct hardware-accelerated playback in MX Player.',
        },
        'iina': {
            'name': 'IINA Player',
            'platforms': ['macos'],
            'url_scheme': 'iina://weblink?url=',
            'instructions_ar': 'مشغل IINA الحديث المخصص لنظام macOS.',
            'instructions_en': 'Modern video player designed natively for macOS.',
        },
        'nplayer': {
            'name': 'nPlayer',
            'platforms': ['ios', 'android'],
            'url_scheme': 'nplayer-http://',
            'instructions_ar': 'مشغل nPlayer مع دعم كامل للترجمات والصوت المحيطي.',
            'instructions_en': 'Powerful mobile player with DTS and Dolby support.',
        },
    }

    def launch(
        self,
        user,
        media_item,
        media_source=None,
        player: str = 'vlc',
        device_id: str = None,
        platform: str = 'web',
        ip_address: str = None
    ) -> dict:
        """
        إصدار رابط التشغيل الموجه للمشغل الخارجي مع التحقق الأمني:
        """
        player_key = player.lower().strip()
        player_config = self.PLAYERS.get(player_key)
        if not player_config:
            raise ValueError(f"المشغل الخارجي '{player}' غير مدعوم حالياً")

        # 1. إنشاء توكن مشفر قصير الأجل (60 ثانية)
        raw_secret = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_secret.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + timedelta(seconds=60)

        PlaybackToken.objects.create(
            user=user,
            media_item=media_item,
            media_source=media_source,
            token_hash=token_hash,
            scope=PlaybackScope.EXTERNAL,
            device_id=device_id,
            ip_address=ip_address,
            expires_at=expires_at,
        )

        # 2. بناء رابط البث الآمن الموقّع
        stream_url = self._build_stream_url(raw_secret, media_item.id)

        # 3. بناء الـ Deep Link بحسب المنصة والمشغل
        deep_link = self._build_deep_link(player_config, platform.lower(), stream_url)

        return {
            'player': player_key,
            'player_name': player_config['name'],
            'deep_link': deep_link,
            'stream_url': stream_url,
            'expires_at': expires_at.isoformat(),
            'instructions_ar': player_config['instructions_ar'],
            'instructions_en': player_config['instructions_en'],
        }

    def _build_stream_url(self, token: str, media_item_id) -> str:
        # رابط API الموحد لتفويض وبث الوسائط للمشغلات الخارجية
        return f"http://localhost:8000/api/v1/playback/stream/{media_item_id}/?token={token}"

    def _build_deep_link(self, config: dict, platform: str, stream_url: str) -> str:
        encoded_url = urllib.parse.quote(stream_url, safe='')

        if platform == 'ios' and config.get('ios_scheme'):
            return config['ios_scheme'] + encoded_url
        elif platform == 'android':
            if config.get('url_scheme') == 'intent:...':
                # Android Intent لـ MX Player
                return (
                    f"intent:{stream_url}#Intent;"
                    f"package=com.mxtech.videoplayer.ad;"
                    f"type=video/*;"
                    f"end"
                )
            scheme = config.get('url_scheme', '')
            return scheme + encoded_url if scheme else stream_url
        else:
            scheme = config.get('url_scheme', '')
            return scheme + encoded_url if scheme else stream_url
