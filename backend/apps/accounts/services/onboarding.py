import logging
import hashlib
from decimal import Decimal
from typing import Optional, Dict, Any, List

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import (
    User,
    OnboardingState,
    OnboardingStepTemplate,
    UserPreferences,
    UserProfileCompletion,
    UserConsent,
    AuditLog,
)

from apps.accounts.services.exceptions import (
    OnboardingException,
    StepNotFound,
    StepNotSkippable,
    StepDependencyMissing,
    OnboardingIncomplete,
    TermsNotAccepted,
    PrivacyNotAccepted,
)
from apps.accounts.services.handlers import StepHandlerRegistry

logger = logging.getLogger(__name__)


# Re-export exceptions for backwards compatibility
__all__ = [
    'OnboardingException',
    'StepNotFound',
    'StepNotSkippable',
    'StepDependencyMissing',
    'OnboardingIncomplete',
    'TermsNotAccepted',
    'PrivacyNotAccepted',
    'OnboardingFlowService',
]


# ---------------------------------------------------------------------------
# Onboarding Flow Service (Core Engine)
# ---------------------------------------------------------------------------

class OnboardingFlowService:
    """
    خدمة إدارة مسار التهيئة والإعداد الأولي للمستخدم (Onboarding Flow Engine)
    - إدارة دورة حياة التهيئة (Start, Complete Step, Skip Step, Resume, Complete Flow).
    - التحقق من شروط وتبعيات الخطوات (Step Dependencies).
    - التوثيق الأمني والقانوني (Audit Log & Consents).
    - حساب نسبة التقدم ديناميكياً ودعم تعدد المستأجرين (Multi-Tenancy).
    """

    DEFAULT_VERSION = 'v1.0'

    @classmethod
    def start_onboarding(
        cls,
        user: User,
        source: str = 'HOTSPOT',
        context: Optional[Dict[str, Any]] = None
    ) -> OnboardingState:
        """
        بدء أو استئناف مسار التهيئة للمستخدم.
        - ينشئ السجل في حال لم يكن موجوداً.
        - ينشئ التفضيلات الافتراضية وسجل إكمال الملف الشخصي.
        - يسجل حدث بدء التهيئة في سجل التدقيق الأمني.
        """
        context = context or {}
        now = timezone.now()

        with transaction.atomic():
            state, created = OnboardingState.objects.get_or_create(
                user=user,
                defaults={
                    'tenant': user.tenant,
                    'status': OnboardingState.OnboardingStatus.IN_PROGRESS,
                    'current_step': 'welcome',
                    'completed_steps': [],
                    'skipped_steps': [],
                    'step_data': {},
                    'started_at': now,
                    'last_step_at': now,
                    'onboarding_version': cls._get_version(),
                    'source': source,
                    'completion_percentage': Decimal('0.00'),
                }
            )

            # إنشاء النماذج التكميلية الافتراضية
            cls._create_defaults(user)

            if not created:
                if state.status == OnboardingState.OnboardingStatus.COMPLETED:
                    return state

                if state.status in [OnboardingState.OnboardingStatus.NOT_STARTED, OnboardingState.OnboardingStatus.SKIPPED]:
                    state.status = OnboardingState.OnboardingStatus.IN_PROGRESS

                state.last_step_at = now

            # تحديد الخطوة الأولى إن كانت الحالة فارغة
            first_step = cls._get_first_step(user)
            if first_step and (not state.current_step or state.current_step == 'welcome'):
                state.current_step = first_step.step_key

            state.completion_percentage = cls._calculate_progress(state, user)
            state.save()

            if created:
                AuditLog.objects.create(
                    event_type=AuditLog.EventType.ONBOARDING_STARTED,
                    user=user,
                    external_identity_ref=user.lounge_id,
                    ip_address=context.get('ip_address'),
                    user_agent=context.get('user_agent', ''),
                    details={
                        'lounge_id': user.lounge_id,
                        'source': source,
                        'initial_step': state.current_step,
                        'version': state.onboarding_version,
                    }
                )

        return state

    @classmethod
    def complete_step(
        cls,
        user: User,
        step_key: str,
        data: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> OnboardingState:
        """
        إكمال خطوة معينة في مسار التهيئة مع التحقق من صحتها ومن التبعيات السابقة.
        """
        context = context or {}
        data = data or {}
        now = timezone.now()

        with transaction.atomic():
            state, _ = OnboardingState.objects.get_or_create(
                user=user,
                defaults={'tenant': user.tenant, 'status': OnboardingState.OnboardingStatus.IN_PROGRESS}
            )

            # جلب قالب الخطوة
            step_template = cls._get_step(step_key, tenant=user.tenant)

            # التحقق من اكتمال التبعيات السابقة
            missing_deps = [
                dep for dep in step_template.depends_on
                if dep not in state.completed_steps
            ]
            if missing_deps:
                raise StepDependencyMissing(
                    f"الخطوة '{step_key}' تتطلب إكمال الخطوات السابقة أولاً: {', '.join(missing_deps)}"
                )

            # التحقق والتحقق من صحة بيانات الخطوة
            cls._validate_step(state, step_template, data, context)

            # تطبيق التأثيرات المباشرة لكل خطوة
            cls._apply_step_effects(user, step_key, data, context)

            # تحديث الخطوات المكتملة
            completed = list(state.completed_steps)
            if step_key not in completed:
                completed.append(step_key)
            state.completed_steps = completed

            # إزالة من المتخطاة إذا كان متخطياً لها سابقاً
            skipped = list(state.skipped_steps)
            if step_key in skipped:
                skipped.remove(step_key)
                state.skipped_steps = skipped

            # تخزين بيانات الخطوة
            step_data = dict(state.step_data)
            step_data[step_key] = data
            state.step_data = step_data
            state.last_step_at = now

            # تسجيل إكمال الخطوة في سجل التدقيق
            cls._track_step_completion(user, step_template, state, context)

            # الانتقال للخطوة التالية
            next_step = cls._get_next_step(state, user)
            if next_step is None:
                # لا توجد خطوات متبقية -> إكمال المسار
                return cls.complete_onboarding(user, force=False, context=context)
            else:
                state.current_step = next_step.step_key
                state.completion_percentage = cls._calculate_progress(state, user)
                state.save()

        return state

    @classmethod
    def skip_step(
        cls,
        user: User,
        step_key: str,
        reason: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> OnboardingState:
        """
        تخطي خطوة غير إلزامية في مسار التهيئة.
        """
        context = context or {}
        now = timezone.now()

        with transaction.atomic():
            state, _ = OnboardingState.objects.get_or_create(
                user=user,
                defaults={'tenant': user.tenant, 'status': OnboardingState.OnboardingStatus.IN_PROGRESS}
            )

            step_template = cls._get_step(step_key, tenant=user.tenant)

            if not step_template.is_skippable or step_template.is_required:
                raise StepNotSkippable(
                    f"الخطوة '{step_key}' إلزامية ولا يمكن للمستخدم تخطيها."
                )

            skipped = list(state.skipped_steps)
            if step_key not in skipped:
                skipped.append(step_key)
            state.skipped_steps = skipped

            if reason:
                step_data = dict(state.step_data)
                step_data[f"{step_key}_skip_reason"] = reason
                state.step_data = step_data

            state.last_step_at = now

            next_step = cls._get_next_step(state, user)
            if next_step is None:
                return cls.complete_onboarding(user, force=False, context=context)
            else:
                state.current_step = next_step.step_key
                state.completion_percentage = cls._calculate_progress(state, user)
                state.save()

        return state

    @classmethod
    def resume_onboarding(cls, user: User) -> OnboardingState:
        """
        استئناف مسار الإعداد للمستخدم من آخر خطوة غير مكتملة.
        """
        try:
            state = user.onboarding_state
        except OnboardingState.DoesNotExist:
            return cls.start_onboarding(user)

        if state.status == OnboardingState.OnboardingStatus.COMPLETED:
            return state

        if state.status == OnboardingState.OnboardingStatus.SKIPPED:
            state.status = OnboardingState.OnboardingStatus.IN_PROGRESS

        # التحقق من أن الخطوة الحالية تسمح بالاستئناف من عندها
        try:
            current_template = cls._get_step(state.current_step, tenant=user.tenant)
            if not current_template.can_resume_from:
                next_step = cls._get_next_step(state, user)
                if next_step:
                    state.current_step = next_step.step_key
        except StepNotFound:
            next_step = cls._get_next_step(state, user)
            if next_step:
                state.current_step = next_step.step_key

        state.last_step_at = timezone.now()
        state.completion_percentage = cls._calculate_progress(state, user)
        state.save(update_fields=['status', 'current_step', 'last_step_at', 'completion_percentage', 'updated_at'])
        return state

    @classmethod
    def complete_onboarding(
        cls,
        user: User,
        force: bool = False,
        context: Optional[Dict[str, Any]] = None
    ) -> OnboardingState:
        """
        إنهاء وإكمال مسار التهيئة بالكامل بعد التحقق من الخطوات الإلزامية.
        """
        context = context or {}
        now = timezone.now()

        with transaction.atomic():
            state, _ = OnboardingState.objects.get_or_create(
                user=user,
                defaults={'tenant': user.tenant}
            )

            if not force:
                required_steps = cls._get_required_steps(user)
                missing = [s for s in required_steps if s not in state.completed_steps]
                if missing:
                    raise OnboardingIncomplete(
                        f"لا يمكن إتمام التهيئة لوجود خطوات إلزامية متبقية: {', '.join(missing)}"
                    )

            state.status = OnboardingState.OnboardingStatus.COMPLETED
            state.completed_at = now
            state.completion_percentage = Decimal('100.00')
            state.is_first_login = False
            state.save()

            # إرسال ترحيب أو إشعار الإكمال
            cls._send_welcome_message(user)

            AuditLog.objects.create(
                event_type=AuditLog.EventType.ONBOARDING_COMPLETED,
                user=user,
                external_identity_ref=user.lounge_id,
                ip_address=context.get('ip_address'),
                user_agent=context.get('user_agent', ''),
                details={
                    'lounge_id': user.lounge_id,
                    'completed_steps': state.completed_steps,
                    'skipped_steps': state.skipped_steps,
                    'duration_sec': int((now - state.started_at).total_seconds()) if state.started_at else None,
                }
            )

        return state

    # -----------------------------------------------------------------------
    # Helper & Internal Methods
    # -----------------------------------------------------------------------

    @classmethod
    def _get_version(cls) -> str:
        return cls.DEFAULT_VERSION

    @classmethod
    def _create_defaults(cls, user: User) -> None:
        """إنشاء التفضيلات وسجل إكمال الملف للمستخدم إن لم تكن موجودة"""
        UserPreferences.objects.get_or_create(
            user=user,
            defaults={'tenant': user.tenant}
        )
        UserProfileCompletion.objects.get_or_create(
            user=user,
            defaults={
                'tenant': user.tenant,
                'full_name': user.full_name,
                'display_name': user.full_name or user.username,
                'email': user.email,
                'phone': user.phone,
            }
        )

    @classmethod
    def _get_all_steps(cls, user: User) -> List[OnboardingStepTemplate]:
        """
        جلب كافة قوالب الخطوات المتاحة للمستخدم (تخصيص المستأجر أولاً ثم العام)
        """
        tenant = user.tenant
        if tenant:
            tenant_steps = list(
                OnboardingStepTemplate.objects.filter(tenant=tenant, is_active=True).order_by('order', 'created_at')
            )
            if tenant_steps:
                return tenant_steps

        # Fallback to Global Steps (tenant is None)
        return list(
            OnboardingStepTemplate.objects.filter(tenant__isnull=True, is_active=True).order_by('order', 'created_at')
        )

    @classmethod
    def _get_step(cls, step_key: str, tenant=None) -> OnboardingStepTemplate:
        """البحث عن خطوة محددة مع التراجع إلى القالب العام"""
        if tenant:
            step = OnboardingStepTemplate.objects.filter(
                tenant=tenant, step_key=step_key, is_active=True
            ).first()
            if step:
                return step

        step = OnboardingStepTemplate.objects.filter(
            tenant__isnull=True, step_key=step_key, is_active=True
        ).first()

        if not step:
            raise StepNotFound(f"لم يتم العثور على خطوة الإعداد: '{step_key}'")

        return step

    @classmethod
    def _get_first_step(cls, user: User) -> Optional[OnboardingStepTemplate]:
        steps = cls._get_all_steps(user)
        return steps[0] if steps else None

    @classmethod
    def _get_next_step(cls, state: OnboardingState, user: User) -> Optional[OnboardingStepTemplate]:
        """تحديد الخطوة التالية في الترتيب التي لم تكتمل ولم يتم تخطيها"""
        all_steps = cls._get_all_steps(user)
        done_or_skipped = set(state.completed_steps).union(set(state.skipped_steps))

        for step in all_steps:
            if step.step_key not in done_or_skipped:
                return step

        return None

    @classmethod
    def _get_required_steps(cls, user: User) -> List[str]:
        """قائمة المفاتيح للخطوات الإلزامية"""
        all_steps = cls._get_all_steps(user)
        return [s.step_key for s in all_steps if s.is_required]

    @classmethod
    def _calculate_progress(cls, state: OnboardingState, user: User) -> Decimal:
        """حساب نسبة التقدم % بناءً على إجمالي الخطوات المكتملة أو المتخطاة"""
        all_steps = cls._get_all_steps(user)
        if not all_steps:
            return Decimal('100.00')

        done_count = len(set(state.completed_steps).union(set(state.skipped_steps)))
        percentage = min(Decimal('100.00'), (Decimal(done_count) / Decimal(len(all_steps))) * Decimal('100.00'))
        return percentage.quantize(Decimal('0.01'))

    @classmethod
    def _validate_step(
        cls,
        state: OnboardingState,
        step: OnboardingStepTemplate,
        data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> None:
        """التحقق من صحة مدخلات الخطوة عبر المعالج المخصص"""
        handler = StepHandlerRegistry.get_handler(step.step_key)
        handler.validate(state.user, data, context)

    @classmethod
    def _apply_step_effects(
        cls,
        user: User,
        step_key: str,
        data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """تطبيق التغييرات الفعلية وحفظ البيانات عبر المعالج المخصص"""
        handler = StepHandlerRegistry.get_handler(step_key)
        return handler.apply(user, data, context)

    @classmethod
    def get_step_detail(cls, user: User, step_key: str) -> Dict[str, Any]:
        """استخراج التفاصيل الكاملة والإعدادات الديناميكية لخطوة معينة"""
        step = cls._get_step(step_key, tenant=user.tenant)
        state, _ = OnboardingState.objects.get_or_create(
            user=user,
            defaults={'tenant': user.tenant, 'status': OnboardingState.OnboardingStatus.IN_PROGRESS}
        )

        handler = StepHandlerRegistry.get_handler(step_key)
        dynamic_config = handler.get_config(user, step)

        # تحديد حالة الخطوة بالنسبة للمستخدم
        if step_key in state.completed_steps:
            status = 'COMPLETED'
        elif step_key in state.skipped_steps:
            status = 'SKIPPED'
        elif state.current_step == step_key:
            status = 'CURRENT'
        else:
            missing_deps = [d for d in step.depends_on if d not in state.completed_steps]
            status = 'LOCKED' if missing_deps else 'AVAILABLE'

        return {
            'step_key': step.step_key,
            'display_name_ar': step.display_name_ar,
            'display_name_en': step.display_name_en,
            'description_ar': step.description_ar,
            'description_en': step.description_en,
            'icon': step.icon,
            'order': step.order,
            'is_required': step.is_required,
            'is_skippable': step.is_skippable,
            'can_resume_from': step.can_resume_from,
            'depends_on': step.depends_on,
            'status': status,
            'config': dynamic_config,
            'saved_data': state.step_data.get(step_key, {}),
        }

    @classmethod
    def get_flow_status(cls, user: User) -> Dict[str, Any]:
        """استعراض حالة المسار بالكامل وجميع الخطوات بالتفصيل"""
        state, _ = OnboardingState.objects.get_or_create(
            user=user,
            defaults={'tenant': user.tenant, 'status': OnboardingState.OnboardingStatus.IN_PROGRESS}
        )

        all_steps = cls._get_all_steps(user)
        steps_summary = []
        for s in all_steps:
            steps_summary.append(cls.get_step_detail(user, s.step_key))

        return {
            'lounge_id': user.lounge_id,
            'username': user.username,
            'status': state.status,
            'current_step': state.current_step,
            'completion_percentage': float(state.completion_percentage),
            'completed_steps': state.completed_steps,
            'skipped_steps': state.skipped_steps,
            'is_first_login': state.is_first_login,
            'started_at': state.started_at.isoformat() if state.started_at else None,
            'completed_at': state.completed_at.isoformat() if state.completed_at else None,
            'version': state.onboarding_version,
            'steps': steps_summary,
        }

    @classmethod
    def _track_step_completion(
        cls,
        user: User,
        step: OnboardingStepTemplate,
        state: OnboardingState,
        context: Dict[str, Any]
    ) -> None:
        """تسجيل اكتمال الخطوة في سجل التدقيق الأمني"""
        AuditLog.objects.create(
            event_type=AuditLog.EventType.ONBOARDING_STEP_COMPLETED,
            user=user,
            external_identity_ref=user.lounge_id,
            ip_address=context.get('ip_address'),
            user_agent=context.get('user_agent', ''),
            details={
                'lounge_id': user.lounge_id,
                'step_key': step.step_key,
                'step_order': step.order,
                'step_name_ar': step.display_name_ar,
                'progress_percentage': str(state.completion_percentage),
            }
        )

    @classmethod
    def _send_welcome_message(cls, user: User) -> None:
        """إرسال إشعار الترحيب الأولي للمستخدم بعد إتمام مسار التهيئة"""
        logger.info(f"Onboarding completed successfully for user {user.username} ({user.lounge_id})")
