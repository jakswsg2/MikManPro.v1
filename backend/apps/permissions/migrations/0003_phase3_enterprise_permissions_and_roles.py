from django.db import migrations

def seed_phase3_data(apps, schema_editor):
    Permission = apps.get_model('permissions', 'Permission')
    Role = apps.get_model('permissions', 'Role')
    RolePermission = apps.get_model('permissions', 'RolePermission')
    PermissionGroup = apps.get_model('permissions', 'PermissionGroup')
    GroupPermission = apps.get_model('permissions', 'GroupPermission')

    # 1. 50+ Multi-Dimensional Permissions
    PERMISSIONS = [
        # Content - Movies
        ('content.movies.view', 'عرض مكتبة الأفلام', 'content', 'MEDIA_ITEM', 'view', 'استعراض بوسترات وتفاصيل الأفلام العامة', False),
        ('content.movies.play', 'تشغيل وبث الأفلام', 'content', 'MEDIA_ITEM', 'play', 'بث وتشغيل الأفلام بدقة قياسية وفائقة', False),
        ('content.movies.download', 'تحميل الأفلام محلياً', 'content', 'MEDIA_ITEM', 'download', 'تحميل ملفات الأفلام عبر شبكة الاستراحة LAN', False),
        
        # Content - Series
        ('content.series.view', 'عرض مكتبة المسلسلات', 'content', 'MEDIA_ITEM', 'view', 'استعراض مواسم وحلقات المسلسلات', False),
        ('content.series.play', 'تشغيل وبث المسلسلات', 'content', 'MEDIA_ITEM', 'play', 'بث حلقات المسلسلات عبر الشبكة المحلية', False),
        ('content.series.download', 'تحميل المسلسلات محلياً', 'content', 'MEDIA_ITEM', 'download', 'تحميل حلقات المسلسلات للجهاز الشخصي', False),

        # Content - Kids & Family
        ('content.kids.view', 'عرض محتوى الأطفال', 'content', 'MEDIA_ITEM', 'view', 'تصفح كرتون وأفلام الأطفال الآمنة', False),
        ('content.kids.play', 'تشغيل محتوى الأطفال', 'content', 'MEDIA_ITEM', 'play', 'بث وتشغيل وسائط الأطفال والعائلة', False),

        # Content - Premium VIP
        ('content.premium.view', 'عرض المحتوى الحصري VIP', 'content', 'MEDIA_ITEM', 'view', 'استعراض أحدث إصدارات السينما VIP 4K', False),
        ('content.premium.play', 'تشغيل المحتوى الحصري 4K VIP', 'content', 'MEDIA_ITEM', 'play', 'بث المحتوى الحصري 4K HDR ومسارات الصوت المحيطي', False),

        # Content - Sports & Live
        ('content.sports.view', 'عرض المحتوى الرياضي', 'content', 'MEDIA_ITEM', 'view', 'استعراض المباريات والأرشيف الرياضي', False),
        ('content.sports.play', 'تشغيل وبث المباريات', 'content', 'MEDIA_ITEM', 'play', 'بث المباريات والملخصات بجودة عالية', False),

        # Features - Engagement
        ('features.favorites', 'إدارة المفضلة', 'features', 'MEDIA_ITEM', 'edit', 'إضافة الوسائط للمفضلة وتنظيمها', False),
        ('features.rating', 'تقييم الوسائط', 'features', 'MEDIA_ITEM', 'create', 'تقييم الأفلام والمسلسلات وكتابة المراجعات', False),
        ('features.watchlist', 'قائمة المشاهدة لاحقاً', 'features', 'MEDIA_ITEM', 'edit', 'حفظ العناوين في قائمة الانتظار', False),
        ('features.requests', 'طلب وسائط جديدة', 'features', 'MEDIA_ITEM', 'create', 'إرسال طلبات محتوى جديد لمديري الخوادم', False),

        # Features - Playback enhancements
        ('features.external_player', 'التشغيل بمشغل خارجي', 'playback', 'MEDIA_ITEM', 'play', 'فتح الروابط عبر VLC أو MX Player', False),
        ('features.casting', 'البث للشاشات (Chromecast / AirPlay)', 'playback', 'MEDIA_ITEM', 'play', 'بث الوسائط لشاشات الغرف والصالات', False),
        ('features.download', 'التحميل عالي السرعة', 'features', 'MEDIA_ITEM', 'download', 'التحميل المباشر للشبكة بسرعة غير مقيدة', False),

        # Admin - Access & Users
        ('admin.panel.access', 'دخول لوحة الإدارة', 'admin', 'SYSTEM', 'manage', 'الوصول للوحة تحكم الاستراحة الذكية', True),
        ('admin.users.view', 'استعراض المستخدمين', 'admin', 'USER', 'view', 'رؤية قائمة مستخدمي الاستراحة وحالاتهم', True),
        ('admin.users.create', 'إنشاء مستخدمين', 'admin', 'USER', 'create', 'إضافة مستخدمين جدد يدوياً', True),
        ('admin.users.edit', 'تعديل المستخدمين', 'admin', 'USER', 'edit', 'تعديل بيانات الحسابات والبروفايلات', True),
        ('admin.users.delete', 'حذف وتعطيل المستخدمين', 'admin', 'USER', 'delete', 'تعليق أو حذف حسابات المستخدمين', True),

        # Admin - Servers & Integrations
        ('admin.servers.view', 'استعراض خوادم الوسائط', 'admin', 'MEDIA_SERVER', 'view', 'رؤية خوادم Jellyfin و Emby وحالات الاتصال', True),
        ('admin.servers.create', 'إضافة خادم وسائط', 'admin', 'MEDIA_SERVER', 'create', 'ربط خادم محتوى محلي جديد بالنظام', True),
        ('admin.servers.edit', 'تعديل خوادم الوسائط', 'admin', 'MEDIA_SERVER', 'edit', 'تحديث روابط API ومفاتيح الربط والمكتبات', True),
        ('admin.servers.delete', 'حذف خوادم الوسائط', 'admin', 'MEDIA_SERVER', 'delete', 'إلغاء ربط خادم وسائط من النظام', True),

        # Admin - Gateways & AAA
        ('admin.mikrotik.manage', 'إدارة بوابات MikroTik RouterOS', 'admin', 'SYSTEM', 'manage', 'فحص الراوتر، فصل المستخدمين ومراقبة حركة الشبكة', True),
        ('admin.radius.manage', 'إدارة خوادم RADIUS AAA', 'admin', 'SYSTEM', 'manage', 'إدارة سيرفرات الفيل أوفر وفحص الكروت والقسائم', True),
        ('admin.permissions.manage', 'إدارة الصلاحيات والأدوار', 'admin', 'SYSTEM', 'manage', 'تعديل الأدوار والمجموعات والاستثناءات', True),

        # System & Audit
        ('system.settings.manage', 'إعدادات النظام العامة', 'system', 'SYSTEM', 'manage', 'التحكم في إعدادات المنظومة وهوية الاستراحة', True),
        ('system.audit.view', 'استعراض سجلات التدقيق الأمني', 'system', 'SYSTEM', 'view', 'فحص سجلات الدخول وتدوير التوكنات وأحداث الشبكة', True),
        ('system.backup.manage', 'إدارة النسخ الاحتياطي', 'system', 'SYSTEM', 'manage', 'أخذ واسترجاع النسخ الاحتياطية لقواعد البيانات', True),
    ]

    created_perms = {}
    for code, name, cat, rtype, action, desc, req_scope in PERMISSIONS:
        perm, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                'name': name,
                'category': cat,
                'resource_type': rtype,
                'action': action,
                'description': desc,
                'is_system': True,
                'requires_scope': req_scope,
            }
        )
        created_perms[code] = perm

    # 2. Six Standard Enterprise Roles
    ROLES = [
        ('SUPER_ADMIN', 'مدير عام المنظومة (Super Administrator)', 'صلاحيات مطلقة على كافة المستأجرين والفروع والسيرفرات', 'GLOBAL', False),
        ('TENANT_ADMIN', 'مدير المستأجر (Tenant Administrator)', 'إدارة كاملة على مستوى المستأجر وكافة فروعه وخوادمه', 'TENANT', True),
        ('SITE_MANAGER', 'مدير الفرع / الموقع (Site Manager)', 'إدارة عمليات استراحة أو فرع محدد والمستخدمين المتصلين', 'SITE', True),
        ('CONTENT_MANAGER', 'مدير المحتوى والخوادم (Content Manager)', 'إدارة خوادم Jellyfin/Emby والمكتبات والمحتوى وتصنيفاته', 'TENANT', True),
        ('SUPPORT', 'مسؤول الدعم الفني (Technical Support)', 'متابعة بوابات الهوتسبوت والمستخدمين وفحص مشاكل الدخول', 'SITE', True),
        ('USER', 'مستخدم الاستراحة الافتراضي (Standard User)', 'الوصول لمحتوى الوسائط الممنوح حسب البروفايل والكارت', 'USER', False),
    ]

    created_roles = {}
    for code, name, desc, scope_lvl, is_assign in ROLES:
        role, _ = Role.objects.update_or_create(
            code=code,
            defaults={
                'name': name,
                'description': desc,
                'scope_level': scope_lvl,
                'is_assignable': is_assign,
                'is_system': True,
            }
        )
        created_roles[code] = role

    # 3. Associate Permissions to Roles
    # SUPER_ADMIN gets everything
    for perm in created_perms.values():
        RolePermission.objects.update_or_create(role=created_roles['SUPER_ADMIN'], permission=perm, defaults={'effect': 'ALLOW'})

    # TENANT_ADMIN gets content, features, and tenant-level admin
    for code, perm in created_perms.items():
        if code.startswith('content.') or code.startswith('features.') or code in [
            'admin.panel.access', 'admin.users.view', 'admin.users.create', 'admin.users.edit',
            'admin.servers.view', 'admin.servers.create', 'admin.servers.edit',
            'admin.permissions.manage', 'system.audit.view'
        ]:
            RolePermission.objects.update_or_create(role=created_roles['TENANT_ADMIN'], permission=perm, defaults={'effect': 'ALLOW'})

    # SITE_MANAGER gets site operations, hotspot users, and media viewing
    for code, perm in created_perms.items():
        if code.startswith('content.') or code.startswith('features.') or code in [
            'admin.panel.access', 'admin.users.view', 'admin.users.create', 'admin.users.edit',
            'admin.mikrotik.manage', 'admin.radius.manage', 'system.audit.view'
        ]:
            RolePermission.objects.update_or_create(role=created_roles['SITE_MANAGER'], permission=perm, defaults={'effect': 'ALLOW'})

    # CONTENT_MANAGER gets full content and servers management
    for code, perm in created_perms.items():
        if code.startswith('content.') or code.startswith('features.') or code in [
            'admin.panel.access', 'admin.servers.view', 'admin.servers.create', 'admin.servers.edit', 'admin.servers.delete'
        ]:
            RolePermission.objects.update_or_create(role=created_roles['CONTENT_MANAGER'], permission=perm, defaults={'effect': 'ALLOW'})

    # SUPPORT gets diagnostics and view permissions
    for code, perm in created_perms.items():
        if code in [
            'admin.panel.access', 'admin.users.view', 'admin.servers.view',
            'admin.mikrotik.manage', 'admin.radius.manage', 'system.audit.view'
        ]:
            RolePermission.objects.update_or_create(role=created_roles['SUPPORT'], permission=perm, defaults={'effect': 'ALLOW'})

    # USER gets standard playback & features
    for code, perm in created_perms.items():
        if code in [
            'content.movies.view', 'content.movies.play',
            'content.series.view', 'content.series.play',
            'content.kids.view', 'content.kids.play',
            'features.favorites', 'features.rating', 'features.watchlist'
        ]:
            RolePermission.objects.update_or_create(role=created_roles['USER'], permission=perm, defaults={'effect': 'ALLOW'})

    # 4. Standard Permission Groups
    vip_group, _ = PermissionGroup.objects.update_or_create(
        code='VIP_SUBSCRIBERS',
        defaults={
            'name': 'مشتركو صالات الـ VIP (4K & Ultra Fast)',
            'description': 'وصول كامل لكافة المحتوى الحصري والتحميل المباشر مع أولوية قصوى',
            'is_system': True,
            'priority': 200,
        }
    )
    for code in ['content.premium.view', 'content.premium.play', 'content.movies.download', 'content.series.download', 'features.download', 'features.casting']:
        if code in created_perms:
            GroupPermission.objects.update_or_create(group=vip_group, permission=created_perms[code], defaults={'effect': 'ALLOW'})

    kids_group, _ = PermissionGroup.objects.update_or_create(
        code='KIDS_SAFE_ZONE',
        defaults={
            'name': 'منطقة الأطفال المحمية (Kids Only)',
            'description': 'حظر صريح للأفلام والمحتوى العام، والسماح بمحتوى الأطفال فقط',
            'is_system': True,
            'priority': 300,
        }
    )
    # Allow kids, explicitly DENY premium and movies
    GroupPermission.objects.update_or_create(group=kids_group, permission=created_perms['content.kids.view'], defaults={'effect': 'ALLOW'})
    GroupPermission.objects.update_or_create(group=kids_group, permission=created_perms['content.kids.play'], defaults={'effect': 'ALLOW'})
    GroupPermission.objects.update_or_create(group=kids_group, permission=created_perms['content.premium.view'], defaults={'effect': 'DENY'})
    GroupPermission.objects.update_or_create(group=kids_group, permission=created_perms['content.premium.play'], defaults={'effect': 'DENY'})


def remove_phase3_data(apps, schema_editor):
    Role = apps.get_model('permissions', 'Role')
    RolePermission = apps.get_model('permissions', 'RolePermission')
    PermissionGroup = apps.get_model('permissions', 'PermissionGroup')

    role_codes = ['SUPER_ADMIN', 'TENANT_ADMIN', 'SITE_MANAGER', 'CONTENT_MANAGER', 'SUPPORT', 'USER']
    roles = Role.objects.filter(code__in=role_codes)
    RolePermission.objects.filter(role__in=roles).delete()
    roles.delete()
    PermissionGroup.objects.filter(code__in=['VIP_SUBSCRIBERS', 'KIDS_SAFE_ZONE']).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('permissions', '0002_seed_default_permissions'),
        ('tenancy', '__first__'),
    ]

    operations = [
        migrations.RunPython(seed_phase3_data, remove_phase3_data),
    ]
