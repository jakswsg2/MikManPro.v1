import logging
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Sum, Count
from apps.playback.models import PlaybackQualityLog, PlaybackSession
from apps.playback.constants import QualityEventType

logger = logging.getLogger(__name__)

class PlaybackAnalyticsService:
    """
    خدمة تحليلات المشاهدة وجودة البث (Playback & Quality Analytics).
    - تسجيل تغييرات الجودة (Manual / ABR).
    - تسجيل أحداث التخزين المؤقت (Buffer Underflow / Rebuffer Duration).
    - حساب مؤشرات الأداء الحيوية (QoE / QoS Metrics).
    - استخراج إحصائيات مدة المشاهدة الدقيقة للمستخدم.
    """

    def track_quality_change(
        self,
        playback_session: PlaybackSession,
        new_quality: str,
        reason: str = 'manual',
        buffer_health: float = 0.0,
        bitrate_kbps: int = 0
    ) -> PlaybackQualityLog:
        """تسجيل حدث تبديل جودة العرض."""
        return PlaybackQualityLog.objects.create(
            playback_session=playback_session,
            user=playback_session.user,
            device_id=playback_session.device_id,
            quality=new_quality,
            bitrate_kbps=bitrate_kbps,
            buffer_health_seconds=Decimal(str(round(buffer_health, 2))),
            event_type=QualityEventType.SWITCH,
            metadata={'reason': reason}
        )

    def track_buffer_event(
        self,
        playback_session: PlaybackSession,
        event_type: str,  # BUFFER_START, BUFFER_END
        buffer_duration_seconds: float = 0.0,
        buffer_health: float = 0.0
    ) -> PlaybackQualityLog:
        """تسجيل حدث بدء أو انتهاء التخزين المؤقت."""
        return PlaybackQualityLog.objects.create(
            playback_session=playback_session,
            user=playback_session.user,
            device_id=playback_session.device_id,
            quality=playback_session.current_quality,
            buffer_health_seconds=Decimal(str(round(buffer_health, 2))),
            buffer_duration_seconds=Decimal(str(round(buffer_duration_seconds, 2))),
            event_type=event_type,
        )

    def get_session_quality_stats(self, playback_session: PlaybackSession) -> dict:
        """إحصائيات جودة واستقرار البث لجلسة محددة."""
        logs = PlaybackQualityLog.objects.filter(playback_session=playback_session)

        switches_count = logs.filter(event_type=QualityEventType.SWITCH).count()
        buffer_events_count = logs.filter(event_type=QualityEventType.BUFFER_START).count()
        total_buffering = logs.aggregate(Sum('buffer_duration_seconds'))['buffer_duration_seconds__sum'] or Decimal('0.0')
        avg_buffer_health = logs.aggregate(Avg('buffer_health_seconds'))['buffer_health_seconds__avg'] or Decimal('0.0')

        return {
            'session_id': str(playback_session.id),
            'quality_switches': switches_count,
            'buffer_events': buffer_events_count,
            'total_buffering_seconds': float(total_buffering),
            'avg_buffer_health_seconds': float(round(avg_buffer_health, 2)),
        }

    def get_user_watch_stats(self, user, days: int = 30) -> dict:
        """
        إحصائيات المشاهدة الدقيقة للمستخدم خلال فترة زمنية (افتراضياً آخر 30 يوماً).
        """
        since = timezone.now() - timedelta(days=days)
        sessions = PlaybackSession.objects.filter(
            user=user,
            started_at__gte=since,
        )

        total_watched = sessions.aggregate(Sum('watched_seconds'))['watched_seconds__sum'] or 0
        sessions_count = sessions.count()
        avg_duration = (total_watched / sessions_count) if sessions_count > 0 else 0

        # الجودات الأكثر استخداماً
        quality_breakdown = list(
            sessions.values('current_quality').annotate(count=Count('id')).order_by('-count')
        )

        return {
            'period_days': days,
            'total_watch_time_seconds': total_watched,
            'total_watch_time_hours': round(total_watched / 3600.0, 2),
            'sessions_count': sessions_count,
            'avg_session_duration_minutes': round(avg_duration / 60.0, 1),
            'quality_breakdown': quality_breakdown,
        }
