import sys
import types
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Lightweight Mocks for Django & DRF to allow pure unit testing without DB/Django installation
# ---------------------------------------------------------------------------
if 'jwt' not in sys.modules:
    sys.modules['jwt'] = MagicMock()
if 'cryptography' not in sys.modules:
    sys.modules['cryptography'] = MagicMock()
    sys.modules['cryptography.fernet'] = MagicMock()

if 'django' not in sys.modules:
    django_pkg = types.ModuleType('django')
    django_pkg.__path__ = []
    sys.modules['django'] = django_pkg

    # Set submodules as attributes
    sys.modules['django'].db = MagicMock()
    sys.modules['django.db'] = sys.modules['django'].db
    sys.modules['django.db'].transaction = MagicMock()
    sys.modules['django.db'].models = MagicMock()
    sys.modules['django.db.models'] = sys.modules['django.db'].models

    class FakeTextChoices:
        @classmethod
        def __init_subclass__(cls, **kwargs):
            cls.choices = [(k, v) for k, v in cls.__dict__.items() if not k.startswith('_') and isinstance(v, str)]
            super().__init_subclass__(**kwargs)

    sys.modules['django.db.models'].TextChoices = FakeTextChoices
    sys.modules['django.db.models'].Model = type('Model', (object,), {})

    sys.modules['django'].utils = MagicMock()
    sys.modules['django.utils'] = sys.modules['django'].utils
    sys.modules['django.utils'].timezone = MagicMock()

    sys.modules['django'].core = MagicMock()
    sys.modules['django.core'] = sys.modules['django'].core
    sys.modules['django.core'].cache = MagicMock()
    sys.modules['django.core.cache'] = sys.modules['django.core'].cache
    sys.modules['django.core'].validators = MagicMock()
    sys.modules['django.core.validators'] = sys.modules['django.core'].validators
    sys.modules['django.core'].exceptions = MagicMock()
    sys.modules['django.core.exceptions'] = sys.modules['django.core'].exceptions
    sys.modules['django.core.exceptions'].ValidationError = Exception

    sys.modules['django'].conf = MagicMock()
    sys.modules['django.conf'] = sys.modules['django'].conf
    sys.modules['django.conf'].settings = MagicMock()

    sys.modules['django'].contrib = MagicMock()
    sys.modules['django.contrib'] = sys.modules['django'].contrib
    sys.modules['django.contrib'].auth = MagicMock()
    sys.modules['django.contrib.auth'] = sys.modules['django.contrib'].auth
    sys.modules['django.contrib.auth'].models = MagicMock()
    sys.modules['django.contrib.auth.models'] = sys.modules['django.contrib.auth'].models
    sys.modules['django.contrib.auth.models'].AbstractBaseUser = type('AbstractBaseUser', (object,), {})
    sys.modules['django.contrib.auth.models'].PermissionsMixin = type('PermissionsMixin', (object,), {})
    sys.modules['django.contrib.auth.models'].BaseUserManager = type('BaseUserManager', (object,), {})

    sys.modules['django.contrib'].postgres = MagicMock()
    sys.modules['django.contrib.postgres'] = sys.modules['django.contrib'].postgres
    sys.modules['django.contrib.postgres'].fields = MagicMock()
    sys.modules['django.contrib.postgres.fields'] = sys.modules['django.contrib.postgres'].fields

    sys.modules['rest_framework'] = MagicMock()
    sys.modules['rest_framework.views'] = MagicMock()
    sys.modules['rest_framework.viewsets'] = MagicMock()
    sys.modules['rest_framework.response'] = MagicMock()
    sys.modules['rest_framework.permissions'] = MagicMock()
    sys.modules['rest_framework.serializers'] = MagicMock()
    sys.modules['rest_framework.decorators'] = MagicMock()
    sys.modules['rest_framework.status'] = MagicMock()

# Ensure apps.accounts.models is importable without loading Django DB models
if 'apps' not in sys.modules:
    apps_pkg = types.ModuleType('apps')
    apps_pkg.__path__ = ['backend/apps']
    sys.modules['apps'] = apps_pkg
else:
    apps_pkg = sys.modules['apps']

if 'apps.accounts' not in sys.modules:
    accounts_pkg = types.ModuleType('apps.accounts')
    accounts_pkg.__path__ = ['backend/apps/accounts']
    sys.modules['apps.accounts'] = accounts_pkg
    apps_pkg.accounts = accounts_pkg
else:
    accounts_pkg = sys.modules['apps.accounts']

if 'apps.accounts.models' not in sys.modules:
    models_mod = types.ModuleType('apps.accounts.models')
    
    # Define mock model classes with object managers
    class MockModel:
        objects = MagicMock()
        class EventType:
            ONBOARDING_STARTED = "ONBOARDING_STARTED"
            ONBOARDING_STEP_COMPLETED = "ONBOARDING_STEP_COMPLETED"
            ONBOARDING_COMPLETED = "ONBOARDING_COMPLETED"
            CONSENT_GRANTED = "CONSENT_GRANTED"
            CONSENT_REVOKED = "CONSENT_REVOKED"
        class OnboardingStatus:
            NOT_STARTED = "NOT_STARTED"
            IN_PROGRESS = "IN_PROGRESS"
            COMPLETED = "COMPLETED"
            SKIPPED = "SKIPPED"
        class Source:
            HOTSPOT = "HOTSPOT"
            QR_CODE = "QR_CODE"
            DIRECT = "DIRECT"

    models_mod.User = type('User', (MockModel,), {})
    models_mod.Tenant = type('Tenant', (MockModel,), {})
    models_mod.ExternalIdentity = type('ExternalIdentity', (MockModel,), {})
    models_mod.LoungeSession = type('LoungeSession', (MockModel,), {})
    models_mod.OnboardingState = type('OnboardingState', (MockModel,), {'OnboardingStatus': MockModel.OnboardingStatus, 'Source': MockModel.Source})
    models_mod.OnboardingStepTemplate = type('OnboardingStepTemplate', (MockModel,), {})
    models_mod.UserPreferences = type('UserPreferences', (MockModel,), {})
    models_mod.UserProfileCompletion = type('UserProfileCompletion', (MockModel,), {})
    models_mod.UserConsent = type('UserConsent', (MockModel,), {})
    models_mod.AuditLog = type('AuditLog', (MockModel,), {'EventType': MockModel.EventType})

    sys.modules['apps.accounts.models'] = models_mod
    accounts_pkg.models = models_mod

if 'apps.profiles' not in sys.modules:
    profiles_pkg = types.ModuleType('apps.profiles')
    profiles_pkg.__path__ = ['backend/apps/profiles']
    sys.modules['apps.profiles'] = profiles_pkg
    apps_pkg.profiles = profiles_pkg

if 'apps.profiles.models' not in sys.modules:
    profiles_models_mod = types.ModuleType('apps.profiles.models')
    profiles_models_mod.Profile = type('Profile', (object,), {'objects': MagicMock()})
    profiles_models_mod.UserProfileAssignment = type('UserProfileAssignment', (object,), {'objects': MagicMock()})
    sys.modules['apps.profiles.models'] = profiles_models_mod
    profiles_pkg.models = profiles_models_mod



import unittest
from unittest.mock import patch
from decimal import Decimal

# Import our custom exceptions & handlers
from apps.accounts.services.exceptions import (
    OnboardingException,
    StepNotFound,
    StepNotSkippable,
    StepDependencyMissing,
    OnboardingIncomplete,
    TermsNotAccepted,
    PrivacyNotAccepted,
)
from apps.accounts.services.handlers import (
    StepHandlerRegistry,
    BaseStepHandler,
    WelcomeStepHandler,
    LanguageTimezoneStepHandler,
    ProfileBasicsStepHandler,
    PreferencesStepHandler,
    ConsentStepHandler,
    FeatureTourStepHandler,
    SubscriptionCheckStepHandler,
    GenericStepHandler,
)
from apps.accounts.services.onboarding import OnboardingFlowService


class TestPhase11StepHandlers(unittest.TestCase):
    """
    اختبارات معالجات الخطوات السبع (Step Handlers Unit Tests).
    """

    def setUp(self):
        self.user = MagicMock()
        self.user.id = "user-1234-uuid"
        self.user.username = "tariq"
        self.user.lounge_id = "LU-00045"
        self.user.full_name = "Tariq Ali"
        self.user.email = "tariq@example.com"
        self.user.phone = "+966500000000"
        self.user.language = "ar"
        self.user.timezone = "Asia/Riyadh"
        self.user.tenant = None

        self.context = {
            'ip_address': '192.168.1.50',
            'user_agent': 'SmartLoungeApp/1.0',
        }

    def test_step_handler_registry_retrieval(self):
        """التحقق من أن السجل يحتوي على جميع المعالجات المحددة ويسند GenericStepHandler لأي مفتاح غير مسجل"""
        self.assertIsInstance(StepHandlerRegistry.get("welcome"), WelcomeStepHandler)
        self.assertIsInstance(StepHandlerRegistry.get("language_timezone"), LanguageTimezoneStepHandler)
        self.assertIsInstance(StepHandlerRegistry.get("profile_basics"), ProfileBasicsStepHandler)
        self.assertIsInstance(StepHandlerRegistry.get("preferences"), PreferencesStepHandler)
        self.assertIsInstance(StepHandlerRegistry.get("consent"), ConsentStepHandler)
        self.assertIsInstance(StepHandlerRegistry.get("feature_tour"), FeatureTourStepHandler)
        self.assertIsInstance(StepHandlerRegistry.get("subscription_check"), SubscriptionCheckStepHandler)
        self.assertIsInstance(StepHandlerRegistry.get("unknown_custom_key"), GenericStepHandler)

    def test_welcome_step_handler(self):
        """خطوة الترحيب: استخراج التكوين وتطبيق التأثيرات"""
        handler = WelcomeStepHandler()
        template = MagicMock()
        template.config = {'banner_image': '/media/welcome.png'}
        
        cfg = handler.get_config(self.user, template)
        self.assertEqual(cfg['lounge_id'], "LU-00045")
        self.assertEqual(cfg['tenant_name'], "Smart Lounge")
        self.assertEqual(cfg['banner_image'], '/media/welcome.png')

        res = handler.apply(self.user, {}, self.context)
        self.assertEqual(res['lounge_id'], "LU-00045")
        self.assertIn('acknowledged_at', res)

    def test_language_timezone_step_handler_valid(self):
        """خطوة اللغة والمنطقة الزمنية: مدخلات صحيحة وتحديث التفضيلات"""
        handler = LanguageTimezoneStepHandler()
        data = {'language': 'en', 'timezone': 'UTC'}

        with patch('apps.accounts.models.UserPreferences.objects.get_or_create') as mock_prefs:
            pref_instance = MagicMock()
            mock_prefs.return_value = (pref_instance, True)

            handler.validate(self.user, data, self.context)
            res = handler.apply(self.user, data, self.context)

            self.assertEqual(res['language'], 'en')
            self.assertEqual(res['timezone'], 'UTC')
            self.assertEqual(self.user.language, 'en')
            self.assertEqual(self.user.timezone, 'UTC')

    def test_language_timezone_step_handler_invalid_lang(self):
        """خطوة اللغة والمنطقة الزمنية: لغة غير مدعومة ترفع OnboardingException"""
        handler = LanguageTimezoneStepHandler()
        data = {'language': 'fr_FR', 'timezone': 'UTC'}

        with self.assertRaises(OnboardingException) as ctx:
            handler.validate(self.user, data, self.context)
        self.assertIn("غير مدعومة", str(ctx.exception))

    def test_profile_basics_step_handler(self):
        """خطوة الملف الأساسي: التحقق والتطبيق وحساب نسبة إكمال الحقول"""
        handler = ProfileBasicsStepHandler()
        data = {
            'full_name': 'Tariq Al-Mansoor',
            'email': 'tariq.new@example.com',
            'phone': '+966555123456',
            'city': 'Riyadh'
        }

        with patch('apps.accounts.models.UserProfileCompletion.objects.get_or_create') as mock_comp:
            comp_instance = MagicMock()
            mock_comp.return_value = (comp_instance, True)

            handler.validate(self.user, data, self.context)
            res = handler.apply(self.user, data, self.context)

            self.assertEqual(res['full_name'], 'Tariq Al-Mansoor')
            self.assertEqual(self.user.full_name, 'Tariq Al-Mansoor')
            self.assertIn('profile_completion_percentage', res)

    def test_preferences_step_handler(self):
        """خطوة التفضيلات: حفظ اختيارات المظهر والترجمة وتوفير البيانات"""
        handler = PreferencesStepHandler()
        data = {
            'theme': 'DARK',
            'preferred_genres': ['ACTION', 'SCIFI'],
            'notifications_enabled': True,
            'reduce_data_usage': True,
        }

        with patch('apps.accounts.models.UserPreferences.objects.get_or_create') as mock_prefs, \
             patch('apps.accounts.models.UserProfileCompletion.objects.get_or_create') as mock_comp:
            mock_prefs.return_value = (MagicMock(), True)
            mock_comp.return_value = (MagicMock(), True)

            handler.validate(self.user, data, self.context)
            res = handler.apply(self.user, data, self.context)

            self.assertEqual(res['theme'], 'DARK')
            self.assertEqual(res['genres_count'], 2)

    def test_consent_step_handler_success(self):
        """خطوة الموافقات: قبول الشروط والخصوصية مع التحقق من توثيق الموافقات"""
        handler = ConsentStepHandler()
        data = {
            'consents': {
                'TERMS_OF_SERVICE': True,
                'PRIVACY_POLICY': True,
                'MARKETING': False,
            }
        }

        with patch('apps.accounts.models.UserConsent.objects.update_or_create', return_value=(MagicMock(), True)) as mock_consent, \
             patch('apps.accounts.models.AuditLog.objects.create') as mock_audit:
            
            handler.validate(self.user, data, self.context)
            res = handler.apply(self.user, data, self.context)

            self.assertIn('consents_recorded', res)
            self.assertEqual(len(res['consents_recorded']), 3)

            # التأكد من استدعاء حفظ الموافقات لكل نوع
            self.assertEqual(mock_consent.call_count, 3)
            # التأكد من توثيق الحدث في سجل التدقيق للموافقات المقبولة (Terms + Privacy)
            self.assertEqual(mock_audit.call_count, 2)

    def test_consent_step_handler_missing_terms(self):
        """خطوة الموافقات: رفض أو عدم قبول الشروط يرفع TermsNotAccepted"""
        handler = ConsentStepHandler()
        data = {
            'consents': {
                'TERMS_OF_SERVICE': False,
                'PRIVACY_POLICY': True,
            }
        }

        with self.assertRaises(TermsNotAccepted):
            handler.validate(self.user, data, self.context)

    def test_consent_step_handler_missing_privacy(self):
        """خطوة الموافقات: عدم قبول سياسة الخصوصية يرفع PrivacyNotAccepted"""
        handler = ConsentStepHandler()
        data = {
            'consents': {
                'TERMS_OF_SERVICE': True,
                'PRIVACY_POLICY': False,
            }
        }

        with self.assertRaises(PrivacyNotAccepted):
            handler.validate(self.user, data, self.context)

    def test_feature_tour_step_handler(self):
        """خطوة جولة المميزات: تسجيل عدد الشرائح المعروضة وحفظ الحالة"""
        handler = FeatureTourStepHandler()
        data = {'slides_viewed': ['slide_1', 'slide_2', 'slide_3']}

        handler.validate(self.user, data, self.context)
        res = handler.apply(self.user, data, self.context)
        self.assertTrue(res['tour_completed'])
        self.assertEqual(res['slides_viewed_count'], 3)

    def test_subscription_check_step_handler(self):
        """خطوة التحقق من الاشتراك: خيار الباقة أو المتابعة المجانية"""
        handler = SubscriptionCheckStepHandler()
        data = {'selected_plan_id': 'premium_monthly', 'action': 'select_plan'}

        handler.validate(self.user, data, self.context)
        res = handler.apply(self.user, data, self.context)
        self.assertEqual(res['selected_plan_id'], 'premium_monthly')
        self.assertEqual(res['action'], 'select_plan')


class TestPhase11FlowEngine(unittest.TestCase):
    """
    اختبارات محرك تدفق التهيئة ومسار الحالات (OnboardingFlowService State Machine).
    """

    def setUp(self):
        self.user = MagicMock()
        self.user.id = "user-1234-uuid"
        self.user.username = "tariq"
        self.user.lounge_id = "LU-00045"
        self.user.tenant = None

        self.context = {'ip_address': '127.0.0.1', 'user_agent': 'pytest'}

    @patch('apps.accounts.models.OnboardingState.objects.get_or_create')
    @patch('apps.accounts.models.AuditLog.objects.create')
    @patch.object(OnboardingFlowService, '_get_first_step')
    def test_start_onboarding_new_state(self, mock_first_step, mock_audit, mock_get_or_create):
        """بدء مسار التهيئة لمستخدم جديد وتحديث الحالة وسجل التدقيق"""
        state = MagicMock()
        state.status = 'IN_PROGRESS'
        state.completed_steps = []
        state.skipped_steps = []
        state.step_data = {}
        state.current_step = 'welcome'
        state.onboarding_version = 'v1.0'
        mock_get_or_create.return_value = (state, True)

        t1 = MagicMock()
        t1.step_key = 'welcome'
        mock_first_step.return_value = t1

        res_state = OnboardingFlowService.start_onboarding(self.user, source='HOTSPOT', context=self.context)

        self.assertEqual(res_state.status, 'IN_PROGRESS')
        self.assertEqual(res_state.current_step, 'welcome')
        mock_audit.assert_called_once()

    @patch('apps.accounts.models.OnboardingState.objects.get_or_create')
    @patch.object(OnboardingFlowService, '_get_step')
    def test_complete_step_with_dependency_check(self, mock_get_step, mock_get_or_create):
        """التحقق من فرض التبعيات (Step Dependencies) ومنع إكمال خطوة قبل تبعياتها"""
        state = MagicMock()
        state.status = 'IN_PROGRESS'
        state.completed_steps = []
        state.skipped_steps = []
        state.step_data = {}
        mock_get_or_create.return_value = (state, False)

        t_lang = MagicMock()
        t_lang.step_key = 'language_timezone'
        t_lang.depends_on = ['welcome']
        mock_get_step.return_value = t_lang

        with self.assertRaises(StepDependencyMissing) as ctx:
            OnboardingFlowService.complete_step(
                self.user,
                step_key='language_timezone',
                data={'language': 'en'},
                context=self.context
            )
        self.assertIn("welcome", str(ctx.exception))

    @patch('apps.accounts.models.OnboardingState.objects.get_or_create')
    @patch.object(OnboardingFlowService, '_get_step')
    def test_skip_step_not_skippable_raises_error(self, mock_get_step, mock_get_or_create):
        """محاولة تخطي خطوة غير قابلة للتخطي يرفع StepNotSkippable"""
        state = MagicMock()
        state.status = 'IN_PROGRESS'
        state.completed_steps = []
        state.skipped_steps = []
        state.step_data = {}
        mock_get_or_create.return_value = (state, False)

        t_consent = MagicMock()
        t_consent.step_key = 'consent'
        t_consent.is_skippable = False
        mock_get_step.return_value = t_consent

        with self.assertRaises(StepNotSkippable):
            OnboardingFlowService.skip_step(
                self.user,
                step_key='consent',
                reason='no time',
                context=self.context
            )

    @patch('apps.accounts.models.OnboardingState.objects.get_or_create')
    @patch('apps.accounts.models.AuditLog.objects.create')
    @patch.object(OnboardingFlowService, '_get_all_steps')
    def test_complete_onboarding_successfully(self, mock_all_steps, mock_audit, mock_get_or_create):
        """إنهاء مسار التهيئة بنجاح بعد استيفاء جميع الخطوات الإلزامية"""
        state = MagicMock()
        state.status = 'IN_PROGRESS'
        state.completed_steps = ['welcome', 'consent']
        state.skipped_steps = []
        mock_get_or_create.return_value = (state, False)

        t1 = MagicMock()
        t1.step_key = 'welcome'
        t1.is_required = True

        t2 = MagicMock()
        t2.step_key = 'consent'
        t2.is_required = True

        mock_all_steps.return_value = [t1, t2]

        res = OnboardingFlowService.complete_onboarding(self.user, force=False, context=self.context)
        self.assertEqual(res.status, 'COMPLETED')
        self.assertIsNotNone(res.completed_at)
        mock_audit.assert_called_once()

    @patch('apps.accounts.models.OnboardingState.objects.get_or_create')
    @patch.object(OnboardingFlowService, '_get_all_steps')
    def test_complete_onboarding_missing_required_raises_error(self, mock_all_steps, mock_get_or_create):
        """إنهاء التهيئة عند وجود خطوات إلزامية ناقصة يرفع OnboardingIncomplete"""
        state = MagicMock()
        state.status = 'IN_PROGRESS'
        state.completed_steps = ['welcome']
        state.skipped_steps = []
        mock_get_or_create.return_value = (state, False)

        t1 = MagicMock()
        t1.step_key = 'welcome'
        t1.is_required = True

        t2 = MagicMock()
        t2.step_key = 'consent'
        t2.is_required = True

        mock_all_steps.return_value = [t1, t2]

        with self.assertRaises(OnboardingIncomplete) as ctx:
            OnboardingFlowService.complete_onboarding(self.user, force=False, context=self.context)
        self.assertIn("consent", str(ctx.exception))


if __name__ == '__main__':
    unittest.main()
