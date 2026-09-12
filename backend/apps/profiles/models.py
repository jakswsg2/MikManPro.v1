import uuid
from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedUUIDModel

class Profile(TimeStampedUUIDModel):
    name = models.CharField(max_length=100, unique=True, verbose_name="اسم البروفايل")
    code = models.CharField(max_length=50, unique=True, verbose_name="كود البروفايل")
    description = models.TextField(blank=True, verbose_name="الوصف")
    is_system = models.BooleanField(default=False, verbose_name="بروفايل نظام أساسي (محمي)")
    permissions = models.JSONField(default=list, verbose_name="الصلاحيات الافتراضية")
    max_devices = models.PositiveIntegerField(default=1, verbose_name="الحد الأقصى للأجهزة")
    max_concurrent_sessions = models.PositiveIntegerField(default=1, verbose_name="الجلسات المتزامنة")

    class Meta:
        verbose_name = "بروفايل الصلاحيات (Profile)"
        verbose_name_plural = "بروفايلات الصلاحيات"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"

class UserProfileAssignment(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile_assignments",
        verbose_name="المستخدم"
    )
    profile = models.ForeignKey(
        Profile,
        on_delete=models.PROTECT,
        related_name="user_assignments",
        verbose_name="البروفايل المسند"
    )
    assigned_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإسناد")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profile_delegations",
        verbose_name="المُسنِد"
    )
    is_active = models.BooleanField(default=True, verbose_name="نشط حالياً")

    class Meta:
        verbose_name = "إسناد بروفايل لمستخدم"
        verbose_name_plural = "إسنادات البروفايلات"
        ordering = ['-assigned_at']

    def save(self, *args, **kwargs):
        # Guarantee single active profile assignment per user
        if self.is_active:
            UserProfileAssignment.objects.filter(user=self.user, is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} -> {self.profile.name} (Active: {self.is_active})"
