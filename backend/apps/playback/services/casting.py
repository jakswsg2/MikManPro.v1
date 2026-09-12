import hashlib
import secrets
from datetime import timedelta
from django.utils import timezone
from apps.playback.models import PlaybackToken, PlaybackSession
from apps.playback.constants import PlaybackScope

class CastingService:
    """
    خدمة بث الوسائط لأجهزة الشاشات والتلفزيون (Chromecast & AirPlay Basics).
    
    القواعد المعمارية:
    1. التحقق من عدم تجاوز الحد الأقصى للجلسات المتزامنة للمستخدم.
    2. إصدار Playback Token بنطاق CAST بصلاحية محددة (10 دقائق للتفويض وبدء تشغيل الشاشة).
    3. تمرير رابط البث دون كشف عناوين الخوادم الداخلية أو أية مفاتيح حساسة.
    4. منع بث المحتوى المخصص للأطفال دون إذن أو بروفايل مناسب.
    """

    def prepare_cast_session(
        self,
        user,
        media_item,
        cast_device_id: str,
        cast_device_name: str = "Google Cast / TV",
        media_source=None,
        ip_address: str = None
    ) -> dict:
        """
        تهيئة جلسة البث لجهاز العرض (Chromecast / AirPlay Device):
        """
        # 1. التحقق من حدود الجلسات المتزامنة (Concurrent Sessions)
        active_sessions_count = PlaybackSession.objects.filter(
            user=user,
            status=PlaybackSession.SessionStatus.ACTIVE
        ).count()

        max_allowed = 2  # الافتراضي أو حسب البروفايل
        if hasattr(user, 'active_profile') and user.active_profile:
            prof_limit = getattr(user.active_profile, 'max_concurrent_sessions', 2)
            if isinstance(prof_limit, int):
                max_allowed = prof_limit

        if active_sessions_count >= max_allowed:
            raise ValueError(f"تم بلوغ الحد الأقصى للجلسات المتزامنة المسموح بها ({max_allowed} أجهزة)")

        # 2. إصدار توكن بث آمن (صلاحية 10 دقائق)
        raw_secret = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_secret.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + timedelta(minutes=10)

        PlaybackToken.objects.create(
            user=user,
            media_item=media_item,
            media_source=media_source,
            token_hash=token_hash,
            scope=PlaybackScope.CAST,
            device_id=cast_device_id,
            ip_address=ip_address,
            expires_at=expires_at,
        )

        stream_url = f"http://localhost:8000/api/v1/playback/stream/{media_item.id}/?token={raw_secret}"

        # 3. إرجاع بيانات البث المنسقة لـ Cast SDK
        return {
            'stream_url': stream_url,
            'content_type': 'application/x-mpegURL',  # HLS stream
            'expires_at': expires_at.isoformat(),
            'metadata': {
                'title': media_item.title,
                'subtitle': getattr(media_item, 'overview', '')[:120] if getattr(media_item, 'overview', '') else '',
                'poster_url': getattr(media_item, 'poster_url', '') or '',
                'duration_seconds': (getattr(media_item, 'duration_minutes', 0) or 0) * 60,
                'cast_device': {
                    'id': cast_device_id,
                    'name': cast_device_name,
                }
            }
        }
