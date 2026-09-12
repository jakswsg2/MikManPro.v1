import logging
from decimal import Decimal
from typing import Dict, Any

from django.db.models import Count, Avg, F, ExpressionWrapper, fields
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import (
    User,
    OnboardingState,
    OnboardingStepTemplate,
    UserPreferences,
    UserProfileCompletion,
    UserConsent,
    AuditLog,
)
from apps.accounts.services import (
    OnboardingFlowService,
    OnboardingException,
    StepNotFound,
    StepNotSkippable,
    StepDependencyMissing,
    OnboardingIncomplete,
    TermsNotAccepted,
    PrivacyNotAccepted,
)
from apps.api.permissions import IsLoungeAdmin
from apps.api.onboarding_serializers import (
    OnboardingStepTemplateSerializer,
    StepTemplateReorderSerializer,
    OnboardingStepDetailSerializer,
    OnboardingStateSerializer,
    OnboardingFlowStatusSerializer,
    StartOnboardingSerializer,
    CompleteStepSerializer,
    SkipStepSerializer,
    UserPreferencesSerializer,
    UserProfileCompletionSerializer,
    UserConsentSerializer,
    RevokeConsentSerializer,
    OnboardingAnalyticsSerializer,
)

logger = logging.getLogger(__name__)


def _extract_request_context(request) -> Dict[str, Any]:
    """استخراج معلومات البيئة والعميل لسجلات التدقيق"""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        ip = x_forwarded.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')

    ua = request.META.get('HTTP_USER_AGENT', '')
    return {
        'ip_address': ip,
        'user_agent': ua,
    }


# ===========================================================================
# User Onboarding Flow Views
# ===========================================================================

class OnboardingStatusView(APIView):
    """
    GET /api/onboarding/status/
    استرجاع الحالة الشاملة لمسار التهيئة والإعداد للمستخدم الحالي.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        flow_status = OnboardingFlowService.get_flow_status(request.user)
        serializer = OnboardingFlowStatusSerializer(flow_status)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OnboardingStartView(APIView):
    """
    POST /api/onboarding/start/
    بدء أو إعادة تهيئة مسار الإعداد للمستخدم.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        input_serializer = StartOnboardingSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        source = input_serializer.validated_data.get('source', OnboardingState.Source.HOTSPOT)
        custom_context = input_serializer.validated_data.get('context', {})
        context = _extract_request_context(request)
        context.update(custom_context)

        OnboardingFlowService.start_onboarding(
            user=request.user,
            source=source,
            context=context
        )

        flow_status = OnboardingFlowService.get_flow_status(request.user)
        serializer = OnboardingFlowStatusSerializer(flow_status)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OnboardingStepDetailView(APIView):
    """
    GET /api/onboarding/step/<str:step_key>/
    استرجاع تفاصيل وإعدادات خطوة معينة في المسار.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, step_key: str):
        try:
            detail = OnboardingFlowService.get_step_detail(request.user, step_key)
            serializer = OnboardingStepDetailSerializer(detail)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except StepNotFound as e:
            return Response(
                {"detail": str(e), "code": "STEP_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND
            )


class OnboardingStepCompleteView(APIView):
    """
    POST /api/onboarding/step/<str:step_key>/complete/
    إكمال خطوة معينة وحفظ بياناتها وتطبيق تأثيراتها ثم الانتقال للخطوة التالية.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, step_key: str):
        input_serializer = CompleteStepSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        data = input_serializer.validated_data.get('data', {})
        custom_context = input_serializer.validated_data.get('context', {})
        context = _extract_request_context(request)
        context.update(custom_context)

        try:
            OnboardingFlowService.complete_step(
                user=request.user,
                step_key=step_key,
                data=data,
                context=context
            )
            flow_status = OnboardingFlowService.get_flow_status(request.user)
            serializer = OnboardingFlowStatusSerializer(flow_status)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except TermsNotAccepted as e:
            return Response(
                {"detail": str(e), "code": "TERMS_NOT_ACCEPTED"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except PrivacyNotAccepted as e:
            return Response(
                {"detail": str(e), "code": "PRIVACY_NOT_ACCEPTED"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except StepDependencyMissing as e:
            return Response(
                {"detail": str(e), "code": "DEPENDENCY_MISSING"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except StepNotFound as e:
            return Response(
                {"detail": str(e), "code": "STEP_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND
            )
        except OnboardingException as e:
            return Response(
                {"detail": str(e), "code": "ONBOARDING_ERROR"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.exception("Unexpected error completing onboarding step %s", step_key)
            return Response(
                {"detail": "حدث خطأ غير متوقع أثناء معالجة الخطوة.", "code": "SERVER_ERROR"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OnboardingStepSkipView(APIView):
    """
    POST /api/onboarding/step/<str:step_key>/skip/
    تخطي خطوة غير إلزامية في مسار التهيئة.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, step_key: str):
        input_serializer = SkipStepSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        reason = input_serializer.validated_data.get('reason', '')
        context = _extract_request_context(request)

        try:
            OnboardingFlowService.skip_step(
                user=request.user,
                step_key=step_key,
                reason=reason,
                context=context
            )
            flow_status = OnboardingFlowService.get_flow_status(request.user)
            serializer = OnboardingFlowStatusSerializer(flow_status)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except StepNotSkippable as e:
            return Response(
                {"detail": str(e), "code": "STEP_NOT_SKIPPABLE"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except StepNotFound as e:
            return Response(
                {"detail": str(e), "code": "STEP_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND
            )
        except OnboardingException as e:
            return Response(
                {"detail": str(e), "code": "ONBOARDING_ERROR"},
                status=status.HTTP_400_BAD_REQUEST
            )


class OnboardingResumeView(APIView):
    """
    POST /api/onboarding/resume/
    استئناف المسار من آخر خطوة غير مكتملة بعد انقطاع الاتصال.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        OnboardingFlowService.resume_onboarding(request.user)
        flow_status = OnboardingFlowService.get_flow_status(request.user)
        serializer = OnboardingFlowStatusSerializer(flow_status)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OnboardingCompleteView(APIView):
    """
    POST /api/onboarding/finish/
    إنهاء مسار التهيئة بالكامل بعد التحقق من استيفاء جميع الشروط الإلزامية.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        context = _extract_request_context(request)
        try:
            OnboardingFlowService.complete_onboarding(
                user=request.user,
                force=False,
                context=context
            )
            flow_status = OnboardingFlowService.get_flow_status(request.user)
            serializer = OnboardingFlowStatusSerializer(flow_status)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except OnboardingIncomplete as e:
            return Response(
                {"detail": str(e), "code": "ONBOARDING_INCOMPLETE"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except OnboardingException as e:
            return Response(
                {"detail": str(e), "code": "ONBOARDING_ERROR"},
                status=status.HTTP_400_BAD_REQUEST
            )


# ===========================================================================
# User Preferences & Extended Profile Views
# ===========================================================================

class MyPreferencesView(APIView):
    """
    GET, PUT, PATCH /api/me/preferences/
    عرض وتحديث التفضيلات العامة للمستخدم (المظهر، اللغة، الترجمة، الإشعارات).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(
            user=request.user,
            defaults={'tenant': request.user.tenant}
        )
        serializer = UserPreferencesSerializer(prefs)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(
            user=request.user,
            defaults={'tenant': request.user.tenant}
        )
        serializer = UserPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # مزامنة اللغة والمنطقة الزمنية على نموذج المستخدم الأساسي إذا تم تعديلها
        user_update_fields = []
        if 'language' in serializer.validated_data:
            request.user.language = serializer.validated_data['language']
            user_update_fields.append('language')
        if 'timezone' in serializer.validated_data:
            request.user.timezone = serializer.validated_data['timezone']
            user_update_fields.append('timezone')

        if user_update_fields:
            user_update_fields.append('updated_at')
            request.user.save(update_fields=user_update_fields)

        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)


class MyProfileCompletionView(APIView):
    """
    GET, PATCH /api/me/profile-completion/
    عرض وتحديث بيانات إكمال الملف الشخصي والتفضيلات الترفيهية.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile_comp, _ = UserProfileCompletion.objects.get_or_create(
            user=request.user,
            defaults={
                'tenant': request.user.tenant,
                'full_name': request.user.full_name,
                'display_name': request.user.full_name or request.user.username,
                'email': request.user.email,
                'phone': request.user.phone,
            }
        )
        serializer = UserProfileCompletionSerializer(profile_comp)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile_comp, _ = UserProfileCompletion.objects.get_or_create(
            user=request.user,
            defaults={'tenant': request.user.tenant}
        )
        serializer = UserProfileCompletionSerializer(profile_comp, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        # إعادة حساب مؤشرات الإكمال
        fields_completed = {}
        for f in ['full_name', 'display_name', 'phone', 'email', 'city', 'birth_date', 'gender']:
            val = getattr(instance, f, None)
            fields_completed[f] = bool(val)

        instance.completion_fields = fields_completed
        filled_count = sum(1 for v in fields_completed.values() if v)
        instance.completion_percentage = (Decimal(filled_count) / Decimal(len(fields_completed))) * Decimal('100.00')
        instance.is_optional_complete = filled_count >= 3
        if instance.is_optional_complete and not instance.completed_at:
            instance.completed_at = timezone.now()

        instance.save(update_fields=['completion_fields', 'completion_percentage', 'is_optional_complete', 'completed_at'])

        # مزامنة الاسم والبريد والهاتف الأساسي
        user_updates = []
        if instance.full_name and instance.full_name != request.user.full_name:
            request.user.full_name = instance.full_name
            user_updates.append('full_name')
        if instance.email and not request.user.email:
            request.user.email = instance.email
            user_updates.append('email')
        if instance.phone and not request.user.phone:
            request.user.phone = instance.phone
            user_updates.append('phone')

        if user_updates:
            user_updates.append('updated_at')
            request.user.save(update_fields=user_updates)

        return Response(UserProfileCompletionSerializer(instance).data, status=status.HTTP_200_OK)


class MyConsentsView(APIView):
    """
    GET /api/me/consents/
    سرد كافة الموافقات القانونية الممنوحة والملغاة للمستخدم مع بصمات التوقيع.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        consents = UserConsent.objects.filter(user=request.user).order_by('-created_at')
        serializer = UserConsentSerializer(consents, many=True)
        return Response({'results': serializer.data, 'count': consents.count()})


class ConsentRevokeView(APIView):
    """
    POST /api/me/consents/<str:consent_type>/revoke/
    إلغاء موافقة قانونية مع توثيق السبب والحدث في سجل التدقيق الأمني.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, consent_type: str):
        serializer = RevokeConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['reason']

        consent = UserConsent.objects.filter(
            user=request.user,
            consent_type=consent_type,
            granted=True
        ).first()

        if not consent:
            return Response(
                {"detail": "الموافقة المحددة غير موجودة أو ملغاة بالفعل.", "code": "CONSENT_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND
            )

        # التحقق إن كانت الموافقة إلزامية للشروط الأساسية
        if consent_type in ['TERMS_OF_SERVICE', 'PRIVACY_POLICY']:
            return Response(
                {"detail": "لا يمكن إلغاء شروط الخدمة أو سياسة الخصوصية أثناء استمرار تفعيل الحساب.", "code": "CANNOT_REVOKE_MANDATORY"},
                status=status.HTTP_400_BAD_REQUEST
            )

        context = _extract_request_context(request)
        consent.granted = False
        consent.revoked_at = timezone.now()
        consent.revoked_reason = reason
        consent.save(update_fields=['granted', 'revoked_at', 'revoked_reason', 'updated_at'])

        # تسجيل الحدث الأمني
        AuditLog.objects.create(
            event_type=AuditLog.EventType.CONSENT_REVOKED,
            user=request.user,
            external_identity_ref=request.user.lounge_id,
            ip_address=context.get('ip_address'),
            user_agent=context.get('user_agent', ''),
            details={
                'consent_type': consent_type,
                'version': consent.consent_version,
                'reason': reason,
            }
        )

        return Response(UserConsentSerializer(consent).data, status=status.HTTP_200_OK)


# ===========================================================================
# Admin Management & Analytics Views
# ===========================================================================

class AdminOnboardingStepTemplateViewSet(viewsets.ModelViewSet):
    """
    إدارة قوالب خطوات مسار التهيئة والإعداد (Step Templates CRUD).
    متاحة للمشرفين والمسؤولين (IsLoungeAdmin).
    """
    permission_classes = [IsLoungeAdmin]
    serializer_class = OnboardingStepTemplateSerializer

    def get_queryset(self):
        user = self.request.user
        qs = OnboardingStepTemplate.objects.all()

        # إذا كان مشرف مستأجر محدد
        if not user.is_superuser and user.tenant:
            qs = qs.filter(tenant=user.tenant)
        elif 'tenant_id' in self.request.query_params:
            tid = self.request.query_params.get('tenant_id')
            if tid == 'global':
                qs = qs.filter(tenant__isnull=True)
            else:
                qs = qs.filter(tenant_id=tid)

        step_type = self.request.query_params.get('step_type')
        if step_type:
            qs = qs.filter(step_type=step_type)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])

        return qs.order_by('order', 'created_at')

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """إعادة ترتيب تسلسل الخطوات دفعة واحدة"""
        serializer = StepTemplateReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data['items']
        updated_count = 0
        for item in items:
            updated = OnboardingStepTemplate.objects.filter(id=item['id']).update(order=item['order'])
            updated_count += updated

        return Response({"reordered_count": updated_count, "status": "success"}, status=status.HTTP_200_OK)


class AdminOnboardingAnalyticsView(APIView):
    """
    GET /api/admin/onboarding/analytics/
    تحليلات مسار الإعداد والتهيئة للمستأجر (معدل الإنجاز، التسرب Drop-off، المدة).
    """
    permission_classes = [IsLoungeAdmin]

    def get(self, request):
        user = self.request.user
        tenant = user.tenant if not user.is_superuser else None

        tenant_id = request.query_params.get('tenant_id')
        if user.is_superuser and tenant_id:
            tenant_id = tenant_id
        elif tenant:
            tenant_id = tenant.id
        else:
            tenant_id = None

        states_qs = OnboardingState.objects.all()
        if tenant_id:
            states_qs = states_qs.filter(tenant_id=tenant_id)

        total_users = states_qs.count()
        status_counts = dict(
            states_qs.values_list('status').annotate(c=Count('status'))
        )

        completed = status_counts.get(OnboardingState.Status.COMPLETED, 0)
        in_progress = status_counts.get(OnboardingState.Status.IN_PROGRESS, 0)
        not_started = status_counts.get(OnboardingState.Status.NOT_STARTED, 0)
        skipped = status_counts.get(OnboardingState.Status.SKIPPED, 0)
        first_login = states_qs.filter(is_first_login=True).count()

        completion_rate = (completed / total_users * 100.0) if total_users > 0 else 0.0

        # احتساب متوسط مدة الإكمال بالدقائق
        completed_states = states_qs.filter(
            status=OnboardingState.Status.COMPLETED,
            started_at__isnull=False,
            completed_at__isnull=False
        )
        avg_minutes = None
        if completed_states.exists():
            durations = [
                (s.completed_at - s.started_at).total_seconds() / 60.0
                for s in completed_states[:500]
            ]
            if durations:
                avg_minutes = round(sum(durations) / len(durations), 2)

        # تحليل نقاط التسرب (Drop-off by current step)
        drop_offs = dict(
            states_qs.filter(status=OnboardingState.Status.IN_PROGRESS)
            .values_list('current_step')
            .annotate(c=Count('current_step'))
        )

        payload = {
            'total_users': total_users,
            'completed_count': completed,
            'in_progress_count': in_progress,
            'not_started_count': not_started,
            'skipped_count': skipped,
            'completion_rate_percentage': round(completion_rate, 2),
            'avg_duration_minutes': avg_minutes,
            'drop_off_by_step': drop_offs,
            'first_login_count': first_login,
        }

        serializer = OnboardingAnalyticsSerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)
