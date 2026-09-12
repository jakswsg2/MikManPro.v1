import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone

class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('tenancy', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('lounge_id', models.CharField(db_index=True, editable=False, max_length=32, unique=True, verbose_name='معرّف الاستراحة (Lounge ID)')),
                ('username', models.CharField(db_index=True, max_length=150, unique=True, verbose_name='اسم المستخدم')),
                ('email', models.EmailField(blank=True, max_length=254, null=True, verbose_name='البريد الإلكتروني')),
                ('full_name', models.CharField(max_length=200, verbose_name='الاسم الكامل')),
                ('phone', models.CharField(blank=True, max_length=30, null=True, verbose_name='رقم الهاتف')),
                ('avatar', models.ImageField(blank=True, null=True, upload_to='avatars/', verbose_name='الصورة الشخصية')),
                ('language', models.CharField(choices=[('ar', 'العربية'), ('en', 'English')], default='ar', max_length=10, verbose_name='اللغة المفضلة')),
                ('timezone', models.CharField(default='Asia/Aden', max_length=50, verbose_name='المنطقة الزمنية')),
                ('status', models.CharField(choices=[('ACTIVE', 'نشط (Active)'), ('GRACE_PERIOD', 'فترة سماح (Grace Period)'), ('EXPIRED', 'منتهي الصلاحية (Expired)'), ('SUSPENDED', 'معلق (Suspended)')], db_index=True, default='ACTIVE', max_length=20, verbose_name='حالة الحساب')),
                ('is_active', models.BooleanField(default=True, verbose_name='نشط')),
                ('is_staff', models.BooleanField(default=False, verbose_name='طاقم إدارة')),
                ('is_superuser', models.BooleanField(default=False, verbose_name='مدير عام')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='users', to='tenancy.tenant', verbose_name='المستأجر (مستقبلي)')),
            ],
            options={
                'verbose_name': 'مستخدم الاستراحة (Lounge User)',
                'verbose_name_plural': 'مستخدمو الاستراحة',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ExternalIdentity',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('identity_type', models.CharField(choices=[('MIKROTIK', 'MikroTik Hotspot'), ('RADIUS', 'RADIUS Voucher/Card'), ('GOOGLE', 'Google OAuth (مستقبلي)'), ('LOCAL', 'حساب محلي مباشر (Direct Local)')], default='RADIUS', max_length=20, verbose_name='نوع الهوية الخارجية')),
                ('external_id', models.CharField(db_index=True, max_length=128, verbose_name='المعرّف الخارجي (مثال: CARD-10001 أو MAC Address)')),
                ('external_metadata', models.JSONField(blank=True, default=dict, verbose_name='بيانات وصفية من المصدر الخارجي')),
                ('is_primary', models.BooleanField(default=False, verbose_name='هوية أساسية')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الربط')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='external_identities', to=settings.AUTH_USER_MODEL, verbose_name='مستخدم الاستراحة المرتبط')),
            ],
            options={
                'verbose_name': 'هوية خارجية (External Identity)',
                'verbose_name_plural': 'الهويات الخارجية المرتبطة',
            },
        ),
        migrations.CreateModel(
            name='UserDevice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('mac_address', models.CharField(db_index=True, max_length=32, verbose_name='عنوان MAC للجهاز')),
                ('device_name', models.CharField(blank=True, default='جهاز غير محدد', max_length=100, verbose_name='اسم الجهاز / الطراز')),
                ('device_type', models.CharField(choices=[('TV', 'شاشة ذكية (Smart TV)'), ('MOBILE', 'هاتف محمول (Smartphone)'), ('TABLET', 'جهاز لوحي (Tablet)'), ('PC', 'كمبيوتر شخصي (Desktop/Laptop)'), ('OTHER', 'أخرى')], default='MOBILE', max_length=20, verbose_name='نوع الجهاز')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='آخر عنوان IP')),
                ('user_agent', models.TextField(blank=True, default='', verbose_name='User Agent')),
                ('last_seen', models.DateTimeField(default=django.utils.timezone.now, verbose_name='آخر ظهور على الشبكة')),
                ('is_trusted', models.BooleanField(default=True, verbose_name='جهاز موثوق')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ التسجيل الأول')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='devices', to=settings.AUTH_USER_MODEL, verbose_name='المستخدم')),
            ],
            options={
                'verbose_name': 'جهاز مسجل (User Device)',
                'verbose_name_plural': 'أجهزة المستخدمين المسجلة',
                'ordering': ['-last_seen'],
            },
        ),
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event_type', models.CharField(choices=[('USER_CREATED', 'إنشاء مستخدم جديد'), ('LOGIN_HOTSPOT', 'تسجيل دخول عبر بوابة Hotspot'), ('LOGIN_LOCAL', 'تسجيل دخول محلي'), ('LOGIN_FAILED', 'فشل المصادقة'), ('TOKEN_REFRESH', 'تجديد توكن الجلسة'), ('SESSION_REVOKED', 'إلغاء جلسة'), ('SESSIONS_REVOKE_ALL', 'تسجيل خروج من جميع الأجهزة'), ('CARD_LINKED', 'ربط كارت/هوية جديدة بحساب موجود'), ('ROUTER_SYNC', 'مزامنة بوابة MikroTik'), ('RADIUS_AUTH', 'فحص مصادقة RADIUS')], db_index=True, max_length=32, verbose_name='نوع الحدث')),
                ('external_identity_ref', models.CharField(blank=True, default='', max_length=128, verbose_name='مرجع الهوية الخارجية')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='عنوان IP')),
                ('user_agent', models.TextField(blank=True, default='', verbose_name='User-Agent')),
                ('details', models.JSONField(blank=True, default=dict, verbose_name='تفاصيل آمنة (خالية من الأسرار)')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='وقت الحدث')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to=settings.AUTH_USER_MODEL, verbose_name='المستخدم')),
            ],
            options={
                'verbose_name': 'سجل تدقيق أمني (Audit Log)',
                'verbose_name_plural': 'سجلات التدقيق الأمنية',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='externalidentity',
            constraint=models.UniqueConstraint(fields=('identity_type', 'external_id'), name='unique_identity_source'),
        ),
        migrations.AddConstraint(
            model_name='userdevice',
            constraint=models.UniqueConstraint(fields=('user', 'mac_address'), name='unique_user_device_mac'),
        ),
    ]
