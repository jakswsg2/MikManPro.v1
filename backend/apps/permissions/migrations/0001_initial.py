import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tenancy', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Permission',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('code', models.CharField(db_index=True, max_length=100, unique=True, verbose_name='كود الصلاحية')),
                ('name', models.CharField(max_length=150, verbose_name='اسم الصلاحية')),
                ('category', models.CharField(choices=[('content', 'محتوى ووسائط (Content)'), ('features', 'ميزات وخدمات (Features)'), ('admin', 'إدارة وتحكم (Admin)'), ('playback', 'تشغيل وبث (Playback)'), ('system', 'نظام وأمان (System)')], default='content', max_length=50, verbose_name='التصنيف')),
                ('resource_type', models.CharField(choices=[('MEDIA_ITEM', 'عنصر وسائط (Media Item)'), ('MEDIA_SERVER', 'خادم وسائط (Media Server)'), ('USER', 'مستخدم (User)'), ('PROFILE', 'بروفايل (Profile)'), ('TENANT', 'مستأجر (Tenant)'), ('SITE', 'موقع/فرع (Site)'), ('SYSTEM', 'نظام عام (System)')], default='MEDIA_ITEM', max_length=50, verbose_name='نوع المورد')),
                ('action', models.CharField(choices=[('view', 'عرض واستعراض (View)'), ('play', 'تشغيل وبث (Play)'), ('download', 'تحميل (Download)'), ('create', 'إنشاء (Create)'), ('edit', 'تعديل (Edit)'), ('delete', 'حذف (Delete)'), ('manage', 'إدارة شاملة (Manage)'), ('publish', 'نشر وتوزيع (Publish)')], default='view', max_length=50, verbose_name='الإجراء')),
                ('description', models.TextField(blank=True, verbose_name='الوصف')),
                ('is_system', models.BooleanField(default=True, verbose_name='صلاحية نظام أساسية (غير قابلة للحذف)')),
                ('requires_scope', models.BooleanField(default=False, verbose_name='تتطلب نطاق Tenant/Site Scope')),
            ],
            options={
                'verbose_name': 'صلاحية متعددة الأبعاد',
                'verbose_name_plural': 'الصلاحيات المتعددة الأبعاد',
                'ordering': ['category', 'code'],
            },
        ),
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('code', models.CharField(db_index=True, max_length=64, unique=True, verbose_name='كود الدور')),
                ('name', models.CharField(max_length=150, verbose_name='اسم الدور')),
                ('description', models.TextField(blank=True, verbose_name='وصف الدور')),
                ('is_system', models.BooleanField(default=True, verbose_name='دور نظام قياسي')),
                ('scope_level', models.CharField(choices=[('GLOBAL', 'عالمي (Global)'), ('TENANT', 'على مستوى المستأجر (Tenant)'), ('SITE', 'على مستوى الفرع/الموقع (Site)'), ('USER', 'مستخدم افتراضي (User)')], default='USER', max_length=32, verbose_name='مستوى النطاق (Scope Level)')),
                ('is_assignable', models.BooleanField(default=True, verbose_name='قابل للتعيين يدوياً')),
            ],
            options={
                'verbose_name': 'دور صلاحيات (Role)',
                'verbose_name_plural': 'الأدوار (Roles)',
                'ordering': ['scope_level', 'code'],
            },
        ),
        migrations.CreateModel(
            name='RolePermission',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('effect', models.CharField(choices=[('ALLOW', 'منح (Allow)'), ('DENY', 'حظر صريح (Deny)')], default='ALLOW', max_length=16, verbose_name='الأثر')),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='role_bindings', to='permissions.permission', verbose_name='الصلاحية')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='permissions_map', to='permissions.role', verbose_name='الدور')),
            ],
            options={
                'verbose_name': 'ربط دور بصلاحية',
                'verbose_name_plural': 'روابط الأدوار بالصلاحيات',
            },
        ),
        migrations.AddField(
            model_name='role',
            name='permissions',
            field=models.ManyToManyField(blank=True, related_name='roles', through='permissions.RolePermission', to='permissions.permission', verbose_name='الصلاحيات المخصصة'),
        ),
        migrations.CreateModel(
            name='PermissionGroup',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('name', models.CharField(max_length=150, verbose_name='اسم المجموعة')),
                ('code', models.CharField(db_index=True, max_length=100, unique=True, verbose_name='كود المجموعة')),
                ('description', models.TextField(blank=True, verbose_name='الوصف')),
                ('is_system', models.BooleanField(default=False, verbose_name='مجموعة نظام قياسية')),
                ('priority', models.IntegerField(default=100, verbose_name='الأولوية في التقييم (الأعلى أولاً)')),
                ('role', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='associated_groups', to='permissions.role', verbose_name='الدور الأساسي المرتبط')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='permission_groups', to='tenancy.tenant', verbose_name='المستأجر')),
            ],
            options={
                'verbose_name': 'مجموعة صلاحيات (Permission Group)',
                'verbose_name_plural': 'مجموعات الصلاحيات',
                'ordering': ['-priority', 'name'],
            },
        ),
        migrations.CreateModel(
            name='GroupPermission',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('effect', models.CharField(choices=[('ALLOW', 'منح (Allow)'), ('DENY', 'حظر صريح (Deny)')], default='ALLOW', max_length=16, verbose_name='الأثر')),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_permissions', to='permissions.permissiongroup', verbose_name='المجموعة')),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_bindings', to='permissions.permission', verbose_name='الصلاحية')),
            ],
            options={
                'verbose_name': 'ربط مجموعة بصلاحية',
                'verbose_name_plural': 'روابط المجموعات بالصلاحيات',
            },
        ),
        migrations.CreateModel(
            name='UserRoleAssignment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('assigned_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ التعيين')),
                ('expires_at', models.DateTimeField(blank=True, null=True, verbose_name='تاريخ الانتهاء')),
                ('is_active', models.BooleanField(default=True, verbose_name='نشط')),
                ('revoked_at', models.DateTimeField(blank=True, null=True, verbose_name='تاريخ الإلغاء')),
                ('revoked_reason', models.CharField(blank=True, max_length=255, null=True, verbose_name='سبب الإلغاء')),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='granted_roles', to=settings.AUTH_USER_MODEL, verbose_name='المسند بواسطة')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_assignments', to='permissions.role', verbose_name='الدور')),
                ('site', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='tenancy.site', verbose_name='الموقع (Site)')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to='tenancy.tenant', verbose_name='المستأجر (Tenant)')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='role_assignments', to=settings.AUTH_USER_MODEL, verbose_name='المستخدم')),
            ],
            options={
                'verbose_name': 'تعيين دور لمستخدم بنطاق',
                'verbose_name_plural': 'تعيينات أدوار المستخدمين',
                'ordering': ['-assigned_at'],
            },
        ),
        migrations.CreateModel(
            name='UserGroupAssignment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('assigned_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الانضمام')),
                ('is_active', models.BooleanField(default=True, verbose_name='نشط')),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='members', to='permissions.permissiongroup', verbose_name='المجموعة')),
                ('site', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='user_groups', to='tenancy.site', verbose_name='الموقع')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='user_groups', to='tenancy.tenant', verbose_name='المستأجر')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_memberships', to=settings.AUTH_USER_MODEL, verbose_name='المستخدم')),
            ],
            options={
                'verbose_name': 'عضوية مستخدم في مجموعة',
                'verbose_name_plural': 'عضويات مجموعات الصلاحيات',
            },
        ),
        migrations.CreateModel(
            name='UserPermissionOverride',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('is_granted', models.BooleanField(default=True, verbose_name='منح (True) أو حظر صريح (False)')),
                ('reason', models.CharField(blank=True, max_length=255, verbose_name='سبب الاستثناء')),
                ('expires_at', models.DateTimeField(blank=True, null=True, verbose_name='تاريخ انتهاء الاستثناء')),
                ('granted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='granted_overrides', to=settings.AUTH_USER_MODEL, verbose_name='المشرف المانح')),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_overrides', to='permissions.permission', verbose_name='الصلاحية')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='permission_overrides', to=settings.AUTH_USER_MODEL, verbose_name='المستخدم')),
            ],
            options={
                'verbose_name': 'استثناء فردي لمستخدم',
                'verbose_name_plural': 'استثناءات صلاحيات المستخدمين',
            },
        ),
        migrations.CreateModel(
            name='ResourcePermissionOverride',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('resource_type', models.CharField(choices=[('MEDIA_ITEM', 'عنصر وسائط (Media Item)'), ('MEDIA_SERVER', 'خادم وسائط (Media Server)'), ('USER', 'مستخدم (User)'), ('PROFILE', 'بروفايل (Profile)'), ('TENANT', 'مستأجر (Tenant)'), ('SITE', 'موقع/فرع (Site)'), ('SYSTEM', 'نظام عام (System)')], max_length=50, verbose_name='نوع المورد')),
                ('resource_id', models.CharField(db_index=True, max_length=128, verbose_name='معرف المورد')),
                ('is_granted', models.BooleanField(default=True, verbose_name='منح أم حظر للمورد')),
                ('reason', models.CharField(blank=True, max_length=255, verbose_name='سبب الاستثناء')),
                ('expires_at', models.DateTimeField(blank=True, null=True, verbose_name='تاريخ الانتهاء')),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='resource_overrides', to='permissions.permission', verbose_name='الصلاحية')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='resource_permission_overrides', to=settings.AUTH_USER_MODEL, verbose_name='المستخدم')),
            ],
            options={
                'verbose_name': 'استثناء صلاحية على مورد محدد',
                'verbose_name_plural': 'استثناءات الصلاحيات على الموارد',
            },
        ),
        migrations.AddIndex(
            model_name='rolepermission',
            index=models.Index(fields=['role', 'effect'], name='idx_roleperm_role_effect'),
        ),
        migrations.AddIndex(
            model_name='rolepermission',
            index=models.Index(fields=['permission', 'effect'], name='idx_roleperm_perm_effect'),
        ),
        migrations.AlterUniqueTogether(
            name='rolepermission',
            unique_together={('role', 'permission')},
        ),
        migrations.AlterUniqueTogether(
            name='grouppermission',
            unique_together={('group', 'permission')},
        ),
        migrations.AlterUniqueTogether(
            name='usergroupassignment',
            unique_together={('user', 'group')},
        ),
        migrations.AlterUniqueTogether(
            name='userpermissionoverride',
            unique_together={('user', 'permission')},
        ),
        migrations.AlterUniqueTogether(
            name='resourcepermissionoverride',
            unique_together={('user', 'resource_type', 'resource_id', 'permission')},
        ),
    ]
