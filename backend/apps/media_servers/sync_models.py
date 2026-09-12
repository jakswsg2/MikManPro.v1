import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedUUIDModel
from apps.media_servers.models import MediaServer


class SyncJob(TimeStampedUUIDModel):
    """
    Architectural Decision 19 & Decision 56:
    Sync Job execution tracker for scheduled, full, incremental, and reconciliation syncs.
    """
    class SyncType(models.TextChoices):
        FULL = 'FULL', 'مزامنة شاملة (Full Sync)'
        INCREMENTAL = 'INCREMENTAL', 'مزامنة تزايدية (Incremental Sync)'
        RECONCILIATION = 'RECONCILIATION', 'مطابقة وإصلاح الفروقات (Reconciliation)'
        LIBRARY = 'LIBRARY', 'مزامنة مكتبة محددة (Single Library Sync)'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'في الانتظار'
        RUNNING = 'RUNNING', 'قيد التنفيذ'
        COMPLETED = 'COMPLETED', 'اكتمل بنجاح'
        FAILED = 'FAILED', 'فشل'
        PARTIAL = 'PARTIAL', 'اكتمل جزئياً مع تحذيرات'

    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name="sync_jobs",
        verbose_name="خادم الوسائط"
    )
    sync_type = models.CharField(
        max_length=32,
        choices=SyncType.choices,
        default=SyncType.INCREMENTAL,
        verbose_name="نوع المزامنة"
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="حالة الوظيفة"
    )
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت البدء")
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت الانتهاء")
    
    items_scanned = models.IntegerField(default=0, verbose_name="العناصر المفحوصة")
    items_created = models.IntegerField(default=0, verbose_name="عناصر جديدة مضافة")
    items_updated = models.IntegerField(default=0, verbose_name="عناصر تم تحديثها")
    items_marked_unavailable = models.IntegerField(default=0, verbose_name="عناصر غير متوفرة")
    items_deduplicated = models.IntegerField(default=0, verbose_name="عناصر تم دمجها منطقياً")
    
    error_message = models.TextField(blank=True, verbose_name="رسالة الخطأ إن وجدت")
    details = models.JSONField(default=dict, blank=True, verbose_name="تفاصيل وإحصائيات إضافية")

    class Meta:
        verbose_name = "مهمة مزامنة وسائط (Sync Job)"
        verbose_name_plural = "مهام مزامنة الوسائط"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['media_server', 'status'], name='idx_syncjob_srv_status'),
            models.Index(fields=['sync_type', 'created_at'], name='idx_syncjob_type_date'),
        ]

    def __str__(self):
        return f"{self.media_server.name} - {self.get_sync_type_display()} [{self.get_status_display()}]"
