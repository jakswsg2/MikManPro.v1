import uuid
from django.db import models
from django.utils import timezone
from apps.tenancy.models import Tenant

class MikroTikRouter(models.Model):
    """
    نموذج موجه MikroTik RouterOS (Decision 31: Management Gateway)
    يمثل الراوتر أو السويتش الذي يدير شبكة الـ LAN والـ Hotspot الخاصة بالاستراحة.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mikrotik_routers',
        verbose_name="المستأجر"
    )
    name = models.CharField(
        max_length=100,
        verbose_name="اسم الراوتر التوضيحي (مثال: Lounge Core Gateway)"
    )
    host = models.CharField(
        max_length=128,
        verbose_name="عنوان IP أو المضيف (Host)"
    )
    port = models.PositiveIntegerField(
        default=8728,
        verbose_name="منفذ RouterOS API (8728 عادي / 8729 مشفر SSL)"
    )
    use_ssl = models.BooleanField(
        default=False,
        verbose_name="استخدام اتصال مشفر (API-SSL)"
    )
    username = models.CharField(
        max_length=64,
        default='smart_lounge_api',
        verbose_name="اسم مستخدم API (بأقل الصلاحيات Least Privilege)"
    )
    password_encrypted = models.CharField(
        max_length=255,
        verbose_name="مرجع كلمة المرور المشفرة (Decision 57)"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="مفعّل"
    )
    is_online = models.BooleanField(
        default=True,
        verbose_name="متصل بالشبكة (Online)"
    )
    last_seen_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخر اتصال ناجح"
    )
    latency_ms = models.FloatField(
        default=1.2,
        verbose_name="زمن الاستجابة (Latency ms)"
    )
    identity = models.CharField(
        max_length=64,
        default='MikroTik-Lounge-Core',
        verbose_name="هوية الراوتر (System Identity)"
    )
    routeros_version = models.CharField(
        max_length=32,
        default='RouterOS v7.14',
        verbose_name="إصدار RouterOS"
    )
    model = models.CharField(
        max_length=64,
        default='RB4011iGS+5HacQ2HnD',
        verbose_name="موديل الجهاز"
    )
    cpu_load = models.PositiveIntegerField(
        default=8,
        verbose_name="نسبة استهلاك المعالج %"
    )
    memory_free_mb = models.PositiveIntegerField(
        default=768,
        verbose_name="الذاكرة الحرة (MB)"
    )
    uptime = models.CharField(
        max_length=64,
        default='18d 14:32:10',
        verbose_name="مدة العمل (Uptime)"
    )
    active_hotspot_users_count = models.PositiveIntegerField(
        default=24,
        verbose_name="عدد مستخدمي الهوتسبوت المتصلين حالياً"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "موجه MikroTik (MikroTik Router)"
        verbose_name_plural = "موجهات MikroTik"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.host}:{self.port}) - {self.identity}"
