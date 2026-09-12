import uuid
from django.db import migrations

DEFAULT_STEPS = [
    {
        'step_key': 'welcome',
        'display_name': 'Welcome',
        'display_name_ar': 'أهلاً بك في الاستراحة الذكية',
        'display_name_en': 'Welcome to Smart Lounge',
        'description': 'شاشة الترحيب واستعراض خطوات الإعداد الأولي للمشاهدة المحلية',
        'step_type': 'INFO',
        'order': 10,
        'is_required': True,
        'is_skippable': False,
        'can_resume_from': True,
        'depends_on': [],
        'config': {
            'illustration': 'welcome_hero',
            'show_lounge_id': True,
        },
    },
    {
        'step_key': 'language_timezone',
        'display_name': 'Language & Timezone',
        'display_name_ar': 'اللغة والمنطقة الزمنية',
        'display_name_en': 'Language & Timezone',
        'description': 'اختيار لغة الواجهة الأساسية وتوقيت الاستراحة لعرض جداول البث بدقة',
        'step_type': 'FORM',
        'order': 20,
        'is_required': True,
        'is_skippable': False,
        'can_resume_from': True,
        'depends_on': ['welcome'],
        'config': {
            'default_language': 'ar',
            'default_timezone': 'Asia/Aden',
            'available_languages': ['ar', 'en'],
        },
    },
    {
        'step_key': 'profile_basics',
        'display_name': 'Complete Your Profile',
        'display_name_ar': 'أكمل ملفك الشخصي',
        'display_name_en': 'Complete Your Profile',
        'description': 'إضافة اسم الظهور ورقم الهاتف لتسهيل التواصل والتعافي (اختياري)',
        'step_type': 'FORM',
        'order': 30,
        'is_required': False,
        'is_skippable': True,
        'can_resume_from': True,
        'depends_on': ['language_timezone'],
        'config': {
            'fields': ['full_name', 'display_name', 'phone', 'email', 'city'],
            'optional': True,
        },
    },
    {
        'step_key': 'preferences',
        'display_name': 'Your Preferences',
        'display_name_ar': 'تفضيلات المحتوى والإشعارات',
        'display_name_en': 'Your Preferences',
        'description': 'تحديد تصنيفات الأفلام والمسلسلات المفضلة وخيارات الإشعارات',
        'step_type': 'PREFERENCE',
        'order': 40,
        'is_required': False,
        'is_skippable': True,
        'can_resume_from': True,
        'depends_on': ['language_timezone'],
        'config': {
            'genres': [
                'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror',
                'Romance', 'Documentary', 'Animation', 'Kids',
                'Sports', 'Arabic', 'Foreign'
            ],
            'content_types': ['Movies', 'Series', 'Kids', 'Sports', 'Live TV'],
        },
    },
    {
        'step_key': 'consent',
        'display_name': 'Terms & Privacy',
        'display_name_ar': 'الشروط والخصوصية القانونية',
        'display_name_en': 'Terms & Privacy',
        'description': 'الموافقة الملزمة على شروط استخدام الاستراحة وسياسة الخصوصية وحماية البيانات',
        'step_type': 'CONSENT',
        'order': 50,
        'is_required': True,
        'is_skippable': False,
        'can_resume_from': True,
        'depends_on': ['language_timezone'],
        'config': {
            'required_consents': ['TERMS_OF_SERVICE', 'PRIVACY_POLICY'],
            'optional_consents': ['DATA_PROCESSING', 'MARKETING', 'ANALYTICS'],
            'versions': {
                'TERMS_OF_SERVICE': 'v2.1',
                'PRIVACY_POLICY': 'v1.5',
                'DATA_PROCESSING': 'v1.0',
            },
        },
    },
    {
        'step_key': 'feature_tour',
        'display_name': 'Discover Features',
        'display_name_ar': 'اكتشف مزايا الاستراحة',
        'display_name_en': 'Discover Features',
        'description': 'جولة سريعة ومختصرة لاستعراض تجربة المشاهدة والتنقل',
        'step_type': 'TOUR',
        'order': 60,
        'is_required': False,
        'is_skippable': True,
        'can_resume_from': True,
        'depends_on': ['consent'],
        'config': {
            'slides': [
                {
                    'id': 'browse',
                    'title_ar': 'تصفح فوري وسلس',
                    'title_en': 'Instant Local Browsing',
                    'desc_ar': 'وصول سريع إلى مكتبات الأفلام والمسلسلات داخل الشبكة المحلية بدون استهلاك لإنترنتك الخارجي',
                },
                {
                    'id': 'playback',
                    'title_ar': 'تشغيل بجودة فائقة واستئناف المشاهدة',
                    'title_en': 'Seamless Streaming & Resume',
                    'desc_ar': 'شاهد بأعلى جودة مع إمكانية استئناف التشغيل التلقائي من أي جهاز',
                },
                {
                    'id': 'custom_accounts',
                    'title_ar': 'حساب سيرفر الوسائط المخصص',
                    'title_en': 'Personal Media Server Account',
                    'desc_ar': 'حسابك في Jellyfin/Emby جاهز ومشفر لتسجيل الدخول على تطبيقات التلفزيون الذكي',
                },
                {
                    'id': 'devices',
                    'title_ar': 'متوافق مع كل شاشاتك',
                    'title_en': 'Every Device Supported',
                    'desc_ar': 'تجربة مشاهدة متطابقة وموحدة على الشاشات الكبيرة والهواتف والحواسيب',
                },
            ]
        },
    },
    {
        'step_key': 'subscription_check',
        'display_name': 'Subscription',
        'display_name_ar': 'حالة الاشتراك والباقات',
        'display_name_en': 'Subscription',
        'description': 'التحقق من الاشتراك النشط أو تصفح باقات الاستراحة المتاحة',
        'step_type': 'REDIRECT',
        'order': 70,
        'is_required': False,
        'is_skippable': True,
        'can_resume_from': True,
        'depends_on': ['consent'],
        'config': {
            'plans_url': '/billing/plans',
            'allow_skip_to_free': True,
        },
    },
]

def seed_default_steps(apps, schema_editor):
    OnboardingStepTemplate = apps.get_model('accounts', 'OnboardingStepTemplate')
    for step_data in DEFAULT_STEPS:
        OnboardingStepTemplate.objects.update_or_create(
            tenant=None,
            step_key=step_data['step_key'],
            defaults={
                'id': uuid.uuid4(),
                'display_name': step_data['display_name'],
                'display_name_ar': step_data['display_name_ar'],
                'display_name_en': step_data['display_name_en'],
                'description': step_data['description'],
                'step_type': step_data['step_type'],
                'order': step_data['order'],
                'is_required': step_data['is_required'],
                'is_skippable': step_data['is_skippable'],
                'can_resume_from': step_data['can_resume_from'],
                'depends_on': step_data['depends_on'],
                'config': step_data['config'],
                'is_active': True,
            }
        )

def remove_default_steps(apps, schema_editor):
    OnboardingStepTemplate = apps.get_model('accounts', 'OnboardingStepTemplate')
    keys = [s['step_key'] for s in DEFAULT_STEPS]
    OnboardingStepTemplate.objects.filter(tenant=None, step_key__in=keys).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_onboarding_models'),
    ]

    operations = [
        migrations.RunPython(seed_default_steps, remove_default_steps),
    ]
