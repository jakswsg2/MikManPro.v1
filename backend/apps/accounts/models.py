import uuid
import random
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from apps.tenancy.models import Tenant

class UserManager(BaseUserManager):
    def generate_lounge_id(self):
        """Generates a sequential or high-entropy Lounge ID formatted like LU-000152"""
        for _ in range(10):
            candidate = f"LU-{random.randint(100000, 999999)}"
            if not self.model.objects.filter(lounge_id=candidate).exists():
                return candidate
        # Fallback to UUID-derived ID
        return f"LU-{uuid.uuid4().hex[:6].upper()}"

    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('اسم المستخدم مطلوب')
        
        if 'lounge_id' not in extra_fields or not extra_fields['lounge_id']:
            extra_fields['lounge_id'] = self.generate_lounge_id()

        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('status', User.Status.ACTIVE)
        extra_fields.setdefault('language', 'ar')
        extra_fields.setdefault('timezone', 'Asia/Aden')

        user = self.model(username=username, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('status', User.Status.ACTIVE)
        extra_fields.setdefault('full_name', 'System Administrator')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'نشط (Active)'
        GRACE_PERIOD = 'GRACE_PERIOD', 'فترة سماح (Grace Period)'
        EXPIRED = 'EXPIRED', 'منتهي الصلاحية (Expired)'
        SUSPENDED = 'SUSPENDED', 'معلق (Suspended)'

    class Language(models.TextChoices):
        ARABIC = 'ar', 'العربية'
        ENGLISH = 'en', 'English'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lounge_id = models.CharField(
        max_length=32,
        unique=True,
        editable=False,
        db_index=True,
        verbose_name="معرّف الاستراحة (Lounge ID)"
    )
    username = models.CharField(
        max_length=150,
        unique=True,
        db_index=True,
        verbose_name="اسم المستخدم"
    )
    email = models.EmailField(blank=True, null=True, verbose_name="البريد الإلكتروني")
    full_name = models.CharField(max_length=200, verbose_name="الاسم الكامل")
    phone = models.CharField(max_length=30, blank=True, null=True, verbose_name="رقم الهاتف")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True, verbose_name="الصورة الشخصية")
    
    language = models.CharField(
        max_length=10,
        choices=Language.choices,
        default=Language.ARABIC,
        verbose_name="اللغة المفضلة"
    )
    timezone = models.CharField(
        max_length=50,
        default='Asia/Aden',
        verbose_name="المنطقة الزمنية"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        verbose_name="حالة الحساب"
    )
    
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    is_staff = models.BooleanField(default=False, verbose_name="طاقم إدارة")
    is_superuser = models.BooleanField(default=False, verbose_name="مدير عام")

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        verbose_name="المستأجر (مستقبلي)"
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = "مستخدم الاستراحة (Lounge User)"
        verbose_name_plural = "مستخدمو الاستراحة"
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.lounge_id:
            self.lounge_id = User.objects.generate_lounge_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.lounge_id})"

    @property
    def active_profile(self):
        """Returns currently active assigned profile or None"""
        assignment = self.profile_assignments.filter(is_active=True).select_related('profile').first()
        return assignment.profile if assignment else None


class ExternalIdentity(models.Model):
    """
    ربط الهويات الخارجية (External Identity Linking)
    يربط هوية المستخدم القادمة من كروت الشحن، MikroTik Hotspot، أو خادم RADIUS
    بـ Lounge User ID المستقل داخل نظام الاستراحة الذكية.
    """
    class IdentityType(models.TextChoices):
        MIKROTIK = 'MIKROTIK', 'MikroTik Hotspot'
        RADIUS = 'RADIUS', 'RADIUS Voucher/Card'
        GOOGLE = 'GOOGLE', 'Google OAuth (مستقبلي)'
        LOCAL = 'LOCAL', 'حساب محلي مباشر (Direct Local)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='external_identities',
        verbose_name="مستخدم الاستراحة المرتبط"
    )
    identity_type = models.CharField(
        max_length=20,
        choices=IdentityType.choices,
        default=IdentityType.RADIUS,
        verbose_name="نوع الهوية الخارجية"
    )
    external_id = models.CharField(
        max_length=128,
        db_index=True,
        verbose_name="المعرّف الخارجي (مثال: CARD-10001 أو MAC Address)"
    )
    external_metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية من المصدر الخارجي"
    )
    is_primary = models.BooleanField(
        default=False,
        verbose_name="الهوية الرئيسية"
    )
    is_verified = models.BooleanField(
        default=True,
        verbose_name="موثّقة من الخادم الخارجي"
    )
    first_seen_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="أول ظهور"
    )
    last_seen_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="آخر ظهور"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "هوية خارجية (External Identity)"
        verbose_name_plural = "الهويات الخارجية المربوطة"
        constraints = [
            models.UniqueConstraint(
                fields=['identity_type', 'external_id'],
                name='unique_identity_type_external_id'
            )
        ]
        indexes = [
            models.Index(fields=['external_id']),
            models.Index(fields=['user']),
        ]
        ordering = ['-last_seen_at']

    def __str__(self):
        user_display = self.user.lounge_id if self.user else "غير مربوط"
        return f"[{self.identity_type}] {self.external_id} -> {user_display}"


class LoungeSession(models.Model):
    """
    نظام الجلسات الآمن (Secure Lounge Session)
    يحفظ بيانات الجلسة النشطة دون تخزين التوكن الصريح (فقط SHA-256 hash)
    ويدعم إلغاء الجلسات وإعادة التدوير الدوري (Token Rotation).
    """
    class Source(models.TextChoices):
        HOTSPOT = 'HOTSPOT', 'MikroTik Hotspot Portal'
        RADIUS = 'RADIUS', 'RADIUS Direct'
        SSO = 'SSO', 'Captive Portal SSO Redirect'
        MANUAL = 'MANUAL', 'تسجيل دخول يدوي'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'نشطة (Active)'
        EXPIRED = 'EXPIRED', 'منتهية الصلاحية (Expired)'
        REVOKED = 'REVOKED', 'ملغاة أمنياً (Revoked)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sessions',
        verbose_name="المستخدم"
    )
    external_identity = models.ForeignKey(
        ExternalIdentity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions',
        verbose_name="الهوية الخارجية المستخدمة"
    )
    session_token_hash = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name="تجزئة توكن الجلسة (SHA-256 Hash)"
    )
    refresh_token_hash = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name="تجزئة توكن التجديد (SHA-256 Hash)"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="عنوان IP للمتصل"
    )
    user_agent = models.TextField(
        blank=True,
        default='',
        verbose_name="وكيل المستخدم (User-Agent)"
    )
    device_fingerprint = models.CharField(
        max_length=128,
        null=True,
        blank=True,
        verbose_name="بصمة الجهاز (Fingerprint)"
    )
    mikrotik_session_id = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        verbose_name="معرّف جلسة MikroTik"
    )
    radius_session_id = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        verbose_name="معرّف جلسة RADIUS (Acct-Session-Id)"
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.SSO,
        verbose_name="مصدر الجلسة"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        verbose_name="حالة الجلسة"
    )
    issued_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="وقت الإصدار"
    )
    expires_at = models.DateTimeField(
        verbose_name="وقت انتهاء الصلاحية"
    )
    last_activity_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="آخر نشاط"
    )
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="وقت الإلغاء"
    )
    revoked_reason = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="سبب الإلغاء"
    )

    class Meta:
        verbose_name = "جلسة الاستراحة (Lounge Session)"
        verbose_name_plural = "جلسات الاستراحة"
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['session_token_hash']),
            models.Index(fields=['refresh_token_hash']),
        ]

    def __str__(self):
        return f"Session {self.id.hex[:8]} - {self.user.username} ({self.status})"

    @property
    def is_valid(self):
        return self.status == self.Status.ACTIVE and timezone.now() < self.expires_at


class AuditLog(models.Model):
    """
    سجل التدقيق الأمني (Decision 35: Enterprise Audit Log)
    يسجل كافة أحداث المصادقة والجلسات دون تسجيل أي أسرار أو كلمات مرور أو توكنات صريحة.
    """
    class EventType(models.TextChoices):
        LOGIN_SUCCESS = 'LOGIN_SUCCESS', 'تسجيل دخول ناجح'
        FIRST_TIME_REGISTER = 'FIRST_TIME_REGISTER', 'تسجيل دخول أول مرة (إنشاء مستخدم تلقائي)'
        LOGIN_FAILED = 'LOGIN_FAILED', 'فشل المصادقة'
        TOKEN_REFRESH = 'TOKEN_REFRESH', 'تجديد توكن الجلسة'
        SESSION_REVOKED = 'SESSION_REVOKED', 'إلغاء جلسة'
        SESSIONS_REVOKE_ALL = 'SESSIONS_REVOKE_ALL', 'تسجيل خروج من جميع الأجهزة'
        CARD_LINKED = 'CARD_LINKED', 'ربط كارت/هوية جديدة بحساب موجود'
        ROUTER_SYNC = 'ROUTER_SYNC', 'مزامنة بوابة MikroTik'
        RADIUS_AUTH = 'RADIUS_AUTH', 'فحص مصادقة RADIUS'
        ONBOARDING_STARTED = 'ONBOARDING_STARTED', 'بدء مسار التهيئة والإعداد الأولي'
        ONBOARDING_STEP_COMPLETED = 'ONBOARDING_STEP_COMPLETED', 'إكمال خطوة في مسار التهيئة'
        ONBOARDING_COMPLETED = 'ONBOARDING_COMPLETED', 'اكتمال مسار التهيئة بنجاح'
        CONSENT_GRANTED = 'CONSENT_GRANTED', 'منح موافقة قانونية'
        CONSENT_REVOKED = 'CONSENT_REVOKED', 'إلغاء موافقة قانونية'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(
        max_length=32,
        choices=EventType.choices,
        db_index=True,
        verbose_name="نوع الحدث"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name="المستخدم"
    )
    external_identity_ref = models.CharField(
        max_length=128,
        blank=True,
        default='',
        verbose_name="مرجع الهوية الخارجية"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="عنوان IP"
    )
    user_agent = models.TextField(
        blank=True,
        default='',
        verbose_name="User-Agent"
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="تفاصيل آمنة (خالية من الأسرار)"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="وقت الحدث"
    )

    class Meta:
        verbose_name = "سجل تدقيق أمني (Audit Log)"
        verbose_name_plural = "سجلات التدقيق الأمنية"
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {self.event_type} - {self.external_identity_ref}"


class OnboardingState(models.Model):
    """
    نموذج تتبع حالة ومسار الإعداد الأولي للمستخدم (Onboarding State Machine).
    - يدعم الاستئناف (Resumable) دون فقدان البيانات.
    - يسجل الخطوات المكتملة والمتخطاة ونسبة الإنجاز.
    """
    class Status(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', 'لم يبدأ (Not Started)'
        IN_PROGRESS = 'IN_PROGRESS', 'قيد الإجراء (In Progress)'
        COMPLETED = 'COMPLETED', 'مكتمل (Completed)'
        SKIPPED = 'SKIPPED', 'تم التخطي (Skipped)'

    OnboardingStatus = Status

    class Source(models.TextChoices):
        HOTSPOT = 'HOTSPOT', 'Hotspot Captive Portal'
        RADIUS = 'RADIUS', 'RADIUS Direct'
        GOOGLE = 'GOOGLE', 'Google OAuth'
        MANUAL = 'MANUAL', 'يدوي / إداري (Manual)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='onboarding_state',
        verbose_name="المستخدم"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='onboarding_states',
        null=True,
        blank=True,
        verbose_name="المستأجر / الاستراحة"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_STARTED,
        db_index=True,
        verbose_name="حالة الإعداد"
    )
    current_step = models.CharField(
        max_length=64,
        default='welcome',
        verbose_name="الخطوة الحالية"
    )
    completed_steps = models.JSONField(
        default=list,
        blank=True,
        verbose_name="الخطوات المكتملة"
    )
    skipped_steps = models.JSONField(
        default=list,
        blank=True,
        verbose_name="الخطوات المتخطاة"
    )
    step_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات الخطوات المؤقتة"
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت البدء"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت الإكمال"
    )
    skipped_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت التخطي"
    )
    last_step_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="تاريخ آخر نشاط في المسار"
    )
    onboarding_version = models.CharField(
        max_length=20,
        default='v1.0',
        verbose_name="إصدار مسار التهيئة"
    )
    resume_url = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="رابط الاستئناف"
    )
    is_first_login = models.BooleanField(
        default=True,
        verbose_name="تسجيل دخول لأول مرة"
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.HOTSPOT,
        verbose_name="مصدر التسجيل"
    )
    completion_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        verbose_name="نسبة الإكمال %"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "حالة الإعداد الأولي للمستخدم (Onboarding State)"
        verbose_name_plural = "حالات الإعداد الأولي للمستخدمين"
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
            models.Index(fields=['tenant', 'status']),
        ]

    def __str__(self):
        return f"Onboarding: {self.user.username} - [{self.status}] Step: {self.current_step} ({self.completion_percentage}%)"


class UserPreferences(models.Model):
    """
    نموذج تفضيلات المستخدم (UI, Audio, Subtitles, Playback, Privacy, Notifications).
    - تُنشأ تلقائياً عند أول Onboarding.
    - تطبق كـ Override على إعدادات المستأجر/الاستراحة (Tenant Settings).
    """
    class Theme(models.TextChoices):
        LIGHT = 'LIGHT', 'فاتح (Light)'
        DARK = 'DARK', 'داكن (Dark)'
        AUTO = 'AUTO', 'تلقائي حسب نظام التشغيل'

    class TimeFormat(models.TextChoices):
        FORMAT_12H = '12H', '12 ساعة (ص/م)'
        FORMAT_24H = '24H', '24 ساعة (نظام عسكري)'

    class SubtitleSize(models.TextChoices):
        SMALL = 'SMALL', 'صغير (Small)'
        MEDIUM = 'MEDIUM', 'متوسط (Medium)'
        LARGE = 'LARGE', 'كبير (Large)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='preferences',
        verbose_name="المستخدم"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='user_preferences',
        null=True,
        blank=True,
        verbose_name="المستأجر / الاستراحة"
    )
    language = models.CharField(
        max_length=10,
        choices=[('ar', 'العربية'), ('en', 'English')],
        default='ar',
        verbose_name="اللغة المفضلة"
    )
    timezone = models.CharField(
        max_length=50,
        default='Asia/Aden',
        verbose_name="المنطقة الزمنية"
    )
    date_format = models.CharField(
        max_length=20,
        default='DD/MM/YYYY',
        verbose_name="تنسيق التاريخ"
    )
    time_format = models.CharField(
        max_length=10,
        choices=TimeFormat.choices,
        default=TimeFormat.FORMAT_24H,
        verbose_name="تنسيق الوقت"
    )
    theme = models.CharField(
        max_length=10,
        choices=Theme.choices,
        default=Theme.DARK,
        verbose_name="المظهر والتصميم"
    )
    autoplay_next = models.BooleanField(
        default=True,
        verbose_name="تشغيل الحلقة التالية تلقائياً"
    )
    autoplay_preview = models.BooleanField(
        default=False,
        verbose_name="تشغيل المعاينة الترويجية تلقائياً"
    )
    default_quality = models.CharField(
        max_length=20,
        default='AUTO',
        verbose_name="جودة البث الافتراضية"
    )
    subtitle_language = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        verbose_name="لغة الترجمة المفضلة"
    )
    audio_language = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        verbose_name="لغة الصوت المفضلة"
    )
    subtitle_enabled = models.BooleanField(
        default=False,
        verbose_name="تفعيل الترجمة افتراضياً"
    )
    subtitle_size = models.CharField(
        max_length=20,
        choices=SubtitleSize.choices,
        default=SubtitleSize.MEDIUM,
        verbose_name="حجم خط الترجمة"
    )
    notifications_enabled = models.BooleanField(
        default=True,
        verbose_name="تفعيل الإشعارات العامة"
    )
    email_notifications = models.BooleanField(
        default=True,
        verbose_name="إشعارات البريد الإلكتروني"
    )
    push_notifications = models.BooleanField(
        default=False,
        verbose_name="إشعارات المتصفح الفورية (Push)"
    )
    whatsapp_notifications = models.BooleanField(
        default=False,
        verbose_name="إشعارات تطبيق واتساب"
    )
    marketing_emails = models.BooleanField(
        default=False,
        verbose_name="الرسائل والعروض الترويجية"
    )
    content_maturity_rating = models.CharField(
        max_length=20,
        default='ALL',
        verbose_name="التصنيف العمري للمحتوى"
    )
    reduce_motion = models.BooleanField(
        default=False,
        verbose_name="تقليل المؤثرات الحركية (Reduce Motion)"
    )
    reduce_data_usage = models.BooleanField(
        default=False,
        verbose_name="توفير استهلاك البيانات (Low Bandwidth)"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "تفضيلات المستخدم (User Preferences)"
        verbose_name_plural = "تفضيلات المستخدمين"
        constraints = [
            models.UniqueConstraint(fields=['user'], name='unique_user_preferences')
        ]

    def __str__(self):
        return f"Preferences: {self.user.username} ({self.language}, {self.theme})"


class UserConsent(models.Model):
    """
    نموذج توثيق وتتبع موافقات المستخدم القانونية (GDPR / Consent Management).
    - وثيقة قانونية ملزمة لكل إصدار من الشروط وسياسة الخصوصية ومعالجة البيانات.
    - قابلة للإلغاء (Revocable) مع توثيق السبب وبصمة التوقيع الرقمي (Signature Hash).
    """
    class ConsentType(models.TextChoices):
        TERMS_OF_SERVICE = 'TERMS_OF_SERVICE', 'شروط الخدمة والاتفاقية (Terms of Service)'
        PRIVACY_POLICY = 'PRIVACY_POLICY', 'سياسة الخصوصية (Privacy Policy)'
        DATA_PROCESSING = 'DATA_PROCESSING', 'معالجة البيانات التشغيلية (Data Processing)'
        MARKETING = 'MARKETING', 'المراسلات والعروض التسويقية (Marketing)'
        ANALYTICS = 'ANALYTICS', 'التحليلات وتحسين الأداء (Analytics)'
        COOKIES = 'COOKIES', 'ملفات تعريف الارتباط والتخزين المحلي (Cookies & Storage)'
        THIRD_PARTY = 'THIRD_PARTY', 'التكامل مع خدمات وسيرفرات الطرف الثالث (Third Party)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='consents',
        verbose_name="المستخدم"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='user_consents',
        null=True,
        blank=True,
        verbose_name="المستأجر / الاستراحة"
    )
    consent_type = models.CharField(
        max_length=40,
        choices=ConsentType.choices,
        db_index=True,
        verbose_name="نوع الموافقة"
    )
    consent_version = models.CharField(
        max_length=20,
        verbose_name="إصدار وثيقة الموافقة"
    )
    granted = models.BooleanField(
        default=True,
        verbose_name="ممنوحة / مقبولة"
    )
    granted_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="تاريخ ووقت المنح"
    )
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ ووقت الإلغاء"
    )
    revoked_reason = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="سبب إلغاء الموافقة"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="عنوان IP للمستخدم وقت التوقيع"
    )
    user_agent = models.TextField(
        blank=True,
        default='',
        verbose_name="بيانات المتصفح والنظام (User-Agent)"
    )
    signature_hash = models.CharField(
        max_length=128,
        verbose_name="بصمة التوقيع الرقمية للتحقق"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية إضافية"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "موافقة المستخدم القانونية (User Consent)"
        verbose_name_plural = "موافقات المستخدمين القانونية"
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'consent_type', 'consent_version'],
                name='unique_user_consent_per_version'
            )
        ]
        indexes = [
            models.Index(fields=['user', 'consent_type']),
            models.Index(fields=['consent_type', 'granted']),
        ]

    def __str__(self):
        status = "Granted" if self.granted else "Revoked"
        return f"{self.user.username} - {self.consent_type} ({self.consent_version}): {status}"


class UserProfileCompletion(models.Model):
    """
    نموذج تتبع إكمال الملف الشخصي للمستخدم (Progressive Profiling & Extended Demographics).
    - طبقة تكميلية اختيارية للمستخدم لا تعطل الاستخدام الأساسي.
    - تجمع التفضيلات العامة (الأصناف المفضلة، أنواع المحتوى) لدعم محرك التوصيات.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile_completion',
        verbose_name="المستخدم"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='profile_completions',
        null=True,
        blank=True,
        verbose_name="المستأجر / الاستراحة"
    )
    full_name = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="الاسم الكامل"
    )
    display_name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="اسم العرض والظهور"
    )
    phone = models.CharField(
        max_length=30,
        null=True,
        blank=True,
        verbose_name="رقم الهاتف"
    )
    phone_verified = models.BooleanField(
        default=False,
        verbose_name="رقم الهاتف مؤكد"
    )
    email = models.EmailField(
        null=True,
        blank=True,
        verbose_name="البريد الإلكتروني"
    )
    email_verified = models.BooleanField(
        default=False,
        verbose_name="البريد الإلكتروني مؤكد"
    )
    avatar_url = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="رابط الصورة الشخصية"
    )
    birth_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ الميلاد"
    )
    gender = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        choices=[('MALE', 'ذكر'), ('FEMALE', 'أنثى'), ('OTHER', 'أخرى / لا أرغب بالتحديد')],
        verbose_name="الجنس"
    )
    country = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="الدولة"
    )
    city = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="المدينة"
    )
    preferred_genres = models.JSONField(
        default=list,
        blank=True,
        verbose_name="التصنيفات المفضلة (Genres)"
    )
    preferred_content_types = models.JSONField(
        default=list,
        blank=True,
        verbose_name="أنواع المحتوى المفضلة (Movies, Series, Live TV)"
    )
    completion_fields = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="سجل الحقول المكتملة"
    )
    completion_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        verbose_name="نسبة إكمال الملف %"
    )
    is_optional_complete = models.BooleanField(
        default=False,
        verbose_name="تم إكمال الحقول الاختيارية"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ إكمال الملف"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "إكمال الملف الشخصي (Profile Completion)"
        verbose_name_plural = "إحصائيات إكمال الملفات الشخصية"
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['is_optional_complete']),
        ]

    def __str__(self):
        return f"ProfileCompletion: {self.user.username} ({self.completion_percentage}%)"


class OnboardingStepTemplate(models.Model):
    """
    نموذج قالب وخطوات مسار التهيئة والإعداد الأولي (Onboarding Step Template).
    - يدعم تخصيص الخطوات لكل مستأجر (Tenant-specific) أو استخدام القالب العام (Global Template when tenant is NULL).
    - يحدد ترتيب الخطوات، إمكانية التخطي، التبعيات (Dependencies)، وحالة التفعيل.
    """
    class StepType(models.TextChoices):
        INFO = 'INFO', 'عرض معلومات ترحيبية وتوجيهية (Info / Welcome)'
        FORM = 'FORM', 'نموذج إدخال وتعديل بيانات (Form)'
        CONSENT = 'CONSENT', 'موافقات وشروط قانونية (Consent)'
        PREFERENCE = 'PREFERENCE', 'تفضيلات المستخدم (Preferences)'
        CHOICE = 'CHOICE', 'اختيارات مخصصة (Choice)'
        TOUR = 'TOUR', 'جولة تفاعلية في مزايا المنصة (Feature Tour)'
        REDIRECT = 'REDIRECT', 'توجيه مشروط لصفحة أو خدمة (Redirect / Plans)'
        CUSTOM = 'CUSTOM', 'خطوة مخصصة وتوسعية (Custom Step)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='onboarding_step_templates',
        verbose_name="المستأجر / الاستراحة (NULL = قالب عام لجميع الاستراحات)"
    )
    step_key = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name="المفتاح المعرّف للخطوة (مثل: welcome, profile_basics)"
    )
    display_name = models.CharField(
        max_length=100,
        verbose_name="اسم العرض الأساسي"
    )
    display_name_ar = models.CharField(
        max_length=100,
        verbose_name="اسم العرض بالعربية"
    )
    display_name_en = models.CharField(
        max_length=100,
        verbose_name="اسم العرض بالإنجليزية"
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="وصف الخطوة والهدف منها"
    )
    step_type = models.CharField(
        max_length=30,
        choices=StepType.choices,
        default=StepType.INFO,
        verbose_name="نوع وطبيعة الخطوة"
    )
    order = models.IntegerField(
        default=10,
        verbose_name="ترتيب الخطوة في التسلسل"
    )
    is_required = models.BooleanField(
        default=False,
        verbose_name="خطوة إلزامية لإكمال التهيئة"
    )
    is_skippable = models.BooleanField(
        default=True,
        verbose_name="قابلة للتخطي بواسطة المستخدم"
    )
    can_resume_from = models.BooleanField(
        default=True,
        verbose_name="يمكن استئناف المسار من عندها"
    )
    depends_on = models.JSONField(
        default=list,
        blank=True,
        verbose_name="قائمة الخطوات التابعة المشروطة لاكتمال هذه الخطوة"
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="إعدادات ومتغيرات الخطوة"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشطة وتعمل في المسار"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        verbose_name = "قالب خطوة مسار التهيئة (Onboarding Step Template)"
        verbose_name_plural = "قوالب خطوات مسار التهيئة"
        ordering = ['order', 'created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'step_key'],
                name='unique_tenant_step_key',
                condition=models.Q(tenant__isnull=False)
            ),
            models.UniqueConstraint(
                fields=['step_key'],
                name='unique_global_step_key',
                condition=models.Q(tenant__isnull=True)
            ),
        ]
        indexes = [
            models.Index(fields=['tenant', 'is_active', 'order']),
            models.Index(fields=['step_key']),
        ]

    def __str__(self):
        tenant_name = self.tenant.name if self.tenant else "Global"
        return f"Step: {self.step_key} ({self.display_name_ar}) - [{tenant_name}] Order: {self.order}"



