from django.db import migrations

def seed_profiles(apps, schema_editor):
    Profile = apps.get_model('profiles', 'Profile')

    DEFAULT_PROFILES = [
        {
            'name': 'البروفايل الأساسي (Basic)',
            'code': 'Basic',
            'description': 'مشاهدة الأفلام والمسلسلات العامة - بدون تحميل وبدون محتوى خاص - جهاز واحد',
            'is_system': True,
            'permissions': [
                'content.movies.view',
                'content.series.view',
                'feat.lan_chat',
            ],
            'max_devices': 1,
            'max_concurrent_sessions': 1,
        },
        {
            'name': 'البروفايل المميز (Premium VIP)',
            'code': 'Premium',
            'description': 'أفلام ومسلسلات ومحتوى حصري 4K مع ميزة التحميل المباشر - 4 أجهزة',
            'is_system': True,
            'permissions': [
                'content.movies.view',
                'content.series.view',
                'content.kids.view',
                'content.premium.view',
                'content.download',
                'feat.lan_chat',
                'feat.custom_requests',
            ],
            'max_devices': 4,
            'max_concurrent_sessions': 4,
        },
        {
            'name': 'بروفايل الأطفال (Kids)',
            'code': 'Kids',
            'description': 'محتوى كرتون وأفلام أطفال آمنة فقط - جهاز واحد',
            'is_system': True,
            'permissions': [
                'content.kids.view',
            ],
            'max_devices': 1,
            'max_concurrent_sessions': 1,
        },
        {
            'name': 'بروفايل الإدارة (Admin)',
            'code': 'Admin',
            'description': 'صلاحيات وصول وتحكم كاملة لمدير شبكة الاستراحة - أجهزة غير محدودة',
            'is_system': True,
            'permissions': [
                'content.movies.view',
                'content.series.view',
                'content.kids.view',
                'content.premium.view',
                'content.download',
                'feat.lan_chat',
                'feat.custom_requests',
                'admin.access',
                '*'
            ],
            'max_devices': 99,
            'max_concurrent_sessions': 99,
        },
    ]

    for p in DEFAULT_PROFILES:
        Profile.objects.update_or_create(code=p['code'], defaults=p)

def remove_profiles(apps, schema_editor):
    Profile = apps.get_model('profiles', 'Profile')
    Profile.objects.filter(code__in=['Basic', 'Premium', 'Kids', 'Admin']).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('profiles', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_profiles, remove_profiles),
    ]
