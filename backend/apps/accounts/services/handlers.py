import hashlib
import logging
from typing import Dict, Any, Optional, Type
from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

from apps.accounts.models import (
    User,
    OnboardingStepTemplate,
    UserPreferences,
    UserProfileCompletion,
    UserConsent,
    AuditLog,
)
from apps.accounts.services.exceptions import (
    StepNotFound,
    StepNotSkippable,
    TermsNotAccepted,
    PrivacyNotAccepted,
    OnboardingException,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Base Step Handler
# ---------------------------------------------------------------------------

class BaseStepHandler:
    """
    الفئة الأساسية لمعالجات خطوات مسار التهيئة (Step Handler Pattern).
    كل خطوة تحدد منطق التحقق (validate)، والتطبيق وحفظ البيانات (apply)،
    واستخراج التهيئات الخاصة بالواجهة (get_config).
    """
    step_key: str = "base"

    def validate(
        self,
        user: User,
        data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> None:
        """التحقق من صحة مدخلات الخطوة قبل المعالجة"""
        pass

    def apply(
        self,
        user: User,
        data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """تطبيق التأثيرات وحفظ البيانات وتحديث النماذج المعنية"""
        return {}

    def get_config(
        self,
        user: User,
        template: OnboardingStepTemplate
    ) -> Dict[str, Any]:
        """تجهيز إعدادات وبيانات الخطوة الموجهة لواجهة المستخدم"""
        return template.config or {}


# ---------------------------------------------------------------------------
# 1. Welcome Step Handler
# ---------------------------------------------------------------------------

class WelcomeStepHandler(BaseStepHandler):
    """
    معالج خطوة الترحيب الأولية (Welcome Step)
    - استعراض مزايا الاستراحة وشاشة البداية.
    """
    step_key = "welcome"

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        # خطوة إعلامية لا تتطلب شروطاً إلزامية، لكن تقبل تأكيد العرض
        pass

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "acknowledged_at": timezone.now().isoformat(),
            "lounge_id": user.lounge_id,
        }

    def get_config(self, user: User, template: OnboardingStepTemplate) -> Dict[str, Any]:
        cfg = dict(template.config or {})
        cfg.update({
            "lounge_id": user.lounge_id,
            "username": user.username,
            "full_name": user.full_name,
            "tenant_name": user.tenant.name if user.tenant else "Smart Lounge",
        })
        return cfg


# ---------------------------------------------------------------------------
# 2. Language & Timezone Step Handler
# ---------------------------------------------------------------------------

class LanguageTimezoneStepHandler(BaseStepHandler):
    """
    معالج خطوة اختيار اللغة والمنطقة الزمنية (Language & Timezone)
    - ضبط لغة العرض (ar/en) والمنطقة الزمنية لحساب المستخدم وتفضيلاته.
    """
    step_key = "language_timezone"

    SUPPORTED_LANGUAGES = ['ar', 'en']
    COMMON_TIMEZONES = [
        'Asia/Aden', 'Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo',
        'Europe/London', 'America/New_York', 'UTC'
    ]

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        lang = data.get("language")
        tz = data.get("timezone")

        if lang and lang not in self.SUPPORTED_LANGUAGES:
            raise OnboardingException(f"اللغة '{lang}' غير مدعومة. اللغات المتاحة: {', '.join(self.SUPPORTED_LANGUAGES)}")

        if tz and not isinstance(tz, str):
            raise OnboardingException("المنطقة الزمنية يجب أن تكون نصاً صحيحاً.")

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        lang = data.get("language", "ar")
        tz = data.get("timezone", "Asia/Aden")

        # تحديث بيانات المستخدم
        user.language = lang
        user.timezone = tz
        user.save(update_fields=['language', 'timezone', 'updated_at'])

        # تحديث التفضيلات
        prefs, _ = UserPreferences.objects.get_or_create(user=user, defaults={'tenant': user.tenant})
        prefs.language = lang
        prefs.timezone = tz
        prefs.save(update_fields=['language', 'timezone', 'updated_at'])

        return {"language": lang, "timezone": tz}

    def get_config(self, user: User, template: OnboardingStepTemplate) -> Dict[str, Any]:
        cfg = dict(template.config or {})
        cfg.update({
            "current_language": user.language or "ar",
            "current_timezone": user.timezone or "Asia/Aden",
            "available_languages": self.SUPPORTED_LANGUAGES,
            "recommended_timezones": self.COMMON_TIMEZONES,
        })
        return cfg


# ---------------------------------------------------------------------------
# 3. Profile Basics Step Handler
# ---------------------------------------------------------------------------

class ProfileBasicsStepHandler(BaseStepHandler):
    """
    معالج خطوة بيانات الملف الشخصي الأساسية (Profile Basics)
    - إدخال الاسم، رقم الهاتف، والبريد الإلكتروني بصورة اختيارية مرنة.
    """
    step_key = "profile_basics"

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        email = data.get("email")
        if email:
            try:
                validate_email(email)
            except ValidationError:
                raise OnboardingException("صيغة البريد الإلكتروني المدخلة غير صحيحة.")

        phone = data.get("phone")
        if phone and len(str(phone).strip()) > 30:
            raise OnboardingException("رقم الهاتف يتجاوز الحد الأقصى المسموح به.")

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        full_name = data.get("full_name", "").strip() or None
        display_name = data.get("display_name", "").strip() or None
        phone = data.get("phone", "").strip() or None
        email = data.get("email", "").strip() or None
        city = data.get("city", "").strip() or None

        user_update_fields = []
        if full_name:
            user.full_name = full_name
            user_update_fields.append('full_name')
        if phone and not user.phone:
            user.phone = phone
            user_update_fields.append('phone')
        if email and not user.email:
            user.email = email
            user_update_fields.append('email')

        if user_update_fields:
            user_update_fields.append('updated_at')
            user.save(update_fields=user_update_fields)

        # تحديث جدول إكمال الملف الشخصي
        profile_comp, _ = UserProfileCompletion.objects.get_or_create(user=user, defaults={'tenant': user.tenant})
        if full_name:
            profile_comp.full_name = full_name
        if display_name:
            profile_comp.display_name = display_name
        if phone:
            profile_comp.phone = phone
        if email:
            profile_comp.email = email
        if city:
            profile_comp.city = city

        # حساب مؤشر اكتمال الحقول
        fields_completed = {}
        for f in ['full_name', 'display_name', 'phone', 'email', 'city']:
            val = getattr(profile_comp, f, None)
            fields_completed[f] = bool(val)

        profile_comp.completion_fields = fields_completed
        filled_count = sum(1 for v in fields_completed.values() if v)
        profile_comp.completion_percentage = (filled_count / len(fields_completed)) * 100
        profile_comp.is_optional_complete = filled_count >= 3
        if profile_comp.is_optional_complete and not profile_comp.completed_at:
            profile_comp.completed_at = timezone.now()

        profile_comp.save()

        return {
            "full_name": full_name,
            "display_name": display_name,
            "profile_completion_percentage": float(profile_comp.completion_percentage)
        }

    def get_config(self, user: User, template: OnboardingStepTemplate) -> Dict[str, Any]:
        cfg = dict(template.config or {})
        cfg.update({
            "existing_full_name": user.full_name,
            "existing_phone": user.phone,
            "existing_email": user.email,
        })
        return cfg


# ---------------------------------------------------------------------------
# 4. Preferences Step Handler
# ---------------------------------------------------------------------------

class PreferencesStepHandler(BaseStepHandler):
    """
    معالج خطوة تفضيلات المحتوى والمظهر (Preferences)
    - التصنيفات المفضلة (Genres)، المظهر الداكن/الفاتح، وتخصيص البث.
    """
    step_key = "preferences"

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        genres = data.get("preferred_genres")
        if genres is not None and not isinstance(genres, list):
            raise OnboardingException("التصنيفات المفضلة يجب أن تكون قائمة.")

        theme = data.get("theme")
        if theme and theme not in ['LIGHT', 'DARK', 'AUTO']:
            raise OnboardingException("المظهر المحدد غير صحيح (LIGHT, DARK, AUTO).")

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        genres = data.get("preferred_genres", [])
        content_types = data.get("preferred_content_types", [])
        theme = data.get("theme", "DARK")
        notifications_enabled = data.get("notifications_enabled", True)
        reduce_data_usage = data.get("reduce_data_usage", False)

        prefs, _ = UserPreferences.objects.get_or_create(user=user, defaults={'tenant': user.tenant})
        prefs.theme = theme
        prefs.notifications_enabled = bool(notifications_enabled)
        prefs.reduce_data_usage = bool(reduce_data_usage)
        prefs.save(update_fields=['theme', 'notifications_enabled', 'reduce_data_usage', 'updated_at'])

        profile_comp, _ = UserProfileCompletion.objects.get_or_create(user=user, defaults={'tenant': user.tenant})
        profile_comp.preferred_genres = genres
        profile_comp.preferred_content_types = content_types
        profile_comp.save(update_fields=['preferred_genres', 'preferred_content_types', 'updated_at'])

        return {
            "theme": theme,
            "genres_count": len(genres),
            "content_types_count": len(content_types)
        }

    def get_config(self, user: User, template: OnboardingStepTemplate) -> Dict[str, Any]:
        cfg = dict(template.config or {})
        try:
            prefs = user.preferences
            cfg.update({
                "theme": prefs.theme,
                "notifications_enabled": prefs.notifications_enabled,
                "reduce_data_usage": prefs.reduce_data_usage,
            })
        except UserPreferences.DoesNotExist:
            pass
        return cfg


# ---------------------------------------------------------------------------
# 5. Consent Step Handler
# ---------------------------------------------------------------------------

class ConsentStepHandler(BaseStepHandler):
    """
    معالج خطوة الشروط القانونية والموافقات (Consent Step)
    - شروط الخدمة، سياسة الخصوصية، وبصمة التوقيع الرقمي المقاومة للتلاعب.
    """
    step_key = "consent"

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        consents = data.get("consents", {})
        terms_accepted = consents.get("TERMS_OF_SERVICE", False)
        privacy_accepted = consents.get("PRIVACY_POLICY", False)

        if not terms_accepted:
            raise TermsNotAccepted("يجب الموافقة الإلزامية على شروط الخدمة والاتفاقية لمتابعة الاستخدام.")

        if not privacy_accepted:
            raise PrivacyNotAccepted("يجب الموافقة الإلزامية على سياسة الخصوصية وحماية البيانات لمتابعة الاستخدام.")

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        consents = data.get("consents", {})
        versions = data.get("versions", {})
        ip = context.get("ip_address") or "127.0.0.1"
        ua = context.get("user_agent", "")
        now = timezone.now()

        recorded = []
        for consent_name, is_granted in consents.items():
            version = versions.get(consent_name, "v1.0")
            sig_raw = f"{user.id}:{consent_name}:{version}:{is_granted}:{ip}"
            sig_hash = hashlib.sha256(sig_raw.encode('utf-8')).hexdigest()

            consent_obj, _ = UserConsent.objects.update_or_create(
                user=user,
                consent_type=consent_name,
                consent_version=version,
                defaults={
                    'tenant': user.tenant,
                    'granted': bool(is_granted),
                    'granted_at': now if is_granted else None,
                    'revoked_at': None if is_granted else now,
                    'ip_address': ip,
                    'user_agent': ua,
                    'signature_hash': sig_hash,
                }
            )
            recorded.append(consent_name)

            if is_granted:
                AuditLog.objects.create(
                    event_type=AuditLog.EventType.CONSENT_GRANTED,
                    user=user,
                    external_identity_ref=user.lounge_id,
                    ip_address=ip,
                    user_agent=ua,
                    details={
                        'consent_type': consent_name,
                        'version': version,
                        'hash': sig_hash,
                    }
                )

        return {"consents_recorded": recorded}

    def get_config(self, user: User, template: OnboardingStepTemplate) -> Dict[str, Any]:
        cfg = dict(template.config or {})
        # تزويد الواجهة بالوثائق وتاريخ الإصدارات
        cfg.setdefault("required_consents", ["TERMS_OF_SERVICE", "PRIVACY_POLICY"])
        cfg.setdefault("optional_consents", ["DATA_PROCESSING", "MARKETING", "ANALYTICS"])
        cfg.setdefault("versions", {
            "TERMS_OF_SERVICE": "v2.1",
            "PRIVACY_POLICY": "v1.5",
            "DATA_PROCESSING": "v1.0",
        })
        return cfg


# ---------------------------------------------------------------------------
# 6. Feature Tour Step Handler
# ---------------------------------------------------------------------------

class FeatureTourStepHandler(BaseStepHandler):
    """
    معالج خطوة الجولة الاستكشافية للمزايا (Feature Tour)
    - استعراض شرائح التوجيه السريع، والتنقل بين أقسام المنصة.
    """
    step_key = "feature_tour"

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        pass

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        slides_viewed = data.get("slides_viewed", [])
        return {
            "tour_completed": True,
            "slides_viewed_count": len(slides_viewed)
        }

    def get_config(self, user: User, template: OnboardingStepTemplate) -> Dict[str, Any]:
        return dict(template.config or {})


# ---------------------------------------------------------------------------
# 7. Subscription Check Step Handler
# ---------------------------------------------------------------------------

class SubscriptionCheckStepHandler(BaseStepHandler):
    """
    معالج خطوة فحص وتوجيه الاشتراكات (Subscription Check)
    - توجيه المشترك للباقات المتاحة أو السماح بالدخول بالخطة المجانية.
    """
    step_key = "subscription_check"

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        action = data.get("action")
        valid_actions = ["skip", "view_plans", "free_tier", "select_plan"]
        if action and action not in valid_actions:
            raise OnboardingException(f"الإجراء '{action}' غير صالح للخطوة.")

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        action = data.get("action", "free_tier")
        plan_id = data.get("selected_plan_id")
        return {
            "action": action,
            "selected_plan_id": plan_id,
            "timestamp": timezone.now().isoformat(),
        }

    def get_config(self, user: User, template: OnboardingStepTemplate) -> Dict[str, Any]:
        cfg = dict(template.config or {})
        cfg.setdefault("allow_skip_to_free", True)
        cfg.setdefault("plans_url", "/billing/plans")
        return cfg


# ---------------------------------------------------------------------------
# Generic Fallback Step Handler
# ---------------------------------------------------------------------------

class GenericStepHandler(BaseStepHandler):
    """معالج احتياطي للخطوات المخصصة أو غير المعرفة مسبقاً"""
    def __init__(self, step_key: str):
        self.step_key = step_key

    def validate(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        pass

    def apply(self, user: User, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        return {"handled_by": "generic", "data_keys": list(data.keys())}


# ---------------------------------------------------------------------------
# Step Handler Registry
# ---------------------------------------------------------------------------

class StepHandlerRegistry:
    """
    سجل ومصنع معالجات الخطوات (Step Handler Registry / Factory).
    يربط مفاتيح الخطوات (step_key) بفئات المعالجة المطابقة.
    """
    _registry: Dict[str, BaseStepHandler] = {}

    @classmethod
    def register(cls, handler: BaseStepHandler) -> None:
        cls._registry[handler.step_key] = handler

    @classmethod
    def get_handler(cls, step_key: str) -> BaseStepHandler:
        handler = cls._registry.get(step_key)
        if not handler:
            return GenericStepHandler(step_key=step_key)
        return handler

    @classmethod
    def get(cls, step_key: str) -> BaseStepHandler:
        """Alias for get_handler"""
        return cls.get_handler(step_key)



# تسجيل المعالجات الافتراضية السبعة
StepHandlerRegistry.register(WelcomeStepHandler())
StepHandlerRegistry.register(LanguageTimezoneStepHandler())
StepHandlerRegistry.register(ProfileBasicsStepHandler())
StepHandlerRegistry.register(PreferencesStepHandler())
StepHandlerRegistry.register(ConsentStepHandler())
StepHandlerRegistry.register(FeatureTourStepHandler())
StepHandlerRegistry.register(SubscriptionCheckStepHandler())
