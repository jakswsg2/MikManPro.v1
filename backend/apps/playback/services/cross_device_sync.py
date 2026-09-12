import json
import logging
from django.utils import timezone
from apps.playback.models import WatchHistory

logger = logging.getLogger(__name__)

class CrossDeviceSyncService:
    """
    خدمة مزامنة المشاهدة والاستئناف عبر كافة أجهزة المستخدم (Cross-Device Continue Watching).
    
    القواعد المعمارية:
    - Last-write-wins مع زيادة sync_version في كل عملية حفظ لتفادي التعارض.
    - إرجاع آخر جهاز قام بالمشاهدة (updated_by_device).
    - التخزين المؤقت في Cache/Redis لإشعار الأجهزة النشطة بالتحول الفوري.
    """

    def get_continue_watching(
        self,
        user,
        profile=None,
        limit: int = 20
    ) -> list:
        """
        استرجاع قائمة الاستئناف ومتابعة المشاهدة لجميع أجهزة المستخدم.
        تشمل العناصر التي تم مشاهدة أكثر من 30 ثانية منها ولم تكتمل بعد (أقل من 90%).
        """
        histories = WatchHistory.objects.filter(
            user=user,
            is_completed=False,
            position_seconds__gte=15,
        )

        if profile:
            histories = histories.filter(profile=profile)

        histories = histories.select_related('media_item').order_by('-last_watched_at')[:limit]

        results = []
        for h in histories:
            item = h.media_item
            results.append({
                'watch_history_id': str(h.id),
                'media_item_id': str(item.id),
                'title': item.title,
                'poster_url': getattr(item, 'poster_url', '') or '',
                'backdrop_url': getattr(item, 'backdrop_url', '') or '',
                'position_seconds': h.position_seconds,
                'duration_seconds': h.duration_seconds,
                'completion_percentage': float(h.completion_percentage),
                'last_watched_at': h.last_watched_at.isoformat(),
                'last_device': h.updated_by_device or 'جهاز غير محدد',
                'sync_version': h.sync_version,
            })

        return results

    def sync_position(
        self,
        user,
        media_item,
        position_seconds: int,
        duration_seconds: int = 0,
        device_id: str = None,
        watch_delta_seconds: int = 0,
        preferred_quality: str = None,
        preferred_audio: str = None,
        preferred_subtitle: str = None,
        profile=None
    ) -> dict:
        """
        مزامنة موضع التشغيل من أي جهاز (هاتف، تلفزيون، كمبيوتر).
        """
        history, created = WatchHistory.objects.get_or_create(
            user=user,
            media_item=media_item,
            profile=profile,
            defaults={
                'position_seconds': position_seconds,
                'duration_seconds': duration_seconds,
                'updated_by_device': device_id,
                'sync_version': 1,
                'watch_time_seconds': watch_delta_seconds,
                'preferred_quality': preferred_quality,
                'preferred_audio': preferred_audio,
                'preferred_subtitle': preferred_subtitle,
            }
        )

        if not created:
            history.position_seconds = max(0, position_seconds)
            if duration_seconds > 0:
                history.duration_seconds = duration_seconds
                history.completion_percentage = round((history.position_seconds / float(duration_seconds)) * 100, 2)
                if history.completion_percentage >= 90.0:
                    history.is_completed = True

            if watch_delta_seconds > 0:
                history.watch_time_seconds += watch_delta_seconds

            if preferred_quality:
                history.preferred_quality = preferred_quality
            if preferred_audio:
                history.preferred_audio = preferred_audio
            if preferred_subtitle:
                history.preferred_subtitle = preferred_subtitle

            history.updated_by_device = device_id
            history.sync_version += 1
            history.last_watched_at = timezone.now()
            history.save()

        # بث الموضع للأجهزة الأخرى في الذاكرة المؤقتة (Cache / Redis pub)
        self.broadcast_position(user.id, media_item.id, history.position_seconds, history.sync_version, device_id)

        return {
            'media_item_id': str(media_item.id),
            'position_seconds': history.position_seconds,
            'completion_percentage': float(history.completion_percentage),
            'is_completed': history.is_completed,
            'sync_version': history.sync_version,
            'last_device': history.updated_by_device,
        }

    def broadcast_position(self, user_id, media_item_id, position: int, sync_version: int, device_id: str):
        """
        تسجيل الموضع في التخزين المؤقت لمزامنة اللحظية (Heartbeat / Cross-device).
        """
        try:
            from django.core.cache import cache
            key = f"playback:sync:{user_id}:{media_item_id}"
            cache.set(key, {
                'position': position,
                'sync_version': sync_version,
                'device_id': device_id,
                'timestamp': timezone.now().isoformat(),
            }, timeout=120)
        except Exception as e:
            logger.warning(f"Failed to cache cross-device position broadcast: {e}")
