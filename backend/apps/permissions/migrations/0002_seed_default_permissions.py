from django.db import migrations

def seed_permissions(apps, schema_editor):
    Permission = apps.get_model('permissions', 'Permission')
    
    DEFAULT_PERMISSIONS = [
        {
            'code': 'content.movies.view',
            'name': 'مشاهدة الأفلام',
            'category': 'content',
            'description': 'إمكانية تصفح ومشاهدة مكتبة الأفلام العامة في الاستراحة',
        },
        {
            'code': 'content.series.view',
            'name': 'مشاهدة المسلسلات',
            'category': 'content',
            'description': 'إمكانية تصفح ومشاهدة المسلسلات والمواسم والحلقات',
        },
        {
            'code': 'content.kids.view',
            'name': 'محتوى الأطفال والعائلة',
            'category': 'content',
            'description': 'الوصول إلى أفلام الكرتون ومحتوى الأطفال المفلتر والآمن',
        },
        {
            'code': 'content.premium.view',
            'name': 'المحتوى الحصري VIP',
            'category': 'content',
            'description': 'مشاهدة أحدث إصدارات السينما والمحتوى الحصري فائق الدقة 4K HDR',
        },
        {
            'code': 'content.download',
            'name': 'التحميل المباشر للشبكة المحلية',
            'category': 'content',
            'description': 'السماح بتحميل ملفات الفيديو إلى جهاز المستخدم عبر الـ LAN',
        },
        {
            'code': 'feat.lan_chat',
            'name': 'المحادثة المحلية بالاستراحة',
            'category': 'features',
            'description': 'المشاركة في محادثة وغرفة تواصل زوار الاستراحة',
        },
        {
            'code': 'feat.custom_requests',
            'name': 'طلب إضافة محتوى جديد',
            'category': 'features',
            'description': 'إرسال طلبات للأدمن لإضافة أفلام أو مسلسلات معينة إلى الخادم',
        },
        {
            'code': 'admin.access',
            'name': 'لوحة الإدارة الكاملة',
            'category': 'admin',
            'description': 'الوصول إلى لوحة إدارة السيرفرات والمستخدمين والصلاحيات',
        },
    ]

    for p in DEFAULT_PERMISSIONS:
        Permission.objects.update_or_create(code=p['code'], defaults=p)

def remove_permissions(apps, schema_editor):
    Permission = apps.get_model('permissions', 'Permission')
    codes = [
        'content.movies.view', 'content.series.view', 'content.kids.view',
        'content.premium.view', 'content.download', 'feat.lan_chat',
        'feat.custom_requests', 'admin.access'
    ]
    Permission.objects.filter(code__in=codes).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('permissions', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_permissions, remove_permissions),
    ]
