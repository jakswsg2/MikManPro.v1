import uuid
from django.db import models

class TimeStampedUUIDModel(models.Model):
    """
    Abstract base model providing a UUID primary key and timestamp tracking.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        abstract = True
        ordering = ['-created_at']
