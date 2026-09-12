import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone

class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tenancy', '0001_initial'),
        ('media_servers', '0001_initial'),
    ]

    operations = [
        # Alter options on MediaServer
        migrations.AlterModelOptions(
            name='mediaserver',
            options={'ordering': ['priority', 'name'], 'verbose_name': 'خادم وسائط محلي (Media Server)', 'verbose_name_plural': 'خوادم الوسائط المحلية'},
        ),
        # Add new fields to MediaServer
        migrations.AddField(
            model_name='mediaserver',
            name='display_name',
            field=models.CharField(blank=True, default='', max_length=150, verbose_name='الاسم المعروض'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='internal_notes',
            field=models.TextField(blank=True, null=True, verbose_name='ملاحظات داخلية'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='server_url_internal',
            field=models.URLField(blank=True, default='', max_length=255, verbose_name='عنوان الوصول الداخلي (Internal URL)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='server_url_external',
            field=models.URLField(blank=True, max_length=255, null=True, verbose_name='عنوان الوصول الخارجي (External URL)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='use_internal_url',
            field=models.BooleanField(default=True, verbose_name='استخدام الرابط الداخلي افتراضياً'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='api_timeout_seconds',
            field=models.IntegerField(default=30, verbose_name='مهلة الـ API بالثواني'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='health_status',
            field=models.CharField(choices=[('HEALTHY', 'سليم (Healthy)'), ('DEGRADED', 'متدهور (Degraded)'), ('UNHEALTHY', 'معطل (Unhealthy)'), ('TIMEOUT', 'انتهت المهلة (Timeout)'), ('OFFLINE', 'غير متصل (Offline)')], default='HEALTHY', max_length=20, verbose_name='حالة الجاهزية الصحية'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='last_health_check',
            field=models.DateTimeField(blank=True, null=True, verbose_name='آخر فحص صحي'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='max_concurrent_streams',
            field=models.IntegerField(blank=True, default=20, null=True, verbose_name='الحد الأقصى لجلسات البث المتزامنة'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='max_concurrent_transcodes',
            field=models.IntegerField(blank=True, default=4, null=True, verbose_name='الحد الأقصى للتحويل الرقمي المتزامن'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='priority',
            field=models.IntegerField(default=100, verbose_name='الأولوية (الأقل = الأعلى)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='weight',
            field=models.IntegerField(default=100, verbose_name='الوزن النسبي لموازنة الأحمال'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='is_primary',
            field=models.BooleanField(default=False, verbose_name='خادم رئيسي للـ Failover'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='fallback_server',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fallback_for_servers', to='media_servers.mediaserver', verbose_name='الخادم الاحتياطي المباشر (Fallback Server)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='health_check_interval_seconds',
            field=models.IntegerField(default=60, verbose_name='دورية الفحص الصحي (ثواني)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='consecutive_failures_threshold',
            field=models.IntegerField(default=3, verbose_name='عتبة الإخفاقات المتتالية لعزل الخادم'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='consecutive_success_threshold',
            field=models.IntegerField(default=2, verbose_name='عتبة النجاحات المتتالية لاستعادة الخادم'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='circuit_breaker_state',
            field=models.CharField(choices=[('CLOSED', 'مغلق - يعمل طبيعياً (Closed)'), ('OPEN', 'مفتوح - معزول عن الطلبات (Open)'), ('HALF_OPEN', 'نصف مفتوح - فحص تجريبي (Half-Open)')], db_index=True, default='CLOSED', max_length=20, verbose_name='حالة قاطع الدائرة (Circuit Breaker)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='circuit_breaker_opened_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='وقت فتح قاطع الدائرة'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='circuit_breaker_next_attempt_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='موعد محاولة الفحص التالية'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='consecutive_failures',
            field=models.IntegerField(default=0, verbose_name='الإخفاقات المتتالية'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='consecutive_successes',
            field=models.IntegerField(default=0, verbose_name='النجاحات المتتالية'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='last_error_message',
            field=models.TextField(blank=True, null=True, verbose_name='آخر رسالة خطأ'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='last_error_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='تاريخ آخر خطأ'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='avg_response_time_ms',
            field=models.IntegerField(blank=True, null=True, verbose_name='متوسط وقت الاستجابة (ملي ثانية)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='p95_response_time_ms',
            field=models.IntegerField(blank=True, null=True, verbose_name='مقياس P95 لوقت الاستجابة'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='capabilities_discovered_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='تاريخ اكتشاف القدرات'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='capabilities',
            field=models.JSONField(blank=True, default=dict, verbose_name='مصفوفة القدرات التقنية (Capabilities)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='api_version',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='إصدار واجهة الـ API'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='server_version',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='إصدار الخادم'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='last_version_check_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='تاريخ آخر فحص للتوافقية'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='auto_disable_on_repeated_failures',
            field=models.BooleanField(default=False, verbose_name='تعطيل تلقائي بعد 10 إخفاقات متتالية'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='preferred_for_content_types',
            field=models.JSONField(blank=True, default=list, verbose_name='أنواع المحتوى المفضلة (MOVIES, SERIES)'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='excluded_from_playback',
            field=models.BooleanField(default=False, verbose_name='استبعاد الخادم من اختيار البث'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='maintenance_mode',
            field=models.BooleanField(default=False, verbose_name='وضع الصيانة'),
        ),
        migrations.AddField(
            model_name='mediaserver',
            name='maintenance_message',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='رسالة الصيانة'),
        ),
        # Add Indexes to MediaServer
        migrations.AddIndex(
            model_name='mediaserver',
            index=models.Index(fields=['health_status', 'priority'], name='idx_ms_health_prio'),
        ),
        migrations.AddIndex(
            model_name='mediaserver',
            index=models.Index(fields=['circuit_breaker_state'], name='idx_ms_circuit_state'),
        ),
        migrations.AddIndex(
            model_name='mediaserver',
            index=models.Index(fields=['status', 'is_active'], name='idx_ms_status_active'),
        ),

        # Create MediaServerHealthCheck model
        migrations.CreateModel(
            name='MediaServerHealthCheck',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('checked_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now, verbose_name='وقت الفحص')),
                ('status', models.CharField(choices=[('HEALTHY', 'سليم (Healthy)'), ('DEGRADED', 'متدهور / بطيء (Degraded)'), ('UNHEALTHY', 'غير سليم (Unhealthy)'), ('TIMEOUT', 'انتهت المهلة (Timeout)')], db_index=True, max_length=20, verbose_name='حالة الفحص')),
                ('response_time_ms', models.IntegerField(default=0, verbose_name='زمن الاستجابة (ملي ثانية)')),
                ('endpoint', models.CharField(default='/System/Info/Public', max_length=255, verbose_name='نقطة الفحص')),
                ('http_status_code', models.IntegerField(blank=True, null=True, verbose_name='كود الاستجابة HTTP')),
                ('error_message', models.TextField(blank=True, null=True, verbose_name='رسالة الخطأ')),
                ('server_version', models.CharField(blank=True, max_length=50, null=True, verbose_name='إصدار السيرفر')),
                ('active_sessions', models.IntegerField(blank=True, null=True, verbose_name='الجلسات النشطة')),
                ('active_transcodes', models.IntegerField(blank=True, null=True, verbose_name='جلسات التحويل الرقمي النشطة')),
                ('cpu_usage_percent', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='نسبة المعالج %')),
                ('memory_usage_percent', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='نسبة الذاكرة %')),
                ('metadata', models.JSONField(blank=True, default=dict, verbose_name='بيانات وصفية إضافية')),
                ('media_server', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='health_checks', to='media_servers.mediaserver', verbose_name='خادم الوسائط')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='media_server_health_checks', to='tenancy.tenant', verbose_name='المستأجر')),
            ],
            options={
                'verbose_name': 'فحص جاهزية الخادم (Server Health Check)',
                'verbose_name_plural': 'سجلات فحص جاهزية الخوادم',
                'ordering': ['-checked_at'],
            },
        ),
        migrations.AddIndex(
            model_name='mediaserverhealthcheck',
            index=models.Index(fields=['media_server', '-checked_at'], name='idx_mshc_srv_time'),
        ),
        migrations.AddIndex(
            model_name='mediaserverhealthcheck',
            index=models.Index(fields=['status'], name='idx_mshc_status'),
        ),
        migrations.AddIndex(
            model_name='mediaserverhealthcheck',
            index=models.Index(fields=['tenant', '-checked_at'], name='idx_mshc_ten_time'),
        ),

        # Create DiscoveredMediaServer model
        migrations.CreateModel(
            name='DiscoveredMediaServer',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('discovered_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now, verbose_name='تاريخ الاكتشاف')),
                ('discovery_method', models.CharField(choices=[('MANUAL', 'يدوي (Manual)'), ('MDNS', 'mDNS / Zeroconf'), ('SSDP', 'SSDP / UPnP'), ('ARP', 'ARP Scan'), ('NMAP', 'Nmap Port Probe'), ('HTTP_PROBE', 'HTTP Port Probing')], default='HTTP_PROBE', max_length=30, verbose_name='طريقة الاكتشاف')),
                ('host', models.CharField(max_length=255, verbose_name='عنوان المضيف / IP')),
                ('port', models.IntegerField(verbose_name='المنفذ (Port)')),
                ('server_type_guess', models.CharField(choices=[('JELLYFIN', 'Jellyfin'), ('EMBY', 'Emby'), ('PLEX', 'Plex'), ('UNKNOWN', 'غير معروف (Unknown)')], default='UNKNOWN', max_length=30, verbose_name='نوع الخادم المتوقع')),
                ('version_guess', models.CharField(blank=True, max_length=50, null=True, verbose_name='الإصدار المتوقع')),
                ('confidence_score', models.DecimalField(decimal_places=2, default=0.5, max_digits=4, verbose_name='درجة الثقة (0.00 إلى 1.00)')),
                ('raw_response', models.JSONField(blank=True, default=dict, verbose_name='الرد الخام من الفحص')),
                ('status', models.CharField(choices=[('PENDING', 'قيد الانتظار (Pending Approval)'), ('APPROVED', 'تمت الموافقة (Approved)'), ('IGNORED', 'تم التجاهل (Ignored)'), ('EXPIRED', 'منتهي الصلاحية (Expired)')], db_index=True, default='PENDING', max_length=20, verbose_name='حالة الاكتشاف')),
                ('approved_at', models.DateTimeField(blank=True, null=True, verbose_name='وقت الموافقة')),
                ('ignored_at', models.DateTimeField(blank=True, null=True, verbose_name='وقت التجاهل')),
                ('ignore_reason', models.CharField(blank=True, max_length=255, null=True, verbose_name='سبب التجاهل')),
                ('metadata', models.JSONField(blank=True, default=dict, verbose_name='بيانات إضافية')),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_media_discoveries', to=settings.AUTH_USER_MODEL, verbose_name='المشرف الموافق')),
                ('ignored_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ignored_media_discoveries', to=settings.AUTH_USER_MODEL, verbose_name='المشرف المتجاهل')),
                ('created_media_server', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='origin_discoveries', to='media_servers.mediaserver', verbose_name='خادم الوسائط المنشأ')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='discovered_media_servers', to='tenancy.tenant', verbose_name='المستأجر')),
            ],
            options={
                'verbose_name': 'خادم وسائط مكتشف (Discovered Media Server)',
                'verbose_name_plural': 'الخوادم المكتشفة في الشبكة المحلية',
                'ordering': ['-discovered_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='discoveredmediaserver',
            constraint=models.UniqueConstraint(fields=('tenant', 'host', 'port'), name='unique_tenant_host_port_discovery'),
        ),
        migrations.AddIndex(
            model_name='discoveredmediaserver',
            index=models.Index(fields=['tenant', 'status'], name='idx_dms_ten_status'),
        ),
        migrations.AddIndex(
            model_name='discoveredmediaserver',
            index=models.Index(fields=['-discovered_at'], name='idx_dms_discovered_at'),
        ),

        # Create MediaServerCapability model
        migrations.CreateModel(
            name='MediaServerCapability',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('capability_key', models.CharField(db_index=True, max_length=100, verbose_name='مفتاح الميزة أو القدرة')),
                ('capability_value', models.JSONField(default=dict, verbose_name='قيمة الميزة وتفاصيلها')),
                ('detected_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='تاريخ الاكتشاف')),
                ('is_active', models.BooleanField(default=True, verbose_name='نشط')),
                ('media_server', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='capability_records', to='media_servers.mediaserver', verbose_name='خادم الوسائط')),
            ],
            options={
                'verbose_name': 'قدرة خادم الوسائط (Media Server Capability)',
                'verbose_name_plural': 'قدرات خوادم الوسائط',
            },
        ),
        migrations.AddConstraint(
            model_name='mediaservercapability',
            constraint=models.UniqueConstraint(fields=('media_server', 'capability_key'), name='unique_media_server_capability'),
        ),
        migrations.AddIndex(
            model_name='mediaservercapability',
            index=models.Index(fields=['media_server', 'capability_key'], name='idx_msc_server_key'),
        ),
    ]
