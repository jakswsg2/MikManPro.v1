import uuid
from django.db import models
from django.utils import timezone

class RadiusServer(models.Model):
    """
    نموذج خادم RADIUS (Decision 32: Hybrid RADIUS Gateway - Primary / Secondary / Failover)
    يدير الربط مع خوادم FreeRADIUS لإجراء عمليات المصادقة والمحاسبة لكروت الهوتسبوت.
    """
    class ServerRole(models.TextChoices):
        PRIMARY = 'PRIMARY', 'الخادم الرئيسي (Primary)'
        SECONDARY = 'SECONDARY', 'الخادم الاحتياطي (Secondary)'
        FAILOVER = 'FAILOVER', 'خادم الطوارئ (Failover Disaster Recovery)'

    class Status(models.TextChoices):
        ONLINE = 'ONLINE', 'متصل (Online)'
        OFFLINE = 'OFFLINE', 'غير متاح (Offline)'
        DEGRADED = 'DEGRADED', 'استجابة بطيئة (Degraded)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=100,
        verbose_name="اسم خادم RADIUS (مثال: FreeRADIUS Core-01)"
    )
    host = models.CharField(
        max_length=128,
        verbose_name="عنوان IP أو اسم المضيف"
    )
    auth_port = models.PositiveIntegerField(
        default=1812,
        verbose_name="منفذ المصادقة (Auth Port: 1812)"
    )
    acct_port = models.PositiveIntegerField(
        default=1813,
        verbose_name="منفذ المحاسبة (Acct Port: 1813)"
    )
    secret_encrypted = models.CharField(
        max_length=255,
        verbose_name="مرجع السر المشترك المشفر (RADIUS Secret Reference)"
    )
    role = models.CharField(
        max_length=20,
        choices=ServerRole.choices,
        default=ServerRole.PRIMARY,
        verbose_name="دور الخادم في الاستراتيجية"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="مفعّل"
    )
    priority = models.PositiveIntegerField(
        default=1,
        verbose_name="الأولوية (1 الأعلى)"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ONLINE,
        verbose_name="حالة الخادم"
    )
    last_health_check = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر فحص صحة"
    )
    latency_ms = models.FloatField(
        default=0.8,
        verbose_name="زمن الاستجابة (ms)"
    )
    total_requests = models.PositiveIntegerField(
        default=0,
        verbose_name="إجمالي الطلبات"
    )
    failed_requests = models.PositiveIntegerField(
        default=0,
        verbose_name="الطلبات الفاشلة"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "خادم RADIUS"
        verbose_name_plural = "خوادم RADIUS"
        ordering = ['priority', 'name']

    def __str__(self):
        return f"{self.name} ({self.host}) - [{self.role}]"
