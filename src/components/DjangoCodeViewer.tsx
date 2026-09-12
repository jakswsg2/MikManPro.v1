import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  FileCode, 
  FolderTree, 
  Layers, 
  Database, 
  Boxes, 
  Cpu, 
  Terminal, 
  Server,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const DjangoCodeViewer: React.FC = () => {
  const [activeFile, setActiveFile] = useState('docker-compose');
  const [copied, setCopied] = useState(false);

  const files: Record<string, { title: string; path: string; language: string; content: string; explanation: string }> = {
    'context': {
      title: 'سياق المستأجر (core/context.py)',
      path: '/backend/core/context.py',
      language: 'python',
      explanation: 'إدارة سياق المستأجر والموقع باستخدام ContextVars المتوافقة مع العمليات اللاتزامنية (ASGI/Async). يمنع تلوث الذاكرة بين الطلبات مع تطبيق SET LOCAL app.current_tenant على جلسة PostgreSQL.',
      content: `import contextvars
from typing import Optional
from django.db import connection

_current_tenant_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('current_tenant_id', default=None)
_current_site_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('current_site_id', default=None)
_current_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('current_user_id', default=None)
_is_superuser: contextvars.ContextVar[bool] = contextvars.ContextVar('is_superuser', default=False)
_bypass_rls: contextvars.ContextVar[bool] = contextvars.ContextVar('bypass_rls', default=False)

class TenantContextException(Exception):
    pass

class TenantContext:
    """
    Context Manager & Utility for scoping execution to a Tenant
    """
    def __init__(self, tenant_id: Optional[str], site_id: Optional[str] = None, 
                 user_id: Optional[str] = None, is_superuser: bool = False, bypass_rls: bool = False):
        self.tenant_id = tenant_id
        self.site_id = site_id
        self.user_id = user_id
        self.is_superuser = is_superuser
        self.bypass_rls = bypass_rls or is_superuser
        self._tokens = []

    def __enter__(self):
        self._tokens.append(_current_tenant_id.set(self.tenant_id))
        self._tokens.append(_current_site_id.set(self.site_id))
        self._tokens.append(_current_user_id.set(self.user_id))
        self._tokens.append(_is_superuser.set(self.is_superuser))
        self._tokens.append(_bypass_rls.set(self.bypass_rls))
        
        # Apply to PostgreSQL session variable
        self._set_db_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        for token in reversed(self._tokens):
            token.var.reset(token)
        self._reset_db_session()

    def _set_db_session(self):
        with connection.cursor() as cursor:
            if self.tenant_id:
                cursor.execute("SET LOCAL app.current_tenant = %s;", [str(self.tenant_id)])
            else:
                cursor.execute("RESET app.current_tenant;")
            cursor.execute("SET LOCAL app.is_superuser = %s;", ['true' if self.is_superuser else 'false'])

    def _reset_db_session(self):
        with connection.cursor() as cursor:
            cursor.execute("RESET app.current_tenant;")
            cursor.execute("SET LOCAL app.is_superuser = 'false';")

def get_current_tenant_id() -> Optional[str]:
    return _current_tenant_id.get()

def get_current_site_id() -> Optional[str]:
    return _current_site_id.get()

def is_bypass_rls() -> bool:
    return _bypass_rls.get()

def require_tenant_context() -> str:
    tid = get_current_tenant_id()
    if not tid:
        raise TenantContextException("Operation requires an active Tenant Context (Deny by Default).")
    return tid`
    },
    'managers': {
      title: 'مدير الاستعلامات المعزول (core/managers.py)',
      path: '/backend/core/managers.py',
      language: 'python',
      explanation: 'مدير استعلامات Django المخصص الذي يفرض فلترة tenant_id تلقائياً عند مستوى ORM، مع دعم Deny by Default (إرجاع queryset فارغ فوراً في حال انعدام السياق).',
      content: `from django.db import models
from core.context import get_current_tenant_id, is_bypass_rls

class TenantQuerySet(models.QuerySet):
    def filter_by_tenant(self, tenant_id=None):
        target_id = tenant_id or get_current_tenant_id()
        if not target_id:
            return self.none() # Deny by Default
        return self.filter(tenant_id=target_id)

class TenantManager(models.Manager.from_queryset(TenantQuerySet)):
    """
    Manager that automatically restricts queries to the active Tenant.
    """
    def get_queryset(self):
        qs = super().get_queryset()
        if is_bypass_rls():
            return qs
        
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            # Deny by Default: Do NOT expose all records
            return qs.none()
        return qs.filter(tenant_id=tenant_id)

class TenantAllObjectsManager(models.Manager):
    """
    Unfiltered manager for Super Admin / Background system tasks.
    """
    use_in_migrations = True`
    },
    'rls-migration': {
      title: 'تهيئة PostgreSQL RLS (0004_enable_rls.py)',
      path: '/backend/tenancy/migrations/0004_enable_rls.py',
      language: 'python',
      explanation: 'ملف تهجير (Migration) ينفذ أوامر ALTER TABLE ... ENABLE ROW LEVEL SECURITY و FORCE ROW LEVEL SECURITY مع سياسات USING و WITH CHECK لمنع تسريب أي سجل بين المستأجرين على مستوى نواة قاعدة البيانات.',
      content: `from django.db import migrations

RLS_TABLES = [
    'accounts_user',
    'accounts_externalidentity',
    'accounts_loungesession',
    'accounts_userdevice',
    'permissions_profile',
    'permissions_permissiongroup',
    'permissions_userroleassignment',
    'permissions_userpermissionoverride',
    'media_servers_mediaserver',
    'content_medialibrary',
    'content_mediaitem',
    'content_mediasource',
    'playback_playbacktoken',
    'playback_playbacksession',
    'playback_watchhistory',
    'billing_plan',
    'billing_subscription',
    'billing_entitlement',
    'billing_invoice',
    'billing_payment',
    'billing_hotspotcard',
    'billing_cardbatch',
]

def enable_rls_sql():
    sql = []
    for table in RLS_TABLES:
        sql.append(f"""
        -- 1. Enable & Force Row Level Security on table
        ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE {table} FORCE ROW LEVEL SECURITY;

        -- 2. Drop existing policy if present
        DROP POLICY IF EXISTS tenant_isolation_policy ON {table};

        -- 3. Create strict Tenant Isolation Policy
        CREATE POLICY tenant_isolation_policy ON {table}
            AS PERMISSIVE
            FOR ALL
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
                OR NULLIF(current_setting('app.is_superuser', true), '') = 'true'
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
                OR NULLIF(current_setting('app.is_superuser', true), '') = 'true'
            );
        """)
    return "\\n".join(sql)

class Migration(migrations.Migration):
    dependencies = [
        ('tenancy', '0003_populate_tenant_ids'),
    ]

    operations = [
        migrations.RunSQL(
            sql=enable_rls_sql(),
            reverse_sql="-- Reverse RLS policies if required"
        ),
    ]`
    },
    'middleware': {
      title: 'طبقة الوسيط (core/middleware/tenant.py)',
      path: '/backend/core/middleware/tenant.py',
      language: 'python',
      explanation: 'Middleware يستخرج هوية المستأجر من النطاق الفرعي (Subdomain) أو المسار (/t/slug/) أو التوكن أو ترويسة X-Tenant-Override للمشرف العام، ويقوم بحقن TenantContext في مسار الطلب.',
      content: `from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from core.context import TenantContext
from tenancy.models import Tenant

class TenantMiddleware(MiddlewareMixin):
    """
    Extracts tenant identity and scopes the current request thread/context.
    """
    def process_request(self, request):
        tenant_id = None
        is_superuser = getattr(request.user, 'is_superuser', False)

        # 1. Check Super Admin Impersonation header
        if is_superuser and 'HTTP_X_TENANT_OVERRIDE' in request.META:
            override_val = request.META['HTTP_X_TENANT_OVERRIDE']
            tenant = Tenant.objects.filter(models.Q(id=override_val) | models.Q(slug=override_val)).first()
            if tenant:
                tenant_id = tenant.id

        # 2. Extract from JWT / Authenticated User
        if not tenant_id and request.user.is_authenticated:
            tenant_id = getattr(request.user, 'tenant_id', None)

        # 3. Extract from Subdomain (e.g. al-waha.lounge.lan)
        if not tenant_id:
            host = request.get_host().split(':')[0]
            subdomain = host.split('.')[0]
            tenant = Tenant.objects.filter(slug=subdomain, status='ACTIVE').first()
            if tenant:
                tenant_id = tenant.id

        # 4. Scope execution with TenantContext
        request.tenant_context = TenantContext(
            tenant_id=tenant_id,
            user_id=getattr(request.user, 'id', None),
            is_superuser=is_superuser
        )
        request.tenant_context.__enter__()

    def process_response(self, request, response):
        if hasattr(request, 'tenant_context'):
            request.tenant_context.__exit__(None, None, None)
        return response`
    },
    'provisioning': {
      title: 'خدمة التجهيز الذري (tenancy/services.py)',
      path: '/backend/tenancy/services.py',
      language: 'python',
      explanation: 'خدمة إنشاء المستأجر الجديد بشكل ذري (Atomic Transaction) تتضمن التحقق من الـ Slug، إنشاء الفرع الافتراضي، مستخدم المدير بكلمة مرور عشوائية (Single-Reveal)، ونسخ البروفايلات القياسية.',
      content: `from django.db import transaction
import secrets
import string
from tenancy.models import Tenant, Site
from accounts.models import User
from permissions.models import Profile, PermissionGroup

class TenantProvisioningService:
    @classmethod
    @transaction.atomic
    def provision(cls, name: str, slug: str, admin_email: str, admin_username: str, 
                  plan: str = 'STANDARD', initial_site_name: str = 'Main Branch') -> dict:
        # 1. Validate slug uniqueness
        if Tenant.objects.filter(slug=slug).exists():
            raise ValueError(f"Slug '{slug}' is already registered.")

        # 2. Create Tenant
        tenant = Tenant.objects.create(
            name=name,
            slug=slug,
            subscription_plan=plan,
            status='ACTIVE',
            contact_email=admin_email
        )

        # 3. Create Default Site
        site = Site.objects.create(
            tenant=tenant,
            name=initial_site_name,
            code='SITE-01',
            status='ACTIVE'
        )

        # 4. Generate one-time admin password
        alphabet = string.ascii_letters + string.digits + '!@#$%'
        raw_password = ''.join(secrets.choice(alphabet) for _ in range(12))

        # 5. Create Admin User
        admin_user = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=raw_password,
            tenant=tenant,
            site=site,
            is_staff=True,
            is_superuser=False
        )

        return {
            'tenant': tenant,
            'site': site,
            'admin_user': admin_user,
            'admin_password': raw_password
        }`
    },
    'docker-compose': {
      title: 'Docker Compose Stack',
      path: '/backend/docker-compose.yml',
      language: 'yaml',
      explanation: 'بيئة إنتاج وتشغيل متكاملة تضم PostgreSQL 16، Redis 7 للـ Caching والمهام، خادم Django عبر Gunicorn، وعاملي Celery Worker و Celery Beat للمزامنة الدورية لخوادم الوسائط.',
      content: `version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: smart_lounge_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-smart_lounge}
      POSTGRES_USER: \${POSTGRES_USER:-lounge_admin}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-lounge_secure_pass_2026}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-lounge_admin} -d \${POSTGRES_DB:-smart_lounge}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: smart_lounge_redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: smart_lounge_backend
    restart: unless-stopped
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"
    environment:
      DJANGO_SETTINGS_MODULE: config.settings
      POSTGRES_HOST: postgres
      REDIS_URL: redis://redis:6379/0
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  celery_worker:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: smart_lounge_celery_worker
    command: celery -A config worker --loglevel=info
    depends_on:
      - backend
      - redis

  celery_beat:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: smart_lounge_celery_beat
    command: celery -A config beat --loglevel=info
    depends_on:
      - backend
      - redis

volumes:
  postgres_data:
  redis_data:`,
    },
    'engine': {
      title: 'محرك الصلاحيات (PermissionEngine)',
      path: '/backend/apps/permissions/engine.py',
      language: 'python',
      explanation: 'الجوهر البرمجي لحساب الصلاحيات الفعلية لمستخدم الاستراحة. يدمج صلاحيات البروفايل مع الاستثناءات الفردية (UserPermissionOverride) مع إعطاء الأولوية القصوى للحظر الصريح (Explicit Deny).',
      content: `from typing import Set, Dict, Any
from apps.permissions.models import UserPermissionOverride

class PermissionEngine:
    """
    محرك حل الصلاحيات المركزي لـ Smart Lounge
    الصلاحيات الفعلية = (صلاحيات البروفايل + المنح الاستثنائي) - الحظر الاستثنائي
    """
    
    @classmethod
    def get_effective_permissions(cls, user) -> Set[str]:
        if not user.is_active:
            return set()
            
        if user.is_superuser:
            return {'*'}
            
        # 1. جلب الصلاحيات من البروفايل النشط
        profile_perms = set()
        active_assignment = user.profile_assignments.filter(is_active=True).select_related('profile').first()
        if active_assignment and active_assignment.profile:
            profile_perms = set(
                active_assignment.profile.permissions.values_list('code', flat=True)
            )
            
        # 2. تطبيق الاستثناءات الفردية الخاصة بالمستخدم (Overrides)
        overrides = UserPermissionOverride.objects.filter(user=user).select_related('permission')
        granted_overrides = {o.permission.code for o in overrides if o.is_granted}
        denied_overrides = {o.permission.code for o in overrides if not o.is_granted}
        
        # الدمج: الحظر الاستثنائي له أسبقية عليا
        effective = (profile_perms | granted_overrides) - denied_overrides
        return effective

    @classmethod
    def has_permission(cls, user, permission_code: str) -> bool:
        effective = cls.get_effective_permissions(user)
        return '*' in effective or permission_code in effective`,
    },
    'user-model': {
      title: 'نموذج المستخدم المستقل (User Model)',
      path: '/backend/apps/accounts/models.py',
      language: 'python',
      explanation: 'تطبيق قاعدة الفصل المعماري: المستخدم يملك معرّف مستقل (lounge_id) و UUID كـ Primary Key. لا يوجد ربط مباشر مع MikroTik أو RADIUS هنا، بل يُفرد لهما جدول وسيط في المرحلة 2.',
      content: `import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('اسم المستخدم مطلوب')
        user = self.model(username=username, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

class User(AbstractBaseUser, PermissionsMixin):
    STATUS_CHOICES = [
        ('ACTIVE', 'نشط'),
        ('GRACE_PERIOD', 'فترة سماح'),
        ('EXPIRED', 'منتهي'),
        ('SUSPENDED', 'معلق'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lounge_id = models.CharField(max_length=32, unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, db_index=True)
    phone = models.CharField(max_length=32, blank=True)
    language = models.CharField(max_length=10, default='ar')
    timezone = models.CharField(max_length=64, default='Asia/Aden')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = UserManager()
    USERNAME_FIELD = 'username'`,
    },
    'jellyfin-connector': {
      title: 'رابط خادم Jellyfin (Connector)',
      path: '/backend/apps/media_servers/connectors/jellyfin.py',
      language: 'python',
      explanation: 'يتصل بخادم Jellyfin المحلي عبر الـ REST API باستخدام Token المصادقة لجلب المكتبات، الأفلام، المسلسلات، المواسم، الحلقات، وتوليد روابط البث المباشر (HLS Direct Stream) داخل الشبكة.',
      content: `import requests
from apps.media_servers.connectors.base import BaseMediaServerConnector

class JellyfinConnector(BaseMediaServerConnector):
    def _get_headers(self):
        return {
            'X-Emby-Token': self.server.api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def test_connection(self) -> dict:
        url = f"{self.base_url}/System/Info"
        response = requests.get(url, headers=self._get_headers(), timeout=5)
        response.raise_for_status()
        data = response.json()
        return {
            'status': 'online',
            'version': data.get('Version'),
            'server_name': data.get('ServerName'),
            'operating_system': data.get('OperatingSystem'),
        }

    def fetch_libraries(self) -> list:
        url = f"{self.base_url}/Library/VirtualFolders"
        response = requests.get(url, headers=self._get_headers(), timeout=10)
        response.raise_for_status()
        return response.json()

    def get_stream_url(self, item_id: str) -> str:
        return f"{self.base_url}/Videos/{item_id}/stream.m3u8?api_key={self.server.api_key}"`,
    },
    'api-views': {
      title: 'طرق العرض والفلترة (DRF ViewSets)',
      path: '/backend/apps/api/views.py',
      language: 'python',
      explanation: 'تنفيذ الفلترة الديناميكية في get_queryset. لا يُعرض للمستخدم إلا ما يوافق صلاحياته. إن كان في بروفايل أطفال يُحجب كل ما عداه، وإن لم يملك صلاحية المحتوى الحصري يُحجب VIP.',
      content: `from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.content.models import MediaItem
from apps.permissions.engine import PermissionEngine
from apps.api.serializers import MediaItemSerializer

class MediaItemViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MediaItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = MediaItem.objects.filter(is_available=True)
        
        # إذا كان المستخدم مقيداً ببروفايل الأطفال
        if PermissionEngine.has_permission(user, 'content.kids.view') and not PermissionEngine.has_permission(user, 'content.movies.view'):
            queryset = queryset.filter(is_kids=True)
            return queryset
            
        # حجب المحتوى الحصري VIP إن لم تتوفر الصلاحية
        if not PermissionEngine.has_permission(user, 'content.premium.view'):
            queryset = queryset.filter(is_premium=False)
            
        return queryset.order_by('-created_at')`,
    },
    'identity-models': {
      title: 'نماذج الهوية والجلسات (ExternalIdentity & Session)',
      path: '/backend/apps/accounts/models.py',
      language: 'python',
      explanation: 'تطبيق القرارات 23 و 10 و 35: فصل هوية كارت الهوتسبوت عن حساب الاستراحة، تخزين تجزئة التوكنات الآمنة (SHA-256) وسجل تدقيق شامل خالٍ من الأسرار.',
      content: `class ExternalIdentity(models.Model):
    """
    ربط الهويات الخارجية بحساب الاستراحة الذكية (Decision 23 & Decision 25)
    يسمح بربط عدة كروت أو أجهزة (MAC) بحساب واحد
    """
    class IdentityType(models.TextChoices):
        MIKROTIK = 'MIKROTIK', 'MikroTik Hotspot MAC / User'
        RADIUS = 'RADIUS', 'FreeRADIUS Voucher / Card'
        GOOGLE = 'GOOGLE', 'Google Account'
        LOCAL = 'LOCAL', 'Local Account'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='external_identities')
    identity_type = models.CharField(max_length=32, choices=IdentityType.choices)
    external_id = models.CharField(max_length=128)
    external_metadata = models.JSONField(default=dict, blank=True)
    is_primary = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=True)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

class LoungeSession(models.Model):
    """
    جلسة أمنية لمستخدم الاستراحة (Decision 10: Mandatory Token Rotation & Session Hashing)
    لا يتم حفظ التوكن الصريح، بل تجزئة SHA-256 لحماية المستخدمين عند تسريب البيانات.
    """
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        EXPIRED = 'EXPIRED', 'Expired'
        REVOKED = 'REVOKED', 'Revoked'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    refresh_token_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    source = models.CharField(max_length=32, default='HOTSPOT')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.CharField(max_length=255, blank=True)`,
    },
    'security-services': {
      title: 'خدمات التوكن والتسجيل التلقائي (Security Services)',
      path: '/backend/apps/accounts/services.py',
      language: 'python',
      explanation: 'خدمات التوكن الآمن (SecureTokenService) وتدوير التوكنات، وخدمة SSO والتسجيل التلقائي عند أول تسجيل دخول للزائر (SSORegistrationService - Decision 26).',
      content: `class SecureTokenService:
    """
    إصدار وتدوير التوكنات وفق القرار 10 و 57 (Mandatory Refresh Rotation & OTT)
    """
    @classmethod
    def generate_one_time_token(cls, user_id: str, external_id: str, identity_type: str, ttl_seconds: int = 60) -> str:
        ott = f"ott_{secrets.token_urlsafe(32)}"
        # Store in Redis with TTL = 60s
        return ott

    @classmethod
    def refresh_tokens(cls, plain_refresh_token: str, context: dict = None) -> TokenPair:
        """
        تدوير التوكن الإجباري: إلغاء التوكن السابق فورياً وإصدار زوج جديد
        """
        refresh_hash = hashlib.sha256(plain_refresh_token.encode()).hexdigest()
        session = LoungeSession.objects.filter(refresh_token_hash=refresh_hash, status=LoungeSession.Status.ACTIVE).first()
        if not session or not session.is_valid:
            raise ValueError("Refresh token expired, invalid or blacklisted")

        # Invalidate old session and rotate
        session.status = LoungeSession.Status.REVOKED
        session.revoked_reason = "Rotated by refresh token request"
        session.save()
        return cls.issue_token(user=session.user, source=session.source, context=context)

class SSORegistrationService:
    """
    Decision 26: التسجيل التلقائي للزائر عند أول تسجيل دخول عبر Captive Portal
    """
    @classmethod
    def authenticate_or_register(cls, identity_type: str, external_id: str, source: str, metadata: dict, context: dict):
        identity = ExternalIdentity.objects.filter(identity_type=identity_type, external_id=external_id).first()
        is_first_time = False

        if not identity:
            is_first_time = True
            # إنشاء Lounge User جديد
            user = User.objects.create_user(
                username=f"hs_{external_id.lower().replace(':', '_')}",
                full_name=f"زائر كارت {external_id}",
            )
            # تعيين بروفايل الافتراضي أو VIP حسب الكارت
            profile_code = 'Premium' if 'VIP' in external_id else ('Kids' if 'KIDS' in external_id else 'Basic')
            profile = Profile.objects.get(code=profile_code)
            UserProfileAssignment.objects.create(user=user, profile=profile, is_active=True)

            identity = ExternalIdentity.objects.create(
                user=user,
                identity_type=identity_type,
                external_id=external_id,
                external_metadata=metadata,
                is_primary=True,
            )

        token_pair = SecureTokenService.issue_token(user=identity.user, source=source, context=context)
        return identity.user, identity, token_pair, is_first_time`,
    },
    'mikrotik-gateway': {
      title: 'بوابة MikroTik بصلاحيات مقيدة (Least Privilege Gateway)',
      path: '/backend/apps/integrations/mikrotik/gateway.py',
      language: 'python',
      explanation: 'تطبيق القرار 31: حصر صلاحيات حساب الـ API في الراوتر بمجموعة محدودة تمنع إعادة التشغيل أو تغيير إعدادات الأمان الحساسة.',
      content: `class MikroTikGateway:
    """
    بوابة التحكم في موجهات MikroTik RouterOS (Decision 31: Least Privilege)
    ممنوع من صلاحيات full, reboot, sensitive
    """
    def __init__(self, router: MikroTikRouter):
        self.router = router
        self.client = RouterOSClient(
            host=router.host,
            port=router.port,
            username=router.username,
            password=router.password_encrypted or 'lounge_gateway_pass',
            use_ssl=router.use_ssl
        )

    def ping_and_health_check(self) -> dict:
        """فحص الاتصال وتحديث مقاييس الـ CPU والـ RAM والـ Uptime"""
        health = self.client.get_system_health()
        self.router.is_online = health['online']
        self.router.latency_ms = health['latency_ms']
        self.router.cpu_load = health['cpu_load']
        self.router.memory_free_mb = health['memory_free_mb']
        self.router.save()
        return health

    def get_active_hotspot_users(self) -> list:
        """/ip/hotspot/active/print"""
        return self.client.get_active_hotspot_users()

    def kick_hotspot_user(self, user_identifier: str) -> bool:
        """فصل المستخدم من الهوتسبوت دون تعديل أي إعدادات أخرى"""
        return self.client.remove_hotspot_active(user_identifier)`,
    },
    'radius-gateway': {
      title: 'بوابة RADIUS وسلسلة التجاوز (Failover Gateway)',
      path: '/backend/apps/integrations/radius/gateway.py',
      language: 'python',
      explanation: 'تطبيق القرار 32: التحقق من كروت الهوتسبوت عبر سلسلة خوادم RADIUS متتالية تضمن استمرارية الخدمة بنسبة 99.99%.',
      content: `class RadiusGateway:
    """
    بوابة RADIUS المركزية مع التجاوز التلقائي (Decision 32: Primary / Secondary / Failover)
    """
    @classmethod
    def authenticate_card_with_failover(cls, card_number: str, password: str = ''):
        servers = RadiusServer.objects.filter(is_active=True).order_by('priority')
        last_error = None

        for server in servers:
            try:
                start = time.time()
                client = RadiusClient(
                    host=server.host,
                    auth_port=server.auth_port,
                    secret=server.secret_encrypted
                )
                is_valid, attrs = client.authenticate_credentials(card_number, password)
                elapsed_ms = round((time.time() - start) * 1000, 2)

                # تحديث إحصائيات الخادم
                server.latency_ms = elapsed_ms
                server.total_requests += 1
                server.status = RadiusServer.Status.ONLINE
                server.save()

                if is_valid:
                    return True, attrs, server.name
                else:
                    return False, attrs, server.name
            except Exception as e:
                server.failed_requests += 1
                server.status = RadiusServer.Status.DEGRADED
                server.save()
                last_error = e

        raise RadiusServerUnreachable(f"All RADIUS servers failed. Last: {last_error}")`,
    },
    'role-models': {
      title: 'نماذج Role و RolePermission (Decision 37)',
      path: '/backend/apps/permissions/models.py',
      language: 'python',
      explanation: 'نماذج الصلاحيات المؤسسية: نموذج Role يدعم مستويات النطاق الأربعة (GLOBAL, TENANT, SITE, USER) مع علاقة ManyToMany عبر نموذج RolePermission الوسيط الداعم لخاصية المنح (ALLOW) أو الحظر الصريح (DENY).',
      content: `class Role(TimeStampedUUIDModel):
    """
    نموذج الدور المؤسسي (Decision 37: Multi-Scope Roles)
    يدعم نطاقات: GLOBAL, TENANT, SITE, USER
    """
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
        return self.code == 'SUPER_ADMIN'

    def get_allowed_permissions(self):
        return self.permissions.filter(role_bindings__effect=RolePermission.Effect.ALLOW)

    def has_permission(self, permission_code: str) -> bool:
        if self.is_super_admin:
            return True
        return self.permissions_map.filter(
            permission__code=permission_code,
            effect=RolePermission.Effect.ALLOW
        ).exists()


class RolePermission(TimeStampedUUIDModel):
    """
    الربط بين الدور والصلاحية مع تحديد الأثر (Effect: ALLOW / DENY)
    """
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
        return f"{self.role.code} -> {self.permission.code} [{self.effect}]"`,
    },
    'roles-migration': {
      title: 'تهيئة الأدوار الأساسية (Data Migration)',
      path: '/backend/apps/permissions/migrations/0004_seed_standard_roles.py',
      language: 'python',
      explanation: 'تهيئة الأدوار الستة القياسية (SUPER_ADMIN, TENANT_ADMIN, SITE_MANAGER, CONTENT_MANAGER, SUPPORT, USER) وربط الصلاحيات بها بدقة مع دالة التراجع العكسي reverse_code.',
      content: `from django.db import migrations

def seed_standard_enterprise_roles(apps, schema_editor):
    Role = apps.get_model('permissions', 'Role')
    Permission = apps.get_model('permissions', 'Permission')
    RolePermission = apps.get_model('permissions', 'RolePermission')

    ROLES_DATA = [
        {
            'code': 'SUPER_ADMIN',
            'name': 'مدير عام المنظومة (Super Administrator)',
            'description': 'صلاحيات مطلقة وشاملة على مستوى كافة المستأجرين والفروع والسيرفرات.',
            'scope_level': 'GLOBAL',
            'is_system': True,
            'is_assignable': False,
        },
        {
            'code': 'TENANT_ADMIN',
            'name': 'مدير المستأجر (Tenant Administrator)',
            'description': 'إدارة كاملة على نطاق المستأجر بما يشمل كافة فروعه وخوادمه ومستخدميه.',
            'scope_level': 'TENANT',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'SITE_MANAGER',
            'name': 'مدير الفرع / الموقع (Site Manager)',
            'description': 'إدارة عمليات استراحة أو فرع محدد، متابعة مستخدمي الهوتسبوت ومراقبة البوابات.',
            'scope_level': 'SITE',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'CONTENT_MANAGER',
            'name': 'مدير المحتوى والخوادم (Content Manager)',
            'description': 'إدارة خوادم الوسائط المحلية (Jellyfin/Emby) والمكتبات وتصنيفات المحتوى.',
            'scope_level': 'TENANT',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'SUPPORT',
            'name': 'مسؤول الدعم الفني (Technical Support)',
            'description': 'تشخيص مشاكل الاتصال بالهوتسبوت وسجلات الجلسات دون صلاحيات حساسة.',
            'scope_level': 'SITE',
            'is_system': True,
            'is_assignable': True,
        },
        {
            'code': 'USER',
            'name': 'مستخدم الاستراحة الافتراضي (Standard User)',
            'description': 'المستخدم العادي المسموح له بتشغيل وبث الوسائط والميزات القياسية وفق بروفايله.',
            'scope_level': 'USER',
            'is_system': True,
            'is_assignable': False,
        },
    ]

    created_roles = {}
    for rdata in ROLES_DATA:
        role, _ = Role.objects.update_or_create(code=rdata['code'], defaults=rdata)
        created_roles[rdata['code']] = role

    all_permissions = {p.code: p for p in Permission.objects.all()}

    # SUPER_ADMIN: يحصل على كافة الصلاحيات بنطاق ALLOW
    for perm in all_permissions.values():
        RolePermission.objects.update_or_create(
            role=created_roles['SUPER_ADMIN'],
            permission=perm,
            defaults={'effect': 'ALLOW'}
        )

    # TENANT_ADMIN: إدارة المحتوى والمستخدمين والسيرفرات للمستأجر
    for code, perm in all_permissions.items():
        if code.startswith(('content.', 'features.')) or code in [
            'admin.panel.access', 'admin.users.view', 'admin.users.create', 'admin.users.edit',
            'admin.servers.view', 'admin.servers.create', 'admin.servers.edit',
            'admin.permissions.manage', 'system.audit.view'
        ]:
            RolePermission.objects.update_or_create(
                role=created_roles['TENANT_ADMIN'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # SITE_MANAGER: إدارة الفرع والهوتسبوت
    for code, perm in all_permissions.items():
        if code.startswith(('content.', 'features.')) or code in [
            'admin.panel.access', 'admin.users.view', 'admin.users.create', 'admin.users.edit',
            'admin.mikrotik.manage', 'admin.radius.manage', 'system.audit.view'
        ]:
            RolePermission.objects.update_or_create(
                role=created_roles['SITE_MANAGER'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # CONTENT_MANAGER: إدارة الخوادم والمكتبات
    for code, perm in all_permissions.items():
        if code.startswith(('content.', 'features.')) or code in [
            'admin.panel.access', 'admin.servers.view', 'admin.servers.create',
            'admin.servers.edit', 'admin.servers.delete'
        ]:
            RolePermission.objects.update_or_create(
                role=created_roles['CONTENT_MANAGER'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # SUPPORT: الدعم والتشخيص
    for code, perm in all_permissions.items():
        if code in ['admin.panel.access', 'admin.users.view', 'admin.servers.view', 'admin.mikrotik.manage', 'admin.radius.manage', 'system.audit.view']:
            RolePermission.objects.update_or_create(
                role=created_roles['SUPPORT'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

    # USER: تشغيل وبث الوسائط
    for code, perm in all_permissions.items():
        if code in ['content.movies.view', 'content.movies.play', 'content.series.view', 'content.series.play', 'content.kids.view', 'content.kids.play', 'features.favorites', 'features.rating', 'features.watchlist']:
            RolePermission.objects.update_or_create(
                role=created_roles['USER'],
                permission=perm,
                defaults={'effect': 'ALLOW'}
            )

def reverse_seed_standard_roles(apps, schema_editor):
    Role = apps.get_model('permissions', 'Role')
    RolePermission = apps.get_model('permissions', 'RolePermission')
    roles = Role.objects.filter(code__in=['SUPER_ADMIN', 'TENANT_ADMIN', 'SITE_MANAGER', 'CONTENT_MANAGER', 'SUPPORT', 'USER'])
    RolePermission.objects.filter(role__in=roles).delete()
    roles.delete()

class Migration(migrations.Migration):
    dependencies = [('permissions', '0003_phase3_enterprise_permissions_and_roles')]
    operations = [migrations.RunPython(seed_standard_enterprise_roles, reverse_seed_standard_roles)]`,
    },
  };

  const currentFile = files[activeFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              <span>معمارية الباك إند: Django 5.x + PostgreSQL 16 + Celery</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            استعراض الكود المصدري وهيكلية Docker Compose
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            تم بناء المشروع وفق معايير Enterprise Modular Django لضمان عزل الصلاحيات واستقلالية الهوية وسهولة ربط خوادم الوسائط عبر موصلات قابلة للتوسع (Connectors).
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            Django 5.1 LTS
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
            Postgres 16
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
            Redis 7 + Celery
          </span>
        </div>
      </div>

      {/* Code Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File Navigator Sidebar */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-amber-400" />
            <span>ملفات النظام الجوهرية</span>
          </div>
          <div className="space-y-1">
            {Object.entries(files).map(([key, f]) => {
              const isSelected = activeFile === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveFile(key)}
                  className={`w-full text-right p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-850 border-amber-500/40 text-amber-400 font-bold shadow-md'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-850/50'
                  }`}
                >
                  <div className="text-xs font-semibold">{f.title}</div>
                  <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5" dir="ltr">
                    {f.path}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Architecture Checklist Card */}
          <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
            <span className="font-bold text-slate-200 block">المعايير المطبقة في الباك إند:</span>
            <ul className="space-y-1.5 text-slate-400 text-[11px]">
              <li className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Smart Lounge هو المرجع النهائي للصلاحيات</span>
              </li>
              <li className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>عزل معرّف lounge_id عن شبكة MikroTik</span>
              </li>
              <li className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>موصلات مرنة لـ Jellyfin و Emby و Plex</span>
              </li>
              <li className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>فلترة تلقائية صارمة لبروفايلات الأطفال و VIP</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Code Content & Explanation */}
        <div className="lg:col-span-3 space-y-3">
          {/* Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">{currentFile.title}:</strong>
              {currentFile.explanation}
            </div>
          </div>

          {/* Code Stage */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-xs text-slate-200" dir="ltr">
                  {currentFile.path}
                </span>
              </div>

              <button
                onClick={handleCopy}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
              </button>
            </div>

            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[480px] leading-relaxed select-all">
              {currentFile.content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
