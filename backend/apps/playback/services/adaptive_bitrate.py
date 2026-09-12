import logging
from apps.playback.models import DevicePlayerPreference
from apps.playback.constants import PlaybackQuality

logger = logging.getLogger(__name__)

class AdaptiveBitrateService:
    """
    خدمة Adaptive Bitrate (ABR).
    
    تختار وتعدل جودة البث تلقائياً وديناميكياً بناءً على:
    - تفضيلات الجهاز (DevicePlayerPreference) إن وجدت وكانت محددة صراحة.
    - وضع توفير البيانات (Data Saver Mode) الذي يمنع 4K ويحد البث إلى 720p/480p.
    - قياسات سرعة الشبكة الحالية (Network Speed in kbps).
    - صحة الذاكرة المؤقتة (Buffer Health بالثواني).
    - سقف اشتراك المستخدم (Subscription Max Quality).
    - الجودات المتوفرة فعلياً في مصدر الوسائط (MediaSource).
    """

    QUALITY_HIERARCHY = ['480p', '720p', '1080p', '4K']

    SPEED_THRESHOLDS = [
        (15000, '4K'),     # >= 15 Mbps
        (6000, '1080p'),   # >= 6 Mbps
        (2500, '720p'),    # >= 2.5 Mbps
        (0, '480p'),       # Fallback
    ]

    def select_initial_quality(
        self,
        user,
        device_id: str = None,
        media_source = None,
        network_speed_kbps: int = None,
        max_user_allowed_quality: str = '4K'
    ) -> str:
        """
        اختيار الجودة الأولية عند فتح المشغل:
        1. Device Preference (إن وُجدت وليست AUTO).
        2. فحص وضع توفير البيانات (Data Saver).
        3. سقف اشتراك المستخدم (User Subscription).
        4. سرعة الشبكة الفعلية المقاسة من العميل.
        5. الجودات المتاحة في المصدر.
        6. الافتراضي الآمن: 720p.
        """
        device_pref = None
        if user and user.is_authenticated and device_id:
            try:
                device_pref = DevicePlayerPreference.objects.filter(
                    user=user, device_id=device_id
                ).first()
            except Exception:
                device_pref = None

        # 1. إذا كان لدى المستخدم تفضيل صريح ليس AUTO
        if device_pref and device_pref.default_quality != PlaybackQuality.AUTO:
            preferred = device_pref.default_quality
            if self._is_quality_available(preferred, media_source):
                return preferred

        # 2. سقف الجودة المسموح به للمستخدم
        max_allowed = max_user_allowed_quality or '4K'

        # 3. وضع توفير البيانات (Data Saver Mode)
        if device_pref and device_pref.data_saver_mode:
            max_allowed = self._min_quality(max_allowed, '720p')

        # 4. إذا حدد الجهاز سقفاً أقصى (Max Quality)
        if device_pref and device_pref.max_quality != PlaybackQuality.AUTO:
            max_allowed = self._min_quality(max_allowed, device_pref.max_quality)

        # 5. قياس سرعة الشبكة (Network Speed)
        if network_speed_kbps is not None and network_speed_kbps > 0:
            speed_quality = self._quality_from_speed(network_speed_kbps)
            max_allowed = self._min_quality(max_allowed, speed_quality)

        # 6. الجودات المتاحة فعلياً
        available = self._get_available_qualities(media_source)

        # 7. اختيار أفضل جودة متوافقة من الأعلى للأسفل
        for q in reversed(self.QUALITY_HIERARCHY):
            if q in available and self._quality_lte(q, max_allowed):
                return q

        return available[0] if available else '720p'

    def adjust_for_buffer(
        self,
        current_quality: str,
        buffer_health_seconds: float,
        available_qualities: list = None,
        data_saver_mode: bool = False
    ) -> str:
        """
        تعديل الجودة أثناء البث بناءً على صحة الذاكرة المؤقتة (Buffer Health):
        - Buffer < 5 ثوانٍ: خطر التقطيع -> خفض تدريجي للجودة (Downgrade).
        - Buffer > 30 ثانية: اتصال ممتاز وثابت -> رفع تدريجي للجودة (Upgrade).
        """
        avail = available_qualities or self.QUALITY_HIERARCHY

        if buffer_health_seconds < 5.0:
            return self._downgrade(current_quality, avail)
        elif buffer_health_seconds > 30.0:
            candidate = self._upgrade(current_quality, avail)
            if data_saver_mode and self._quality_gt(candidate, '720p'):
                return current_quality
            return candidate

        return current_quality

    def _quality_from_speed(self, speed_kbps: int) -> str:
        for threshold, quality in self.SPEED_THRESHOLDS:
            if speed_kbps >= threshold:
                return quality
        return '480p'

    def _get_available_qualities(self, media_source) -> list:
        if not media_source:
            return list(self.QUALITY_HIERARCHY)
        # إذا كان المصدر يحدد جودات أو دقة
        resolution = getattr(media_source, 'resolution', None)
        if resolution:
            res_str = str(resolution).lower()
            if '4k' in res_str or '2160' in res_str:
                return ['480p', '720p', '1080p', '4K']
            elif '1080' in res_str:
                return ['480p', '720p', '1080p']
            elif '720' in res_str:
                return ['480p', '720p']
        return list(self.QUALITY_HIERARCHY)

    def _is_quality_available(self, quality: str, media_source) -> bool:
        avail = self._get_available_qualities(media_source)
        return quality in avail

    def _quality_index(self, quality: str) -> int:
        clean_q = quality.replace('Q_', '')
        try:
            return self.QUALITY_HIERARCHY.index(clean_q)
        except ValueError:
            return 1  # 720p default index

    def _quality_lte(self, q1: str, q2: str) -> bool:
        return self._quality_index(q1) <= self._quality_index(q2)

    def _quality_gt(self, q1: str, q2: str) -> bool:
        return self._quality_index(q1) > self._quality_index(q2)

    def _min_quality(self, q1: str, q2: str) -> str:
        idx1 = self._quality_index(q1)
        idx2 = self._quality_index(q2)
        return self.QUALITY_HIERARCHY[min(idx1, idx2)]

    def _downgrade(self, current: str, available: list) -> str:
        curr_idx = self._quality_index(current)
        for idx in range(curr_idx - 1, -1, -1):
            q = self.QUALITY_HIERARCHY[idx]
            if q in available:
                return q
        return current

    def _upgrade(self, current: str, available: list) -> str:
        curr_idx = self._quality_index(current)
        for idx in range(curr_idx + 1, len(self.QUALITY_HIERARCHY)):
            q = self.QUALITY_HIERARCHY[idx]
            if q in available:
                return q
        return current
