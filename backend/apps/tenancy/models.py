import uuid
from django.db import models
from apps.core.models import TimeStampedUUIDModel

class Tenant(TimeStampedUUIDModel):
    name = models.CharField(max_length=150, verbose_name="اسم المستأجر")
    slug = models.SlugField(unique=True, verbose_name="المعرّف اللطيف")
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    class Meta:
        verbose_name = "مستأجر / جهة"
        verbose_name_plural = "المستأجرين"

    def __str__(self):
        return self.name

class Site(TimeStampedUUIDModel):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="sites", verbose_name="المستأجر")
    name = models.CharField(max_length=150, verbose_name="اسم الموقع / الفرع")
    code = models.CharField(max_length=50, unique=True, verbose_name="كود الموقع")
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    class Meta:
        verbose_name = "موقع / فرع"
        verbose_name_plural = "المواقع والفروع"

    def __str__(self):
        return f"{self.tenant.name} - {self.name} ({self.code})"
