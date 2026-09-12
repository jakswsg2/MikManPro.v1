import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from apps.core.models import TimeStampedUUIDModel

class Permission(TimeStampedUUIDModel):
    class Category(models.TextChoices):
        CONTENT = 'content', 'محتوى ووسائط (Content)'
        FEATURES = 'features', 'ميزات وخدمات (Features)'
        ADMIN = 'admin', 'إدارة وتحكم (Admin)'
        PLAYBACK = 'playback', 'تشغيل وبث (Playback)'
        SYSTEM = 'system', 'نظام وأمان (System)'

    class ResourceType(models.TextChoices):
        MEDIA_ITEM = 'MEDIA_ITEM', 'عنصر وسائط (Media Item)'
        MEDIA_SERVER = 'MEDIA_SERVER', 'خادم وسائط (Media Server)'
        USER = 'USER', 'مستخدم (User)'
        PROFILE = 'PROFILE', 'بروفايل (Profile)'
        TENANT = 'TENANT', 'مستأجر (Tenant)'
        SITE = 'SITE', 'موقع/فرع (Site)'
        SYSTEM = 'SYSTEM', 'نظام عام (System)'

    class Action(models.TextChoices):
        VIEW = 'view', 'عرض واستعراض (View)'
        PLAY = 'play', 'تشغيل وبث (Play)'
        DOWNLOAD = 'download', 'تحميل (Download)'
        CREATE = 'create', 'إنشاء (Create)'
        EDIT = 'edit', 'تعديل (Edit)'
        DELETE = 'delete', 'حذف (Delete)'
        MANAGE = 'manage', 'إدارة شاملة (Manage)'
        PUBLISH = 'publish', 'نشر وتوزيع (Publish)'

    code = models.CharField(max_length=100, unique=True, db_index=True, verbose_name="كود الصلاحية")
    name = models.CharField(max_length=150, verbose_name="اسم الصلاحية")
    category = models.CharField(
        max_length=50,
        choices=Category.choices,
        default=Category.CONTENT,
        verbose_name="التصنيف"
    )
    resource_type = models.CharField(
        max_length=50,
        choices=ResourceType.choices,
        default=ResourceType.MEDIA_ITEM,
        verbose_name="نوع المورد"
    )
    action = models.CharField(
        max_length=50,
        choices=Action.choices,
        default=Action.VIEW,
        verbose_name="الإجراء"
    )
    description = models.TextField(blank=True, verbose_name="الوصف")
    is_system = models.BooleanField(default=True, verbose_name="صلاحية نظام أساسية (غير قابلة للحذف)")
    requires_scope = models.BooleanField(default=False, verbose_name="تتطلب نطاق Tenant/Site Scope")

    class Meta:
        verbose_name = "صلاحية متعددة الأبعاد"
        verbose_name_plural = "الصلاحيات المتعددة الأبعاد"
        ordering = ['category', 'code']

    def __str__(self):
        return f"{self.name} [{self.code}]"


class Role(TimeStampedUUIDModel):
    class ScopeLevel(models.TextChoices):
        GLOBAL = 'GLOBAL', 'عالمي (Global)'
        TENANT = 'TENANT', 'على مستوى المستأجر (Tenant)'
        SITE = 'SITE', 'على مستوى الفرع/الموقع (Site)'
        USER = 'USER', 'مستخدم افتراضي (User)'

    code = models.CharField(max_length=64, unique=True, db_index=True, verbose_name="كود الدور")
    name = models.CharField(max_length=150, verbose_name="اسم الدور")
    description = models.TextField(blank=True, verbose_name="وصف الدور")
    is_system = models.BooleanField(default=True, verbose_name="دور نظام قياسي")
    scope_level = models.CharField(
        max_length=32,
        choices=ScopeLevel.choices,
        default=ScopeLevel.USER,
        verbose_name="مستوى النطاق (Scope Level)"
    )
    is_assignable = models.BooleanField(default=True, verbose_name="قابل للتعيين يدوياً")

    # علاقة M2M مع الصلاحيات عبر نموذج RolePermission الوسيط
    permissions = models.ManyToManyField(
        Permission,
        through='RolePermission',
        related_name='roles',
        blank=True,
        verbose_name="الصلاحيات المخصصة"
    )

    class Meta:
        verbose_name = "دور صلاحيات (Role)"
        verbose_name_plural = "الأدوار (Roles)"
        ordering = ['scope_level', 'code']

    def __str__(self):
        return f"{self.name} ({self.code}) - {self.get_scope_level_display()}"

    @property
    def is_super_admin(self) -> bool:
        """فحص ما إذا كان الدور هو مدير عام المنظومة الأعلى"""
        return self.code == 'SUPER_ADMIN'

    @property
    def is_global_scope(self) -> bool:
        return self.scope_level == self.ScopeLevel.GLOBAL

    @property
    def is_tenant_scope(self) -> bool:
        return self.scope_level == self.ScopeLevel.TENANT

    @property
    def is_site_scope(self) -> bool:
        return self.scope_level == self.ScopeLevel.SITE

    @property
    def is_user_scope(self) -> bool:
        return self.scope_level == self.ScopeLevel.USER

    def get_allowed_permissions(self):
        """جلب جميع الصلاحيات الممنوحة بهذا الدور مع استبعاد المحظورة صراحة"""
        return self.permissions.filter(role_bindings__effect=RolePermission.Effect.ALLOW)

    def has_permission(self, permission_code: str) -> bool:
        """فحص سريع لامتلاك الدور لصلاحية معينة"""
        if self.is_super_admin:
            return True
        return self.permissions_map.filter(
            permission__code=permission_code,
            effect=RolePermission.Effect.ALLOW
        ).exists()


class RolePermission(TimeStampedUUIDModel):
    class Effect(models.TextChoices):
        ALLOW = 'ALLOW', 'منح (Allow)'
        DENY = 'DENY', 'حظر صريح (Deny)'

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="permissions_map", verbose_name="الدور")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="role_bindings", verbose_name="الصلاحية")
    effect = models.CharField(max_length=16, choices=Effect.choices, default=Effect.ALLOW, verbose_name="الأثر")

    class Meta:
        verbose_name = "ربط دور بصلاحية"
        verbose_name_plural = "روابط الأدوار بالصلاحيات"
        unique_together = ('role', 'permission')
        indexes = [
            models.Index(fields=['role', 'effect'], name='idx_roleperm_role_effect'),
            models.Index(fields=['permission', 'effect'], name='idx_roleperm_perm_effect'),
        ]

    def __str__(self):
        return f"{self.role.code} -> {self.permission.code} [{self.effect}]"


class UserRoleAssignment(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_assignments",
        verbose_name="المستخدم"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_assignments", verbose_name="الدور")
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="role_assignments",
        verbose_name="المستأجر (Tenant)"
    )
    site = models.ForeignKey(
        'tenancy.Site',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="role_assignments",
        verbose_name="الموقع (Site)"
    )
    assigned_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التعيين")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_roles",
        verbose_name="المسند بواسطة"
    )
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الانتهاء")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    revoked_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الإلغاء")
    revoked_reason = models.CharField(max_length=255, null=True, blank=True, verbose_name="سبب الإلغاء")

    class Meta:
        verbose_name = "تعيين دور لمستخدم بنطاق"
        verbose_name_plural = "تعيينات أدوار المستخدمين"
        ordering = ['-assigned_at']

    def clean(self):
        super().clean()
        if self.role.scope_level == Role.ScopeLevel.GLOBAL:
            if self.tenant is not None or self.site is not None:
                raise ValidationError("أدوار النطاق العالمي (GLOBAL) يجب أن يكون المستأجر والموقع فارغين (NULL).")
        elif self.role.scope_level == Role.ScopeLevel.TENANT:
            if self.tenant is None:
                raise ValidationError("أدوار مستوى المستأجر (TENANT) تتطلب تحديد المستأجر إلزامياً.")
            if self.site is not None:
                raise ValidationError("أدوار مستوى المستأجر (TENANT) يجب ألا تحتوي على موقع (Site must be NULL).")
        elif self.role.scope_level == Role.ScopeLevel.SITE:
            if self.site is None:
                raise ValidationError("أدوار مستوى الموقع (SITE) تتطلب تحديد الموقع إلزامياً.")
            if self.tenant is None and self.site:
                self.tenant = self.site.tenant
        elif self.role.scope_level == Role.ScopeLevel.USER:
            raise ValidationError("أدوار مستوى المستخدم (USER) لا يتم تعيينها عبر هذا الجدول، بل عبر البروفايل أو المجموعات.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        scope_str = f"Site: {self.site.code}" if self.site else (f"Tenant: {self.tenant.slug}" if self.tenant else "Global")
        return f"{self.user.username} -> {self.role.code} ({scope_str})"


class PermissionGroup(TimeStampedUUIDModel):
    name = models.CharField(max_length=150, verbose_name="اسم المجموعة")
    code = models.CharField(max_length=100, unique=True, db_index=True, verbose_name="كود المجموعة")
    description = models.TextField(blank=True, verbose_name="الوصف")
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="permission_groups",
        verbose_name="المستأجر"
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="associated_groups",
        verbose_name="الدور الأساسي المرتبط"
    )
    is_system = models.BooleanField(default=False, verbose_name="مجموعة نظام قياسية")
    priority = models.IntegerField(default=100, verbose_name="الأولوية في التقييم (الأعلى أولاً)")

    class Meta:
        verbose_name = "مجموعة صلاحيات (Permission Group)"
        verbose_name_plural = "مجموعات الصلاحيات"
        ordering = ['-priority', 'name']

    def __str__(self):
        return f"{self.name} [{self.code}] (Priority: {self.priority})"


class GroupPermission(TimeStampedUUIDModel):
    class Effect(models.TextChoices):
        ALLOW = 'ALLOW', 'منح (Allow)'
        DENY = 'DENY', 'حظر صريح (Deny)'

    group = models.ForeignKey(PermissionGroup, on_delete=models.CASCADE, related_name="group_permissions", verbose_name="المجموعة")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="group_bindings", verbose_name="الصلاحية")
    effect = models.CharField(max_length=16, choices=Effect.choices, default=Effect.ALLOW, verbose_name="الأثر")

    class Meta:
        verbose_name = "ربط مجموعة بصلاحية"
        verbose_name_plural = "روابط المجموعات بالصلاحيات"
        unique_together = ('group', 'permission')

    def __str__(self):
        return f"{self.group.code} -> {self.permission.code} [{self.effect}]"


class UserGroupAssignment(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
        verbose_name="المستخدم"
    )
    group = models.ForeignKey(PermissionGroup, on_delete=models.CASCADE, related_name="members", verbose_name="المجموعة")
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_groups",
        verbose_name="المستأجر"
    )
    site = models.ForeignKey(
        'tenancy.Site',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_groups",
        verbose_name="الموقع"
    )
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    class Meta:
        verbose_name = "عضوية مستخدم في مجموعة"
        verbose_name_plural = "عضويات المستخدمين في المجموعات"
        unique_together = ('user', 'group')

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"


class UserPermissionOverride(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
        verbose_name="المستخدم"
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="user_overrides",
        verbose_name="الصلاحية"
    )
    is_granted = models.BooleanField(
        default=True,
        verbose_name="منح استثنائي (True) / حظر استثنائي (False)"
    )
    reason = models.CharField(max_length=255, blank=True, verbose_name="سبب الاستثناء")
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ انتهاء الاستثناء")

    class Meta:
        verbose_name = "استثناء صلاحية مستخدم"
        verbose_name_plural = "استثناءات صلاحيات المستخدمين"
        unique_together = ('user', 'permission')

    def __str__(self):
        action = "منح" if self.is_granted else "حظر"
        return f"{self.user.username} - {action} ({self.permission.code})"


class ResourcePermissionOverride(TimeStampedUUIDModel):
    """
    Decision 37 & Resource-Level Permissions:
    منح أو حظر مستخدم من مورد محدد (عنصر وسائط محدد، مكتبة محددة، خادم محدد)
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resource_overrides",
        verbose_name="المستخدم"
    )
    resource_type = models.CharField(
        max_length=50,
        choices=Permission.ResourceType.choices,
        verbose_name="نوع المورد"
    )
    resource_id = models.CharField(max_length=128, db_index=True, verbose_name="معرّف المورد")
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="resource_overrides",
        verbose_name="الصلاحية المعنية"
    )
    is_granted = models.BooleanField(default=True, verbose_name="منح (True) / حظر صريح (False)")
    reason = models.CharField(max_length=255, blank=True, verbose_name="السبب")
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name="تاريخ الانتهاء")

    class Meta:
        verbose_name = "استثناء صلاحية على مستوى المورد"
        verbose_name_plural = "استثناءات الصلاحيات على مستوى الموارد"
        unique_together = ('user', 'resource_type', 'resource_id', 'permission')

    def __str__(self):
        action = "ALLOW" if self.is_granted else "DENY"
        return f"{self.user.username} -> {self.resource_type}:{self.resource_id} ({self.permission.code}) [{action}]"

