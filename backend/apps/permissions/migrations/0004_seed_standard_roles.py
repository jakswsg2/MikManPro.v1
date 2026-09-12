"""
Data Migration لتهيئة الأدوار المؤسسية الأساسية (Enterprise Standard Roles)
القرار 37: دعم مستويات النطاق (GLOBAL, TENANT, SITE, USER)
وربط الأدوار بصلاحياتها من خلال نموذج RolePermission
"""
from django.db import migrations

def seed_standard_enterprise_roles(apps, schema_editor):
    Role = apps.get_model('permissions', 'Role')
    Permission = apps.get_model('permissions', 'Permission')
    RolePermission = apps.get_model('permissions', 'RolePermission')

    # تعريف الأدوار الأساسية الستة مع مستويات النطاق وقابلية الإسناد
    ROLES_DATA = [
        {
            'code': 'SUPER_ADMIN',
            'name': 'مدير عام المنظومة (Super Administrator)',
            'description': 'صلاحيات مطلقة وشاملة على مستوى كافة المستأجرين والفروع والسيرفرات وبوابات الشبكة.',
            'scope_level': 'GLOBAL',
            'is_system': True,
            'is_assignable': False,
        },
        {
            'code': 'TENANT_ADMIN',
            'name': 'مدير المستأجر (Tenant Administrator)',
            'description': 'إدارة كاملة على نطاق المستأجر بما يشمل كافة فروعه وخوادمه ومستخدميه ومجموعاته.',
            'scope_level': 'TENANT',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'SITE_MANAGER',
            'name': 'مدير الفرع / الموقع (Site Manager)',
            'description': 'إدارة عمليات استراحة أو فرع محدد، متابعة المستخدمين المتصلين بالهوتسبوت ومراقبة البوابات.',
            'scope_level': 'SITE',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'CONTENT_MANAGER',
            'name': 'مدير المحتوى والخوادم (Content Manager)',
            'description': 'إدارة خوادم الوسائط المحلية (Jellyfin/Emby) والمكتبات والتصنيفات وفلترة المحتوى.',
            'scope_level': 'TENANT',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'SUPPORT',
            'name': 'مسؤول الدعم الفني (Technical Support)',
            'description': 'تشخيص مشاكل الاتصال بالهوتسبوت وبوابات RADIUS وسجلات تدقيق الجلسات دون صلاحيات تعديل حساسة.',
            'scope_level': 'SITE',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'USER',
            'name': 'مستخدم الاستراحة الافتراضي (Standard User)',
            'description': 'المستخدم العادي للاستراحة المسموح له بتشغيل وبث الوسائط واستخدام المفضلة والتقييمات وفق بروفايله.',
            'scope_level': 'USER',
            'is_system': True,
            'is_assignable': False,
        },
    ]

    created_roles = {}
    for rdata in ROLES_DATA:
        role, _ = Role.objects.update_or_create(
            code=rdata['code'],
            defaults=rdata
        )
        created_roles[rdata['code']] = role

    # جلب جميع الصلاحيات الموجودة لربطها بالأدوار
    all_permissions = {p.code: p for p in Permission.objects.all()}

    # 1. SUPER_ADMIN: يحصل على كل الصلاحيات المتاحة في النظام بنطاق ALLOW
    for perm in all_permissions.values():
        RolePermission.objects.update_or_create(
            role=created_roles['SUPER_ADMIN'],
            permission=perm,
            defaults={'effect': 'ALLOW'}
        )

    # 2. TENANT_ADMIN: صلاحيات المحتوى والخدمات وإدارة المستخدمين والسيرفرات والتدقيق ضمن المستأجر
    tenant_admin_prefixes = ('content.', 'features.')
    tenant_admin_exact = {
        'admin.panel.access', 'admin.users.view', 'admin.users.create', 'admin.users.edit',
        'admin.servers.view', 'admin.servers.create', 'admin.servers.edit',
        'admin.permissions.manage', 'system.audit.view'
    }
    for code, perm in all_permissions.items():
        if code.startswith(tenant_admin_prefixes) or code in tenant_admin_exact:
            RolePermission.objects.update_or_create(
                role=created_roles['TENANT_ADMIN'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # 3. SITE_MANAGER: إدارة عمليات الفرع، هوتسبوت، مستخدمي الموقع، والمحتوى القياسي
    site_manager_prefixes = ('content.', 'features.')
    site_manager_exact = {
        'admin.panel.access', 'admin.users.view', 'admin.users.create', 'admin.users.edit',
        'admin.mikrotik.manage', 'admin.radius.manage', 'system.audit.view'
    }
    for code, perm in all_permissions.items():
        if code.startswith(site_manager_prefixes) or code in site_manager_exact:
            RolePermission.objects.update_or_create(
                role=created_roles['SITE_MANAGER'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # 4. CONTENT_MANAGER: إدارة خوادم الوسائط والمكتبات والمحتوى بالكامل
    content_manager_prefixes = ('content.', 'features.')
    content_manager_exact = {
        'admin.panel.access', 'admin.servers.view', 'admin.servers.create',
        'admin.servers.edit', 'admin.servers.delete'
    }
    for code, perm in all_permissions.items():
        if code.startswith(content_manager_prefixes) or code in content_manager_exact:
            RolePermission.objects.update_or_create(
                role=created_roles['CONTENT_MANAGER'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # 5. SUPPORT: الدعم الفني والتشخيص السريع
    support_exact = {
        'admin.panel.access', 'admin.users.view', 'admin.servers.view',
        'admin.mikrotik.manage', 'admin.radius.manage', 'system.audit.view'
    }
    for code, perm in all_permissions.items():
        if code in support_exact:
            RolePermission.objects.update_or_create(
                role=created_roles['SUPPORT'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # 6. USER: الصلاحيات التشغيلية التلقائية للمستخدم
    user_exact = {
        'content.movies.view', 'content.movies.play',
        'content.series.view', 'content.series.play',
        'content.kids.view', 'content.kids.play',
        'features.favorites', 'features.rating', 'features.watchlist'
    }
    for code, perm in all_permissions.items():
        if code in user_exact:
            RolePermission.objects.update_or_create(
                role=created_roles['USER'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )


def reverse_seed_standard_roles(apps, schema_editor):
    Role = apps.get_model('permissions', 'Role')
    RolePermission = apps.get_model('permissions', 'RolePermission')

    standard_codes = ['SUPER_ADMIN', 'TENANT_ADMIN', 'SITE_MANAGER', 'CONTENT_MANAGER', 'SUPPORT', 'USER']
    roles = Role.objects.filter(code__in=standard_codes)
    RolePermission.objects.filter(role__in=roles).delete()
    roles.delete()


class Migration(migrations.Migration):
    dependencies = [
        ('permissions', '0003_phase3_enterprise_permissions_and_roles'),
    ]

    operations = [
        migrations.RunPython(seed_standard_enterprise_roles, reverse_seed_standard_roles),
    ]
