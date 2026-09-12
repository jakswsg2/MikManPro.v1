import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import TimeStampedUUIDModel
from apps.tenancy.models import Tenant
from apps.content.models import MediaItem, MediaSource
from apps.playback.constants import (
    PlaybackMethod, PlaybackQuality, SubtitleSize,
    SubtitlePosition, SubtitleFormat, QualityEventType,
    WatchPartyStatus, WatchPartyRole, PlaybackScope
)

# =============================================================================
# 0. Core Playback Models: PlaybackToken & PlaybackSession (from Phase 6)
# =============================================================================

class PlaybackToken(TimeStampedUUIDModel):
    """
    توكن تشغيل آمن ومحدود الصلاحية (HMAC/Ephemeral Secure Playback Token).
    يدعم النطاقات: المتصفح، المشغلات الخارجية (VLC, Infuse)، وأجهزة الكاست.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='playback_tokens',
        verbose_name="المستخدم"
    )
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name='playback_tokens',
        verbose_name="عنصر الوسائط"
    )
    media_source = models.ForeignKey(
        MediaSource,
        on_delete=models.CASCADE,
        related_name='playback_tokens',
        null=True,
        blank=True,
        verbose_name="مصدر الوسائط الفيزيائي"
    )
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        verbose_name="تجزئة التوكن (SHA-256)"
    )
    scope = models.CharField(
        max_length=20,
        choices=PlaybackScope.choices,
        default=PlaybackScope.BROWSER,
        verbose_name="نطاق التوكن"
    )
    device_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="معرف الجهاز"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="عنوان IP المصرح له"
    )
    expires_at = models.DateTimeField(
        db_index=True,
        verbose_name="تاريخ ووقت انتهاء الصلاحية"
    )
    is_used = models.BooleanField(
        default=False,
        verbose_name="تم الاستخدام"
    )
    used_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت الاستخدام"
    )

    class Meta:
        verbose_name = "توكن تشغيل آمن (Playback Token)"
        verbose_name_plural = "توكنات التشغيل الآمنة"
        indexes = [
            models.Index(fields=['user', 'expires_at']),
            models.Index(fields=['token_hash']),
        ]

    def __str__(self):
        return f"Token({self.scope}): User {self.user_id} - Item {self.media_item_id}"

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at


class PlaybackSession(TimeStampedUUIDModel):
    """
    جلسة تشغيل نشطة ومراقبة (Active Playback Session).
    تتتبع النبض الدوري (Heartbeat) كل 30 ثانية ومدة المشاهدة الفعلية.
    """
    class SessionStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'نشطة (Active)'
        PAUSED = 'PAUSED', 'موقوفة مؤقتاً (Paused)'
        ENDED = 'ENDED', 'منتهية (Ended)'
        IDLE = 'IDLE', 'خاملة (Idle)'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='playback_sessions',
        verbose_name="المستخدم"
    )
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name='playback_sessions',
        verbose_name="عنصر الوسائط"
    )
    media_source = models.ForeignKey(
        MediaSource,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='playback_sessions',
        verbose_name="المصدر الفيزيائي"
    )
    device_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="معرف الجهاز"
    )
    device_name = models.CharField(
        max_length=150,
        blank=True,
        default="جهاز غير معروف",
        verbose_name="اسم أو طراز الجهاز"
    )
    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.ACTIVE,
        db_index=True,
        verbose_name="حالة الجلسة"
    )
    started_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="وقت بدء المشاهدة"
    )
    last_heartbeat_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="تاريخ آخر نبض (Heartbeat)"
    )
    ended_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت إنهاء الجلسة"
    )
    current_position_seconds = models.IntegerField(
        default=0,
        verbose_name="الموضع الحالي بالثواني"
    )
    duration_seconds = models.IntegerField(
        default=0,
        verbose_name="المدة الكلية للعنصر بالثواني"
    )
    watched_seconds = models.IntegerField(
        default=0,
        verbose_name="مدة المشاهدة الفعلية بالثواني"
    )
    current_quality = models.CharField(
        max_length=20,
        default='AUTO',
        verbose_name="الجودة الحالية"
    )
    playback_method = models.CharField(
        max_length=30,
        choices=PlaybackMethod.choices,
        default=PlaybackMethod.DIRECT_STREAM,
        verbose_name="طريقة البث"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية إضافية"
    )

    class Meta:
        verbose_name = "جلسة تشغيل (Playback Session)"
        verbose_name_plural = "جلسات التشغيل المراقبة"
        indexes = [
            models.Index(fields=['user', 'status', '-last_heartbeat_at']),
            models.Index(fields=['device_id', 'status']),
        ]

    def __str__(self):
        return f"Session({self.id}): User {self.user_id} - {self.media_item.title} [{self.status}]"


# =============================================================================
# ■ 1. نموذج WatchHistory المحدث (Cross-Device & Precise Watch Tracking)
# =============================================================================

class WatchHistory(TimeStampedUUIDModel):
    """
    سجل المشاهدة والاستئناف المحدث (Cross-Device Watch History).
    يدعم تتبع مدة المشاهدة الدقيقة، أحداث التخزين المؤقت، تبديل الجودة،
    المزامنة متعددة الأجهزة (Sync Version)، والمشاهدة المتزامنة.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='watch_histories',
        verbose_name="المستخدم"
    )
    profile = models.ForeignKey(
        'profiles.Profile',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='watch_histories',
        verbose_name="البروفايل العائلي / الشخصي"
    )
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name='watch_histories',
        verbose_name="عنصر الوسائط"
    )
    device_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="معرف الجهاز الأخير"
    )
    position_seconds = models.IntegerField(
        default=0,
        verbose_name="موضع التوقف الحالي (بالثواني)"
    )
    duration_seconds = models.IntegerField(
        default=0,
        verbose_name="إجمالي مدة العنصر (بالثواني)"
    )
    completion_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        verbose_name="نسبة الإكمال المئوية"
    )
    is_completed = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="هل اكتملت المشاهدة (>= 90%)"
    )
    last_watched_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        verbose_name="تاريخ ووقت آخر مشاهدة"
    )

    # الحقول الجديدة لـ Phase 13:
    playback_method = models.CharField(
        max_length=30,
        choices=PlaybackMethod.choices,
        default=PlaybackMethod.DIRECT_STREAM,
        verbose_name="طريقة التشغيل الأخيرة"
    )
    preferred_quality = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name="الجودة المفضلة أثناء المشاهدة"
    )
    preferred_audio = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="المسار الصوتي المفضل"
    )
    preferred_subtitle = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="ملف الترجمة المفضل"
    )
    watch_time_seconds = models.IntegerField(
        default=0,
        verbose_name="إجمالي وقت المشاهدة الفعلي المقضي (دقيق)"
    )
    buffer_events_count = models.IntegerField(
        default=0,
        verbose_name="عدد مرات التخزين المؤقت (Buffer Events)"
    )
    quality_switches_count = models.IntegerField(
        default=0,
        verbose_name="عدد مرات تبديل الجودة"
    )
    last_playback_session_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="معرف جلسة التشغيل الأخيرة"
    )
    sync_version = models.IntegerField(
        default=1,
        db_index=True,
        verbose_name="إصدار المزامنة عبر الأجهزة (Sync Version)"
    )
    updated_by_device = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        verbose_name="الجهاز الأخير المحدّث للموضع"
    )

    class Meta:
        verbose_name = "سجل مشاهدة واستئناف (Watch History)"
        verbose_name_plural = "سجلات المشاهدة والاستئناف"
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'profile', 'media_item'],
                name='unique_user_profile_media_watch'
            )
        ]
        indexes = [
            models.Index(fields=['user', 'profile', '-last_watched_at']),
            models.Index(fields=['sync_version']),
            models.Index(fields=['media_item', 'is_completed']),
        ]
        ordering = ['-last_watched_at']

    def __str__(self):
        return f"WatchHistory: User {self.user_id} - {self.media_item_id} @ {self.position_seconds}s (v{self.sync_version})"

    def update_progress(self, position: int, duration: int, device_id: str = None, watch_delta: int = 0):
        self.position_seconds = max(0, position)
        if duration > 0:
            self.duration_seconds = duration
            self.completion_percentage = round((self.position_seconds / float(duration)) * 100, 2)
            if self.completion_percentage >= 90.0:
                self.is_completed = True
        if watch_delta > 0:
            self.watch_time_seconds += watch_delta
        if device_id:
            self.updated_by_device = device_id
        self.sync_version += 1
        self.last_watched_at = timezone.now()
        self.save()


# =============================================================================
# ■ 2. نموذج DevicePlayerPreference (تفضيلات المشغل لكل جهاز ومستخدم)
# =============================================================================

class DevicePlayerPreference(TimeStampedUUIDModel):
    """
    تفضيلات المشغل المخصصة لكل مستخدم وجهاز مستقل (Device-Specific Player Preference).
    تتيح تخصيص جودة العرض القصوى والافتراضية، نمط توفير البيانات، شكل وموضع الترجمات،
    سرعة التشغيل، وخيارات التخطي التلقائي.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='player_preferences',
        verbose_name="المستخدم"
    )
    device_id = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="معرف الجهاز"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='device_player_preferences',
        null=True,
        blank=True,
        verbose_name="المستأجر"
    )
    default_quality = models.CharField(
        max_length=20,
        choices=PlaybackQuality.choices,
        default=PlaybackQuality.AUTO,
        verbose_name="الجودة الافتراضية"
    )
    max_quality = models.CharField(
        max_length=20,
        choices=PlaybackQuality.choices,
        default=PlaybackQuality.AUTO,
        verbose_name="الحد الأقصى للجودة"
    )
    auto_play_next = models.BooleanField(
        default=True,
        verbose_name="التشغيل التلقائي للحلقة التالية"
    )
    auto_skip_intro = models.BooleanField(
        default=False,
        verbose_name="تخطي المقدمة تلقائياً (Skip Intro)"
    )
    autoplay_preview = models.BooleanField(
        default=False,
        verbose_name="المعاينة التلقائية في الواجهة"
    )
    preferred_audio_language = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        default='ar',
        verbose_name="لغة الصوت المفضلة (ar / en / original)"
    )
    preferred_subtitle_language = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        default='ar',
        verbose_name="لغة الترجمة المفضلة"
    )
    subtitle_enabled_by_default = models.BooleanField(
        default=False,
        verbose_name="تفعيل الترجمة افتراضياً"
    )
    subtitle_size = models.CharField(
        max_length=20,
        choices=SubtitleSize.choices,
        default=SubtitleSize.MEDIUM,
        verbose_name="حجم خط الترجمة"
    )
    subtitle_color = models.CharField(
        max_length=20,
        default='#FFFFFF',
        verbose_name="لون خط الترجمة"
    )
    subtitle_background = models.CharField(
        max_length=50,
        default='rgba(0,0,0,0.75)',
        verbose_name="خلفية شريط الترجمة"
    )
    subtitle_position = models.CharField(
        max_length=20,
        choices=SubtitlePosition.choices,
        default=SubtitlePosition.BOTTOM,
        verbose_name="موضع الترجمة على الشاشة"
    )
    playback_speed_default = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=1.00,
        verbose_name="سرعة التشغيل الافتراضية (1.0x, 1.25x...)"
    )
    volume_default = models.IntegerField(
        default=100,
        verbose_name="مستوى الصوت الافتراضي (0 - 100)"
    )
    skip_forward_seconds = models.IntegerField(
        default=10,
        verbose_name="مدة التخطي للأمام بالثواني"
    )
    skip_backward_seconds = models.IntegerField(
        default=10,
        verbose_name="مدة التخطي للخلف بالثواني"
    )
    keyboard_shortcuts_enabled = models.BooleanField(
        default=True,
        verbose_name="تفعيل اختصارات لوحة المفاتيح"
    )
    picture_in_picture_enabled = models.BooleanField(
        default=True,
        verbose_name="تفعيل نافذة صورة داخل صورة (PiP)"
    )
    external_player_preference = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="المشغل الخارجي المفضل (vlc, infuse, kodi, mx_player, iina, nplayer)"
    )
    data_saver_mode = models.BooleanField(
        default=False,
        verbose_name="وضع توفير البيانات (Data Saver Mode - يمنع 4K ويحد البتات)"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إضافية"
    )

    class Meta:
        verbose_name = "تفضيل مشغل الجهاز (Device Player Preference)"
        verbose_name_plural = "تفضيلات مشغلات الأجهزة"
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'device_id'],
                name='unique_user_device_preference'
            )
        ]
        indexes = [
            models.Index(fields=['user', 'device_id']),
        ]

    def __str__(self):
        return f"Pref({self.user_id} @ {self.device_id}) -> Quality: {self.default_quality}"


# =============================================================================
# ■ 3. نموذج PlaybackQualityLog (سجل تحليلات الجودة والـ ABR)
# =============================================================================

class PlaybackQualityLog(TimeStampedUUIDModel):
    """
    سجل تحليلات جودة المشاهدة (Playback Quality & Analytics Log).
    يسجل كل عملية تبديل جودة، تخزين مؤقت، وقياسات استقرار البث.
    """
    playback_session = models.ForeignKey(
        PlaybackSession,
        on_delete=models.CASCADE,
        related_name='quality_logs',
        verbose_name="جلسة التشغيل"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='playback_quality_logs',
        verbose_name="المستخدم"
    )
    device_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="معرف الجهاز"
    )
    timestamp = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        verbose_name="تاريخ ووقت الحدث"
    )
    quality = models.CharField(
        max_length=20,
        verbose_name="الجودة المستهدفة"
    )
    bitrate_kbps = models.IntegerField(
        default=0,
        verbose_name="معدل البت بالكيلوبت (Bitrate kbps)"
    )
    buffer_health_seconds = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0.00,
        verbose_name="صحة الذاكرة المؤقتة (Buffer Health بالثواني)"
    )
    dropped_frames = models.IntegerField(
        default=0,
        verbose_name="عدد الإطارات الساقطة (Dropped Frames)"
    )
    playback_rate = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=1.00,
        verbose_name="معدل سرعة التشغيل"
    )
    buffer_duration_seconds = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0.00,
        verbose_name="مدة التوقف المؤقت بالثواني"
    )
    event_type = models.CharField(
        max_length=30,
        choices=QualityEventType.choices,
        default=QualityEventType.SWITCH,
        verbose_name="نوع حدث الجودة"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية للحدث (السبب، تفاصيل الشبكة)"
    )

    class Meta:
        verbose_name = "سجل جودة البث (Playback Quality Log)"
        verbose_name_plural = "سجلات جودة البث والتحليلات"
        indexes = [
            models.Index(fields=['playback_session', 'timestamp']),
            models.Index(fields=['user', '-timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"Log({self.event_type}): {self.quality} ({self.bitrate_kbps} kbps) @ Session {self.playback_session_id}"


# =============================================================================
# ■ 4. نماذج WatchPartySession و WatchPartyParticipant (المشاهدة الجماعية)
# =============================================================================

class WatchPartySession(TimeStampedUUIDModel):
    """
    جلسة المشاهدة الجماعية المتزامنة (Watch Party Session).
    تتيح للمستخدمين المشاهدة معاً مع مزامنة لحظية يتحكم بها المضيف (Host).
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='watch_parties',
        null=True,
        blank=True,
        verbose_name="المستأجر"
    )
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hosted_watch_parties',
        verbose_name="المضيف الرئيسي (Host)"
    )
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name='watch_parties',
        verbose_name="عنصر الوسائط المشاهد"
    )
    media_source = models.ForeignKey(
        MediaSource,
        on_delete=models.CASCADE,
        related_name='watch_parties',
        null=True,
        blank=True,
        verbose_name="مصدر الوسائط"
    )
    status = models.CharField(
        max_length=20,
        choices=WatchPartyStatus.choices,
        default=WatchPartyStatus.WAITING,
        db_index=True,
        verbose_name="حالة الجلسة الجماعية"
    )
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="الموعد المجدول"
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت البدء الفعلي"
    )
    ended_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت انتهاء الحفلة"
    )
    current_position_seconds = models.IntegerField(
        default=0,
        verbose_name="موضع المشاهدة الحالي للحفلة (بالثواني)"
    )
    playback_rate = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=1.00,
        verbose_name="سرعة التشغيل المشتركة"
    )
    invite_code = models.CharField(
        max_length=16,
        unique=True,
        db_index=True,
        verbose_name="رمز الدعوة الفريد (Invite Code)"
    )
    is_public = models.BooleanField(
        default=False,
        verbose_name="متاحة للعامة في الاستراحة"
    )
    max_participants = models.IntegerField(
        default=10,
        verbose_name="الحد الأقصى للمشاركين"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات الجلسة الوصفية"
    )

    class Meta:
        verbose_name = "جلسة مشاهدة جماعية (Watch Party Session)"
        verbose_name_plural = "جلسات المشاهدة الجماعية"
        ordering = ['-created_at']

    def __str__(self):
        return f"WatchParty({self.invite_code}): {self.media_item.title} - Host: {self.host.username} [{self.status}]"


class WatchPartyParticipant(TimeStampedUUIDModel):
    """
    مشارك في جلسة المشاهدة الجماعية (Watch Party Participant).
    """
    party = models.ForeignKey(
        WatchPartySession,
        on_delete=models.CASCADE,
        related_name='participants',
        verbose_name="جلسة المشاهدة الجماعية"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='watch_party_participations',
        verbose_name="المستخدم المشارك"
    )
    device_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="معرف جهاز المشارك"
    )
    role = models.CharField(
        max_length=20,
        choices=WatchPartyRole.choices,
        default=WatchPartyRole.VIEWER,
        verbose_name="دور المشارك (مضيف أم مشاهد)"
    )
    joined_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="تاريخ ووقت الانضمام"
    )
    left_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت المغادرة"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="متصل ونشط حالياً في الجلسة"
    )
    playback_session = models.ForeignKey(
        PlaybackSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='party_participants',
        verbose_name="جلسة التشغيل الفردية المرتبطة"
    )

    class Meta:
        verbose_name = "مشارك في المشاهدة الجماعية (Party Participant)"
        verbose_name_plural = "مشاركو المشاهدة الجماعية"
        constraints = [
            models.UniqueConstraint(
                fields=['party', 'user'],
                name='unique_party_user_participant'
            )
        ]
        indexes = [
            models.Index(fields=['party', 'is_active']),
        ]

    def __str__(self):
        return f"Participant: {self.user.username} in {self.party.invite_code} ({self.role})"


# =============================================================================
# ■ 5. نموذج CustomSubtitle (الترجمات المخصصة المرفوعة ومحاذاة التزامن)
# =============================================================================

class CustomSubtitle(TimeStampedUUIDModel):
    """
    ملف ترجمة مخصص ومرفوع من قبل المستخدم (Custom Subtitle).
    يدعم صيغ (SRT, VTT, ASS)، تعديل الإزاحة الزمنية (Sync Offset)،
    والمشاركة الخاصة أو العامة في الاستراحة بعد التدقيق.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='custom_subtitles',
        verbose_name="المستخدم الرافع"
    )
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name='custom_subtitles',
        verbose_name="عنصر الوسائط"
    )
    language = models.CharField(
        max_length=20,
        default='ar',
        verbose_name="رمز اللغة (ar, en...)"
    )
    label = models.CharField(
        max_length=150,
        verbose_name="تسمية الترجمة المعروضة (مثال: ترجمة عربية مخصصة)"
    )
    file_path = models.CharField(
        max_length=500,
        verbose_name="مسار تخزين الملف (VTT/SRT)"
    )
    file_format = models.CharField(
        max_length=10,
        choices=SubtitleFormat.choices,
        default=SubtitleFormat.VTT,
        verbose_name="صيغة الملف"
    )
    offset_seconds = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        default=0.000,
        verbose_name="إزاحة التزامن بالثواني (Offset Seconds)"
    )
    is_public = models.BooleanField(
        default=False,
        verbose_name="متاح لكافة مشاهدي الاستراحة"
    )
    approved = models.BooleanField(
        default=False,
        verbose_name="معتمد من إدارة الاستراحة"
    )

    class Meta:
        verbose_name = "ملف ترجمة مخصص (Custom Subtitle)"
        verbose_name_plural = "ملفات الترجمة المخصصة"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['media_item', 'language']),
            models.Index(fields=['user', 'media_item']),
        ]

    def __str__(self):
        return f"Subtitle({self.language} - {self.file_format}): {self.label} for {self.media_item.title}"
