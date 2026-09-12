import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedUUIDModel

class MediaServer(TimeStampedUUIDModel):
    class ServerType(models.TextChoices):
        JELLYFIN = 'jellyfin', 'Jellyfin Media Server'
        EMBY = 'emby', 'Emby Media Server'
        PLEX = 'plex', 'Plex (Future Ready)'
        CUSTOM = 'custom', 'Custom HTTP API Server'

    class Status(models.TextChoices):
        ONLINE = 'online', 'متصل (Online)'
        OFFLINE = 'offline', 'غير متصل (Offline)'
        ERROR = 'error', 'خطأ في الاتصال (Error)'
        SYNCING = 'syncing', 'جاري المزامنة (Syncing)'

    class ProvisioningMode(models.TextChoices):
        MANUAL = 'MANUAL', 'يدوي فقط (Manual Only)'
        AUTO = 'AUTO', 'تلقائي (Auto Provisioning)'
        DISABLED = 'DISABLED', 'معطل (Disabled)'

    class HealthStatus(models.TextChoices):
        HEALTHY = 'HEALTHY', 'سليم (Healthy)'
        DEGRADED = 'DEGRADED', 'متدهور (Degraded)'
        UNHEALTHY = 'UNHEALTHY', 'معطل (Unhealthy)'
        TIMEOUT = 'TIMEOUT', 'انتهت المهلة (Timeout)'
        OFFLINE = 'OFFLINE', 'غير متصل (Offline)'

    class CircuitBreakerState(models.TextChoices):
        CLOSED = 'CLOSED', 'مغلق - يعمل طبيعياً (Closed)'
        OPEN = 'OPEN', 'مفتوح - معزول عن الطلبات (Open)'
        HALF_OPEN = 'HALF_OPEN', 'نصف مفتوح - فحص تجريبي (Half-Open)'

    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_servers",
        verbose_name="المستأجر"
    )

    name = models.CharField(max_length=150, verbose_name="اسم الخادم")
    display_name = models.CharField(max_length=150, blank=True, default='', verbose_name="الاسم المعروض")
    internal_notes = models.TextField(null=True, blank=True, verbose_name="ملاحظات داخلية")
    server_type = models.CharField(
        max_length=30,
        choices=ServerType.choices,
        default=ServerType.JELLYFIN,
        verbose_name="نوع خادم الوسائط"
    )
    local_url = models.CharField(
        max_length=255,
        help_text="مثال: http://192.168.1.50:8096",
        verbose_name="عنوان السيرفر المحلي (LAN URL)"
    )
    server_url_internal = models.URLField(
        max_length=255,
        blank=True,
        default='',
        verbose_name="عنوان الوصول الداخلي (Internal URL)"
    )
    server_url_external = models.URLField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="عنوان الوصول الخارجي (External URL)"
    )
    use_internal_url = models.BooleanField(default=True, verbose_name="استخدام الرابط الداخلي افتراضياً")
    api_key = models.CharField(max_length=255, verbose_name="مفتاح الـ API")
    api_timeout_seconds = models.IntegerField(default=30, verbose_name="مهلة الـ API بالثواني")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OFFLINE,
        verbose_name="حالة الاتصال"
    )
    health_status = models.CharField(
        max_length=20,
        choices=HealthStatus.choices,
        default=HealthStatus.HEALTHY,
        verbose_name="حالة الجاهزية الصحية"
    )
    last_ping_at = models.DateTimeField(null=True, blank=True, verbose_name="آخر اتصال ناجح")
    last_health_check = models.DateTimeField(null=True, blank=True, verbose_name="آخر فحص صحي")
    last_sync_at = models.DateTimeField(null=True, blank=True, verbose_name="آخر مزامنة للمحتوى")
    server_info = models.JSONField(default=dict, blank=True, verbose_name="معلومات الخادم (الإصدار، الهوية)")

    # Phase 14: Enterprise Capacity, Load Balancing & Failover
    max_concurrent_streams = models.IntegerField(null=True, blank=True, default=20, verbose_name="الحد الأقصى لجلسات البث المتزامنة")
    max_concurrent_transcodes = models.IntegerField(null=True, blank=True, default=4, verbose_name="الحد الأقصى للتحويل الرقمي المتزامن")
    priority = models.IntegerField(default=100, verbose_name="الأولوية (الأقل = الأعلى)")
    weight = models.IntegerField(default=100, verbose_name="الوزن النسبي لموازنة الأحمال")
    is_primary = models.BooleanField(default=False, verbose_name="خادم رئيسي للـ Failover")
    fallback_server = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fallback_for_servers',
        verbose_name="الخادم الاحتياطي المباشر (Fallback Server)"
    )

    # Phase 14: Health & Circuit Breaker
    health_check_interval_seconds = models.IntegerField(default=60, verbose_name="دورية الفحص الصحي (ثواني)")
    consecutive_failures_threshold = models.IntegerField(default=3, verbose_name="عتبة الإخفاقات المتتالية لعزل الخادم")
    consecutive_success_threshold = models.IntegerField(default=2, verbose_name="عتبة النجاحات المتتالية لاستعادة الخادم")
    circuit_breaker_state = models.CharField(
        max_length=20,
        choices=CircuitBreakerState.choices,
        default=CircuitBreakerState.CLOSED,
        db_index=True,
        verbose_name="حالة قاطع الدائرة (Circuit Breaker)"
    )
    circuit_breaker_opened_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت فتح قاطع الدائرة")
    circuit_breaker_next_attempt_at = models.DateTimeField(null=True, blank=True, verbose_name="موعد محاولة الفحص التالية")
    consecutive_failures = models.IntegerField(default=0, verbose_name="الإخفاقات المتتالية")
    consecutive_successes = models.IntegerField(default=0, verbose_name="النجاحات المتتالية")
    last_error_message = models.TextField(null=True, blank=True, verbose_name="آخر رسالة خطأ")
    last_error_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ آخر خطأ")
    avg_response_time_ms = models.IntegerField(null=True, blank=True, verbose_name="متوسط وقت الاستجابة (ملي ثانية)")
    p95_response_time_ms = models.IntegerField(null=True, blank=True, verbose_name="مقياس P95 لوقت الاستجابة")

    # Phase 14: Capabilities & Versioning
    capabilities_discovered_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ اكتشاف القدرات")
    capabilities = models.JSONField(default=dict, blank=True, verbose_name="مصفوفة القدرات التقنية (Capabilities)")
    api_version = models.CharField(max_length=50, null=True, blank=True, verbose_name="إصدار واجهة الـ API")
    server_version = models.CharField(max_length=50, null=True, blank=True, verbose_name="إصدار الخادم")
    last_version_check_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ آخر فحص للتوافقية")

    # Phase 14: Operational Rules & Maintenance
    auto_disable_on_repeated_failures = models.BooleanField(default=False, verbose_name="تعطيل تلقائي بعد 10 إخفاقات متتالية")
    preferred_for_content_types = models.JSONField(default=list, blank=True, verbose_name="أنواع المحتوى المفضلة (MOVIES, SERIES)")
    excluded_from_playback = models.BooleanField(default=False, verbose_name="استبعاد الخادم من اختيار البث")
    maintenance_mode = models.BooleanField(default=False, verbose_name="وضع الصيانة")
    maintenance_message = models.CharField(max_length=255, null=True, blank=True, verbose_name="رسالة الصيانة")

    # ==========================================
    # Phase 10: Provisioning & Account Sync Config
    # ==========================================
    provisioning_enabled = models.BooleanField(
        default=True,
        verbose_name="تفعيل إنشاء وإدارة الحسابات"
    )
    provisioning_mode = models.CharField(
        max_length=20,
        choices=ProvisioningMode.choices,
        default=ProvisioningMode.AUTO,
        verbose_name="نمط التزويد الافتراضي"
    )
    auto_create_on_first_login = models.BooleanField(
        default=True,
        verbose_name="إنشاء تلقائي فور أول تسجيل دخول"
    )
    auto_create_on_playback = models.BooleanField(
        default=False,
        verbose_name="إنشاء عند طلب التشغيل"
    )
    auto_disable_on_subscription_expire = models.BooleanField(
        default=True,
        verbose_name="تعطيل الحساب تلقائياً عند انتهاء الاشتراك"
    )
    auto_delete_on_user_delete = models.BooleanField(
        default=False,
        verbose_name="حذف الحساب من السيرفر عند حذف المستخدم"
    )
    default_library_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name="المكتبات الافتراضية الممنوحة"
    )
    default_policy = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="سياسة الحساب الافتراضية (Policy)"
    )
    username_pattern = models.CharField(
        max_length=100,
        default='LU-{lounge_id}',
        blank=True,
        verbose_name="نمط توليد اسم المستخدم"
    )
    username_include_tenant = models.BooleanField(
        default=False,
        verbose_name="تضمين كود المستأجر في اسم المستخدم"
    )
    sync_interval_minutes = models.IntegerField(
        default=60,
        verbose_name="الفاصل الزمني للمزامنة (بالدقائق)"
    )
    last_full_sync_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر مزامنة شاملة"
    )
    last_user_sync_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر مزامنة لحسابات المستخدمين"
    )

    class Meta:
        verbose_name = "خادم وسائط محلي (Media Server)"
        verbose_name_plural = "خوادم الوسائط المحلية"
        ordering = ['priority', 'name']
        indexes = [
            models.Index(fields=['health_status', 'priority'], name='idx_ms_health_prio'),
            models.Index(fields=['circuit_breaker_state'], name='idx_ms_circuit_state'),
            models.Index(fields=['status', 'is_active'], name='idx_ms_status_active'),
        ]

    @property
    def base_url(self) -> str:
        """Returns the primary accessible URL for the media server."""
        if self.use_internal_url and self.server_url_internal:
            return self.server_url_internal.rstrip('/')
        return (self.local_url or self.server_url_external or '').rstrip('/')

    def __str__(self):
        return f"{self.display_name or self.name} ({self.get_server_type_display()}) - {self.base_url}"


class MediaAccountMapping(TimeStampedUUIDModel):
    """
    Decision 11 & Decision 18:
    MediaAccountMapping is the bridge between Smart Lounge identities (Lounge User)
    and external Media Server users (Jellyfin / Emby accounts).
    Stores encrypted credentials, policy reflections, sync state, and lifecycle flags.
    """
    class ProvisioningMode(models.TextChoices):
        MANUAL = 'MANUAL', 'يدوي (Manual Link)'
        AUTO = 'AUTO', 'تلقائي (Auto Created)'
        DISABLED = 'DISABLED', 'معطل (Disabled)'

    class ProvisioningStatus(models.TextChoices):
        PENDING = 'PENDING', 'قيد الانتظار'
        IN_PROGRESS = 'IN_PROGRESS', 'جاري التزويد'
        COMPLETED = 'COMPLETED', 'مكتمل بنجاح'
        FAILED = 'FAILED', 'فشل التزويد'
        DISABLED = 'DISABLED', 'معطل مؤقتاً'
        DELETED = 'DELETED', 'محذوف من السيرفر'

    class SyncStatus(models.TextChoices):
        IN_SYNC = 'IN_SYNC', 'متطابق (In Sync)'
        OUT_OF_SYNC = 'OUT_OF_SYNC', 'غير متطابق (Out of Sync)'
        UNKNOWN = 'UNKNOWN', 'غير معروف'
        ERROR = 'ERROR', 'خطأ في الفحص'

    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name="account_mappings",
        verbose_name="خادم الوسائط"
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name="media_account_mappings",
        verbose_name="مستخدم الاستراحة"
    )
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_account_mappings",
        verbose_name="المستأجر"
    )

    external_user_id = models.CharField(
        max_length=128,
        db_index=True,
        verbose_name="معرّف المستخدم على السيرفر (External User ID)"
    )
    external_username = models.CharField(
        max_length=150,
        verbose_name="اسم المستخدم على السيرفر (External Username)"
    )
    external_password_encrypted = models.BinaryField(
        null=True,
        blank=True,
        verbose_name="كلمة المرور المشفرة (Fernet Encrypted)"
    )

    provisioning_mode = models.CharField(
        max_length=20,
        choices=ProvisioningMode.choices,
        default=ProvisioningMode.AUTO,
        verbose_name="نمط التزويد"
    )
    provisioning_status = models.CharField(
        max_length=20,
        choices=ProvisioningStatus.choices,
        default=ProvisioningStatus.PENDING,
        db_index=True,
        verbose_name="حالة التزويد"
    )
    provisioning_error = models.TextField(
        null=True,
        blank=True,
        verbose_name="رسالة الخطأ الأخيرة"
    )
    provisioning_attempts = models.IntegerField(
        default=0,
        verbose_name="عدد المحاولات"
    )

    last_sync_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر مزامنة"
    )
    last_provisioned_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ آخر تزويد ناجح"
    )
    sync_status = models.CharField(
        max_length=20,
        choices=SyncStatus.choices,
        default=SyncStatus.UNKNOWN,
        verbose_name="حالة التطابق مع السيرفر"
    )
    sync_details = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="تفاصيل نتائج المزامنة"
    )

    media_server_policy = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="سياسة الحساب على السيرفر (Policy)"
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="نشط"
    )
    disabled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت التعطيل"
    )
    disabled_reason = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="سبب التعطيل"
    )

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت الحذف"
    )
    deleted_reason = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="سبب الحذف"
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية إضافية"
    )

    class Meta:
        verbose_name = "ربط حساب خادم الوسائط (Media Account Mapping)"
        verbose_name_plural = "ربط حسابات خوادم الوسائط"
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'media_server'],
                name='unique_user_media_server_mapping'
            )
        ]
        indexes = [
            models.Index(fields=['media_server', 'provisioning_status'], name='idx_mam_srv_status'),
            models.Index(fields=['user', 'is_active'], name='idx_mam_user_active'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} -> {self.media_server.name} ({self.external_username})"


class MediaServerUserSync(TimeStampedUUIDModel):
    """
    Tracks reconciliation and user sync operations between Smart Lounge and Media Servers.
    Records checked accounts, newly discovered orphans, updated credentials, and conflict detections.
    """
    class SyncType(models.TextChoices):
        FULL = 'FULL', 'مزامنة شاملة (Full Sync)'
        INCREMENTAL = 'INCREMENTAL', 'مزامنة تزايدية (Incremental)'
        RECONCILIATION = 'RECONCILIATION', 'مطابقة وإصلاح الفروقات (Reconciliation)'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'قيد الانتظار'
        RUNNING = 'RUNNING', 'قيد التنفيذ'
        COMPLETED = 'COMPLETED', 'اكتملت بنجاح'
        FAILED = 'FAILED', 'فشلت'
        PARTIAL = 'PARTIAL', 'اكتملت جزئياً مع تحذيرات'

    class TriggerSource(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'مجدول دورياً'
        MANUAL = 'MANUAL', 'يدوي من لوحة الإدارة'
        EVENT = 'EVENT', 'حدث نظام (Event Trigger)'

    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name="user_syncs",
        verbose_name="خادم الوسائط"
    )
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_user_syncs",
        verbose_name="المستأجر"
    )

    sync_type = models.CharField(
        max_length=30,
        choices=SyncType.choices,
        default=SyncType.INCREMENTAL,
        verbose_name="نوع المزامنة"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="حالة المزامنة"
    )
    started_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="وقت البدء"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت الاكتمال"
    )

    users_checked = models.IntegerField(default=0, verbose_name="الحسابات المفحوصة")
    users_created = models.IntegerField(default=0, verbose_name="حسابات منشأة")
    users_updated = models.IntegerField(default=0, verbose_name="حسابات محدثة")
    users_disabled = models.IntegerField(default=0, verbose_name="حسابات معطلة")
    users_deleted = models.IntegerField(default=0, verbose_name="حسابات محذوفة")
    mappings_fixed = models.IntegerField(default=0, verbose_name="ربط تم إصلاحه")
    orphans_found = models.IntegerField(default=0, verbose_name="حسابات غير مرتبطة (Orphans)")
    conflicts_found = models.IntegerField(default=0, verbose_name="تعارضات مكتشفة")

    last_error = models.TextField(
        null=True,
        blank=True,
        verbose_name="آخر خطأ مسجل"
    )
    triggered_by = models.CharField(
        max_length=20,
        choices=TriggerSource.choices,
        default=TriggerSource.MANUAL,
        verbose_name="مصدر التشغيل"
    )
    triggered_by_user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_media_syncs",
        verbose_name="المستخدم الذي شغّل المزامنة"
    )
    correlation_id = models.UUIDField(
        default=uuid.uuid4,
        verbose_name="معرّف التتبع والترابط (Correlation ID)"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات إحصائية تفصيلية"
    )

    class Meta:
        verbose_name = "مزامنة حسابات خادم الوسائط (Media Server User Sync)"
        verbose_name_plural = "سجلات مزامنة حسابات خوادم الوسائط"
        indexes = [
            models.Index(fields=['media_server', '-started_at'], name='idx_msus_srv_date'),
        ]
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.media_server.name} User Sync [{self.sync_type}] - {self.status}"


class MediaServerOrphanUser(TimeStampedUUIDModel):
    """
    Represents an external user account detected on Jellyfin/Emby that has no
    corresponding MediaAccountMapping in Smart Lounge.
    Admins can Claim, Ignore, or Delete these accounts safely.
    """
    class Status(models.TextChoices):
        NEW = 'NEW', 'مكتشف حديثاً (New)'
        IGNORED = 'IGNORED', 'تم التجاهل (Ignored)'
        CLAIMED = 'CLAIMED', 'تم ربطه بمستخدم (Claimed)'
        DELETED = 'DELETED', 'تم حذفه من السيرفر (Deleted)'

    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name="orphan_users",
        verbose_name="خادم الوسائط"
    )
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orphan_media_users",
        verbose_name="المستأجر"
    )
    external_user_id = models.CharField(
        max_length=128,
        verbose_name="معرّف الحساب الخارجي"
    )
    external_username = models.CharField(
        max_length=150,
        verbose_name="اسم الحساب الخارجي"
    )
    detected_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="وقت الاكتشاف"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        verbose_name="حالة الحساب المعزول"
    )

    claimed_by_user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="claimed_media_orphans",
        verbose_name="المستخدم المربوط به"
    )
    claimed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت الربط"
    )
    resolved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_media_orphans",
        verbose_name="المشرف الذي عيّن الإجراء"
    )
    resolution_note = models.TextField(
        null=True,
        blank=True,
        verbose_name="ملاحظات الإجراء"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات الحساب على السيرفر"
    )

    class Meta:
        verbose_name = "حساب وسائط غير مربوط (Orphan Media User)"
        verbose_name_plural = "حسابات الوسائط غير المربوطة (Orphan Users)"
        constraints = [
            models.UniqueConstraint(
                fields=['media_server', 'external_user_id'],
                name='unique_media_server_orphan_user'
            )
        ]
        ordering = ['-detected_at']

    def __str__(self):
        return f"{self.external_username} [{self.media_server.name}] ({self.status})"


# =========================================================================
# Phase 14: Enterprise Media Server Management & Discovery Models
# =========================================================================

class MediaServerHealthCheck(TimeStampedUUIDModel):
    """
    سجل الفحوصات الدورية لجاهزية وصحة خوادم الوسائط.
    Retention: 7 أيام ثم تُجمع للإحصائيات و p95.
    """
    class Status(models.TextChoices):
        HEALTHY = 'HEALTHY', 'سليم (Healthy)'
        DEGRADED = 'DEGRADED', 'متدهور / بطيء (Degraded)'
        UNHEALTHY = 'UNHEALTHY', 'غير سليم (Unhealthy)'
        TIMEOUT = 'TIMEOUT', 'انتهت المهلة (Timeout)'

    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name='health_checks',
        verbose_name="خادم الوسائط"
    )
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        related_name='media_server_health_checks',
        null=True,
        blank=True,
        verbose_name="المستأجر"
    )
    checked_at = models.DateTimeField(default=timezone.now, db_index=True, verbose_name="وقت الفحص")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        db_index=True,
        verbose_name="حالة الفحص"
    )
    response_time_ms = models.IntegerField(default=0, verbose_name="زمن الاستجابة (ملي ثانية)")
    endpoint = models.CharField(max_length=255, default='/System/Info/Public', verbose_name="نقطة الفحص")
    http_status_code = models.IntegerField(null=True, blank=True, verbose_name="كود الاستجابة HTTP")
    error_message = models.TextField(null=True, blank=True, verbose_name="رسالة الخطأ")
    server_version = models.CharField(max_length=50, null=True, blank=True, verbose_name="إصدار السيرفر")
    active_sessions = models.IntegerField(null=True, blank=True, verbose_name="الجلسات النشطة")
    active_transcodes = models.IntegerField(null=True, blank=True, verbose_name="جلسات التحويل الرقمي النشطة")
    cpu_usage_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, verbose_name="نسبة المعالج %")
    memory_usage_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, verbose_name="نسبة الذاكرة %")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات وصفية إضافية")

    class Meta:
        verbose_name = "فحص جاهزية الخادم (Server Health Check)"
        verbose_name_plural = "سجلات فحص جاهزية الخوادم"
        ordering = ['-checked_at']
        indexes = [
            models.Index(fields=['media_server', '-checked_at'], name='idx_mshc_srv_time'),
            models.Index(fields=['status'], name='idx_mshc_status'),
            models.Index(fields=['tenant', '-checked_at'], name='idx_mshc_ten_time'),
        ]

    def __str__(self):
        return f"{self.media_server.name} - {self.status} ({self.response_time_ms}ms) @ {self.checked_at.strftime('%Y-%m-%d %H:%M')}"


class DiscoveredMediaServer(TimeStampedUUIDModel):
    """
    الخوادم المكتشفة في الشبكة المحلية (LAN Discovery) بانتظار موافقة المسؤول.
    ينتهي السجل بعد 30 يوماً إذا لم تتم الموافقة عليه.
    """
    class DiscoveryMethod(models.TextChoices):
        MANUAL = 'MANUAL', 'يدوي (Manual)'
        MDNS = 'MDNS', 'mDNS / Zeroconf'
        SSDP = 'SSDP', 'SSDP / UPnP'
        ARP = 'ARP', 'ARP Scan'
        NMAP = 'NMAP', 'Nmap Port Probe'
        HTTP_PROBE = 'HTTP_PROBE', 'HTTP Port Probing'

    class ServerTypeGuess(models.TextChoices):
        JELLYFIN = 'JELLYFIN', 'Jellyfin'
        EMBY = 'EMBY', 'Emby'
        PLEX = 'PLEX', 'Plex'
        UNKNOWN = 'UNKNOWN', 'غير معروف (Unknown)'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'قيد الانتظار (Pending Approval)'
        APPROVED = 'APPROVED', 'تمت الموافقة (Approved)'
        IGNORED = 'IGNORED', 'تم التجاهل (Ignored)'
        EXPIRED = 'EXPIRED', 'منتهي الصلاحية (Expired)'

    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        related_name='discovered_media_servers',
        null=True,
        blank=True,
        verbose_name="المستأجر"
    )
    discovered_at = models.DateTimeField(default=timezone.now, db_index=True, verbose_name="تاريخ الاكتشاف")
    discovery_method = models.CharField(
        max_length=30,
        choices=DiscoveryMethod.choices,
        default=DiscoveryMethod.HTTP_PROBE,
        verbose_name="طريقة الاكتشاف"
    )
    host = models.CharField(max_length=255, verbose_name="عنوان المضيف / IP")
    port = models.IntegerField(verbose_name="المنفذ (Port)")
    server_type_guess = models.CharField(
        max_length=30,
        choices=ServerTypeGuess.choices,
        default=ServerTypeGuess.UNKNOWN,
        verbose_name="نوع الخادم المتوقع"
    )
    version_guess = models.CharField(max_length=50, null=True, blank=True, verbose_name="الإصدار المتوقع")
    confidence_score = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=0.5,
        verbose_name="درجة الثقة (0.00 إلى 1.00)"
    )
    raw_response = models.JSONField(default=dict, blank=True, verbose_name="الرد الخام من الفحص")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        verbose_name="حالة الاكتشاف"
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت الموافقة")
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_media_discoveries',
        verbose_name="المشرف الموافق"
    )
    ignored_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت التجاهل")
    ignored_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ignored_media_discoveries',
        verbose_name="المشرف المتجاهل"
    )
    ignore_reason = models.CharField(max_length=255, null=True, blank=True, verbose_name="سبب التجاهل")
    created_media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='origin_discoveries',
        verbose_name="خادم الوسائط المنشأ"
    )
    metadata = models.JSONField(default=dict, blank=True, verbose_name="بيانات إضافية")

    class Meta:
        verbose_name = "خادم وسائط مكتشف (Discovered Media Server)"
        verbose_name_plural = "الخوادم المكتشفة في الشبكة المحلية"
        ordering = ['-discovered_at']
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'host', 'port'],
                name='unique_tenant_host_port_discovery'
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'status'], name='idx_dms_ten_status'),
            models.Index(fields=['-discovered_at'], name='idx_dms_discovered_at'),
        ]

    def __str__(self):
        return f"{self.server_type_guess} @ {self.host}:{self.port} ({self.status})"


class MediaServerCapability(TimeStampedUUIDModel):
    """
    مصفوفة القدرات والميزات المفصلة التي يدعمها كل خادم وسائط (Capability Matrix).
    تُفحص دورياً وتُستخدم من قِبل Load Balancer و Playback Engine.
    """
    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name='capability_records',
        verbose_name="خادم الوسائط"
    )
    capability_key = models.CharField(max_length=100, db_index=True, verbose_name="مفتاح الميزة أو القدرة")
    capability_value = models.JSONField(default=dict, verbose_name="قيمة الميزة وتفاصيلها")
    detected_at = models.DateTimeField(default=timezone.now, verbose_name="تاريخ الاكتشاف")
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    class Meta:
        verbose_name = "قدرة خادم الوسائط (Media Server Capability)"
        verbose_name_plural = "قدرات خوادم الوسائط"
        constraints = [
            models.UniqueConstraint(
                fields=['media_server', 'capability_key'],
                name='unique_media_server_capability'
            )
        ]
        indexes = [
            models.Index(fields=['media_server', 'capability_key'], name='idx_msc_server_key'),
        ]

    def __str__(self):
        return f"{self.media_server.name} - {self.capability_key}: {self.capability_value}"


# Keep SyncJob import intact
from .sync_models import SyncJob

