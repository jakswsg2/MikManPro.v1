import uuid
from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedUUIDModel
from apps.tenancy.models import Tenant
from apps.notifications.constants import (
    Category, Priority, NotificationStatus,
    Channel, DeliveryStatus, DigestMode, HealthStatus, Frequency
)

class Notification(TimeStampedUUIDModel):
    """
    نموذج الإشعار الموحّد (Unified Notification Model).
    يمثل حدث الإشعار الأساسي بغض النظر عن قنوات الإرسال المحددة له.
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
        verbose_name="المستأجر"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name="المستخدم المستهدف"
    )
    notification_type = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="نوع الإشعار (مفتاح الحدث)"
    )
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.SYSTEM,
        db_index=True,
        verbose_name="تصنيف الإشعار"
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
        verbose_name="أولوية الإشعار"
    )
    title_key = models.CharField(
        max_length=255,
        verbose_name="مفتاح العنوان المترجم (i18n key)"
    )
    title_params = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="معاملات العنوان الديناميكية"
    )
    message_key = models.CharField(
        max_length=255,
        verbose_name="مفتاح نص الإشعار المترجم (i18n key)"
    )
    message_params = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="معاملات نص الإشعار الديناميكية"
    )
    action_url = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="رابط التوجيه المباشر (Deep Link)"
    )
    action_label_key = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="مفتاح تسمية زر التوجيه"
    )
    image_url = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="رابط الصورة المرفقة"
    )
    icon = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="أيقونة الإشعار"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="سياق وبيانات وصفية إضافية"
    )
    source_event_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="معرف الحدث المصدر لضمان عدم التكرار (Idempotency Key)"
    )
    source_event_type = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="نوع الحدث المصدر"
    )
    correlation_id = models.UUIDField(
        default=uuid.uuid4,
        db_index=True,
        verbose_name="معرف التتبع والارتباط"
    )
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="وقت الإرسال المجدول"
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ ووقت انتهاء الصلاحية"
    )
    aggregated = models.BooleanField(
        default=False,
        verbose_name="هل تم تجميعه كـ Digest"
    )
    aggregate_count = models.IntegerField(
        default=0,
        verbose_name="عدد العناصر المجمعة"
    )
    aggregate_key = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="مفتاح التجميع (Grouping Key)"
    )
    status = models.CharField(
        max_length=20,
        choices=NotificationStatus.choices,
        default=NotificationStatus.PENDING,
        db_index=True,
        verbose_name="حالة الإشعار الكلية"
    )

    class Meta:
        verbose_name = "إشعار موحد (Notification)"
        verbose_name_plural = "الإشعارات الموحدة"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status', '-created_at']),
            models.Index(fields=['tenant', 'notification_type']),
            models.Index(fields=['aggregate_key', '-created_at']),
            models.Index(fields=['scheduled_at']),
            models.Index(fields=['source_event_id']),
        ]

    def __str__(self):
        return f"Notification({self.id}): {self.notification_type} -> User {self.user_id} [{self.status}]"


class NotificationDelivery(TimeStampedUUIDModel):
    """
    نموذج تسليم الإشعار لقناة معينة (Notification Delivery Record).
    يتتبع محاولات الإرسال وإعادة المحاولة والنتائج ومزود الخدمة.
    """
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name='deliveries',
        verbose_name="الإشعار الأساسي"
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        db_index=True,
        verbose_name="قناة الإرسال"
    )
    status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
        db_index=True,
        verbose_name="حالة التسليم"
    )
    attempt_count = models.IntegerField(
        default=0,
        verbose_name="عدد محاولات الإرسال"
    )
    max_attempts = models.IntegerField(
        default=3,
        verbose_name="الحد الأقصى للمحاولات قبل الانتقال للـ DLQ"
    )
    next_attempt_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="موعد المحاولة القادمة"
    )
    last_attempt_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="موعد آخر محاولة"
    )
    provider = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="اسم مزود الخدمة (SMTP, Twilio, Meta, FCM...)"
    )
    provider_message_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        verbose_name="معرف الرسالة لدى المزود"
    )
    provider_response = models.JSONField(
        default=dict,
        blank=True,
        null=True,
        verbose_name="استجابة المزود التفصيلية"
    )
    error_code = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="كود الخطأ"
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        verbose_name="تفاصيل رسالة الخطأ"
    )
    queued_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ الإدراج في الطابور"
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت الإرسال الفعلي"
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت التسليم المؤكد"
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت القراءة"
    )
    failed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت الفشل النهائي"
    )
    opened_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت الفتح (للبريد)"
    )
    clicked_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت النقر على الروابط"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية إضافية للتسليم"
    )

    class Meta:
        verbose_name = "سجل تسليم إشعار (Notification Delivery)"
        verbose_name_plural = "سجلات تسليم الإشعارات"
        constraints = [
            models.UniqueConstraint(
                fields=['notification', 'channel'],
                name='unique_notification_channel_delivery'
            )
        ]
        indexes = [
            models.Index(fields=['status', 'next_attempt_at']),
            models.Index(fields=['provider_message_id']),
            models.Index(fields=['notification', 'channel']),
        ]

    def __str__(self):
        return f"Delivery({self.channel}): Notification {self.notification_id} [{self.status}]"


class NotificationTemplate(TimeStampedUUIDModel):
    """
    نموذج قوالب الإشعارات متعددة اللغات والقنوات (Notification Template Model).
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='notification_templates',
        null=True,
        blank=True,
        verbose_name="المستأجر (NULL = Global Template)"
    )
    notification_type = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="نوع الإشعار المتطابق"
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        db_index=True,
        verbose_name="القناة المستهدفة"
    )
    language = models.CharField(
        max_length=10,
        default='ar',
        db_index=True,
        verbose_name="اللغة (ar / en)"
    )
    subject_key = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="موضوع الرسالة (للبريد الإلكتروني)"
    )
    title_template = models.TextField(
        verbose_name="قالب العنوان الديناميكي"
    )
    message_template = models.TextField(
        verbose_name="قالب نص الإشعار الديناميكي"
    )
    action_label_template = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="قالب تسمية زر الإجراء"
    )
    html_template = models.TextField(
        null=True,
        blank=True,
        verbose_name="قالب HTML للبريد أو الإشعار الغني"
    )
    text_template = models.TextField(
        null=True,
        blank=True,
        verbose_name="قالب النص الصريح Fallback"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية"
    )
    variables = models.JSONField(
        default=list,
        blank=True,
        verbose_name="قائمة المتغيرات المدعومة"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشط"
    )
    version = models.IntegerField(
        default=1,
        verbose_name="إصدار القالب"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_notification_templates',
        verbose_name="تم الإنشاء بواسطة"
    )

    class Meta:
        verbose_name = "قالب إشعار (Notification Template)"
        verbose_name_plural = "قوالب الإشعارات"
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'notification_type', 'channel', 'language', 'version'],
                name='unique_tenant_template_version',
                condition=models.Q(tenant__isnull=False)
            ),
            models.UniqueConstraint(
                fields=['notification_type', 'channel', 'language', 'version'],
                name='unique_global_template_version',
                condition=models.Q(tenant__isnull=True)
            ),
        ]
        indexes = [
            models.Index(fields=['notification_type', 'channel', 'language']),
        ]

    def __str__(self):
        t_name = self.tenant.name if self.tenant else "Global"
        return f"Template({self.notification_type} - {self.channel} - {self.language} v{self.version}) [{t_name}]"


class NotificationRule(TimeStampedUUIDModel):
    """
    نموذج قواعد معالجة أحداث الإشعارات (Notification Rule Engine Model).
    يحدد القنوات، الأولوية، التهدئة، ساعات الهدوء والتجميع.
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='notification_rules',
        null=True,
        blank=True,
        verbose_name="المستأجر (NULL = Global)"
    )
    event_type = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="نوع الحدث المقترن بالقاعدة"
    )
    description = models.TextField(
        verbose_name="وصف القاعدة وأثرها"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="نشطة"
    )
    is_system = models.BooleanField(
        default=False,
        verbose_name="قاعدة نظام أساسية غير قابلة للحذف"
    )
    conditions = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="شروط ومعايير متقدمة لتطبيق القاعدة"
    )
    channels = models.JSONField(
        default=list,
        verbose_name="قائمة القنوات المستهدفة (مثال: ['IN_APP', 'EMAIL'])"
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
        verbose_name="أولوية الإشعار"
    )
    delay_seconds = models.IntegerField(
        default=0,
        verbose_name="تأخير زمني بالثواني قبل الإرسال"
    )
    aggregation_window_seconds = models.IntegerField(
        default=0,
        verbose_name="نافذة التجميع بالثواني (Digest Window)"
    )
    throttle_per_user_per_hour = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="الحد الأقصى للإرسال لكل مستخدم في الساعة"
    )
    throttle_per_user_per_day = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="الحد الأقصى للإرسال لكل مستخدم في اليوم"
    )
    quiet_hours_start = models.TimeField(
        null=True,
        blank=True,
        verbose_name="بداية ساعات الهدوء"
    )
    quiet_hours_end = models.TimeField(
        null=True,
        blank=True,
        verbose_name="نهاية ساعات الهدوء"
    )
    digest_mode = models.CharField(
        max_length=20,
        choices=DigestMode.choices,
        default=DigestMode.NONE,
        verbose_name="نمط التجميع (Digest Mode)"
    )
    requires_consent = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="نوع الموافقة القانونية المطلوبة (مثال: MARKETING)"
    )
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.SYSTEM,
        verbose_name="التصنيف"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية إضافية"
    )

    class Meta:
        verbose_name = "قاعدة إشعار (Notification Rule)"
        verbose_name_plural = "قواعد الإشعارات"
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'event_type'],
                name='unique_tenant_rule_event',
                condition=models.Q(tenant__isnull=False)
            ),
            models.UniqueConstraint(
                fields=['event_type'],
                name='unique_global_rule_event',
                condition=models.Q(tenant__isnull=True)
            ),
        ]
        indexes = [
            models.Index(fields=['event_type', 'is_active']),
        ]

    def __str__(self):
        t_name = self.tenant.name if self.tenant else "Global"
        return f"Rule({self.event_type}) [{t_name}] Priority: {self.priority}"


class NotificationPreference(TimeStampedUUIDModel):
    """
    نموذج تفضيلات المستخدم للإشعارات (User Notification Preference).
    تتيح للمستخدم ضبط كل نوع إشعار وكل قناة وتردد الإرسال بدقة.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences',
        verbose_name="المستخدم"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='user_notification_preferences',
        null=True,
        blank=True,
        verbose_name="المستأجر"
    )
    notification_type = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="نوع الإشعار"
    )
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.SYSTEM,
        db_index=True,
        verbose_name="تصنيف الإشعار"
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        db_index=True,
        verbose_name="القناة"
    )
    enabled = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="مفعل"
    )
    frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        default=Frequency.INSTANT,
        verbose_name="تردد الاستلام"
    )

    class Meta:
        verbose_name = "تفضيل إشعار للمستخدم (Notification Preference)"
        verbose_name_plural = "تفضيلات إشعارات المستخدمين"
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'notification_type', 'channel'],
                name='unique_user_type_channel_pref'
            )
        ]
        indexes = [
            models.Index(fields=['user', 'category', 'enabled']),
        ]

    def __str__(self):
        return f"Pref({self.user_id}): {self.notification_type} [{self.channel}] -> {'Enabled' if self.enabled else 'Disabled'}"


class NotificationChannelConfig(TimeStampedUUIDModel):
    """
    نموذج تكوين قنوات ومزودي خدمة الإشعارات (Channel & Provider Configuration).
    يدعم التشفير للبيانات السرية (Fernet) والـ Health Checks والـ Rate Limits ومفتاح الإيقاف الفوري (Kill Switch).
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='notification_channel_configs',
        null=True,
        blank=True,
        verbose_name="المستأجر (NULL = Global Provider)"
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        db_index=True,
        verbose_name="نوع القناة"
    )
    provider = models.CharField(
        max_length=100,
        verbose_name="اسم المزود (smtp, twilio, meta_cloud, fcm, web_push, internal)"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="نشط (Kill Switch)"
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name="المزود الافتراضي للقناة"
    )
    priority = models.IntegerField(
        default=100,
        verbose_name="أولوية الاختيار (للـ Failover)"
    )
    config_encrypted = models.BinaryField(
        null=True,
        blank=True,
        verbose_name="بيانات التكوين السرية مشفرة بـ Fernet"
    )
    config_public = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات التكوين العامة وغير السرية (sender email, name...)"
    )
    rate_limit_per_minute = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="الحد الأقصى للإرسال في الدقيقة"
    )
    rate_limit_per_hour = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="الحد الأقصى للإرسال في الساعة"
    )
    rate_limit_per_day = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="الحد الأقصى للإرسال في اليوم"
    )
    last_health_check = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ آخر فحص صحة"
    )
    health_status = models.CharField(
        max_length=20,
        choices=HealthStatus.choices,
        default=HealthStatus.UNKNOWN,
        verbose_name="حالة جاهزية المزود"
    )

    class Meta:
        verbose_name = "تكوين مزود القناة (Channel Config)"
        verbose_name_plural = "تكوينات مزودي القنوات"
        ordering = ['channel', 'priority']

    def __str__(self):
        t_name = self.tenant.name if self.tenant else "Global"
        return f"ChannelConfig({self.channel} - {self.provider}) [{t_name}] Health: {self.health_status}"


class NotificationAggregate(TimeStampedUUIDModel):
    """
    نموذج تجميع الإشعارات (Digest & Aggregation Model).
    يجمع أحداث الإشعارات المتشابهة في نافذة زمنية لإرسال ملخص موحد بدلاً من الإزعاج المتكرر.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_aggregates',
        verbose_name="المستخدم"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='notification_aggregates',
        null=True,
        blank=True,
        verbose_name="المستأجر"
    )
    aggregate_key = models.CharField(
        max_length=255,
        db_index=True,
        verbose_name="مفتاح التجميع (مثال: content.new:movies)"
    )
    digest_mode = models.CharField(
        max_length=20,
        choices=DigestMode.choices,
        default=DigestMode.DAILY,
        verbose_name="نمط التجميع"
    )
    notification_type = models.CharField(
        max_length=100,
        verbose_name="نوع الإشعار الممثل"
    )
    count = models.IntegerField(
        default=0,
        verbose_name="عدد الأحداث المجمعة"
    )
    first_event_at = models.DateTimeField(
        verbose_name="تاريخ أول حدث"
    )
    last_event_at = models.DateTimeField(
        verbose_name="تاريخ آخر حدث"
    )
    notification_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name="قائمة معرفات الأحداث أو الإشعارات"
    )
    data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="البيانات المتراكمة"
    )
    scheduled_at = models.DateTimeField(
        db_index=True,
        verbose_name="موعد إرسال الملخص (نهاية النافذة)"
    )
    status = models.CharField(
        max_length=20,
        choices=NotificationStatus.choices,
        default=NotificationStatus.PENDING,
        db_index=True,
        verbose_name="حالة التجميع"
    )

    class Meta:
        verbose_name = "تجميع إشعارات (Notification Aggregate)"
        verbose_name_plural = "تجميعات الإشعارات (Digests)"
        indexes = [
            models.Index(fields=['user', 'aggregate_key', 'status']),
            models.Index(fields=['scheduled_at']),
        ]

    def __str__(self):
        return f"Aggregate({self.aggregate_key}): User {self.user_id} ({self.count} items) -> [{self.status}]"


class DeadLetterNotification(TimeStampedUUIDModel):
    """
    طابور الرسائل الميتة (Dead Letter Queue - DLQ).
    يستقبل الإشعارات التي استنفدت الحد الأقصى من محاولات الإرسال أو واجهت أخطاء قاتلة.
    """
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name='dead_letter_records',
        verbose_name="الإشعار"
    )
    delivery = models.ForeignKey(
        NotificationDelivery,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='dead_letter_records',
        verbose_name="سجل التسليم الفاشل"
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        verbose_name="القناة"
    )
    attempt_count = models.IntegerField(
        verbose_name="عدد المحاولات المنفذة"
    )
    last_error = models.TextField(
        verbose_name="تفاصيل الخطأ الأخير"
    )
    payload = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="حمولة وبيانات الإشعار"
    )
    resolved = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="تم حل المشكلة يدوياً من الإدارة"
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الحل"
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_dead_letters',
        verbose_name="تم الحل بواسطة"
    )

    class Meta:
        verbose_name = "إشعار في طابور الرسائل الميتة (Dead Letter Notification)"
        verbose_name_plural = "طابور الرسائل الميتة (DLQ)"
        ordering = ['-created_at']

    def __str__(self):
        return f"DeadLetter({self.channel}): Notification {self.notification_id} - Attempts: {self.attempt_count}"


class PushSubscription(TimeStampedUUIDModel):
    """
    نموذج تسجيل اشتراكات Web Push عبر متصفحات المستخدمين (VAPID Push Subscriptions).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions',
        verbose_name="المستخدم"
    )
    endpoint = models.URLField(
        max_length=1000,
        unique=True,
        verbose_name="عنوان الـ Push Service Endpoint"
    )
    p256dh = models.CharField(
        max_length=255,
        verbose_name="مفتاح العميل العام (P256DH Key)"
    )
    auth = models.CharField(
        max_length=255,
        verbose_name="رمز التفويض السري (Auth Secret)"
    )
    user_agent = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="معلومات المتصفح والجهاز"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="نشط ومتاح للاستقبال"
    )
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ آخر إرسال ناجح"
    )

    class Meta:
        verbose_name = "اشتراك دفع وتنبيهات المتصفح (Web Push Subscription)"
        verbose_name_plural = "اشتراكات دفع وتنبيهات المتصفح"
        indexes = [
            models.Index(fields=['user', 'is_active']),
        ]

    def __str__(self):
        return f"PushSubscription(User: {self.user_id}) - {'Active' if self.is_active else 'Inactive'}"
