from decimal import Decimal
from rest_framework import serializers

from apps.accounts.models import (
    User,
    Tenant,
    OnboardingState,
    OnboardingStepTemplate,
    UserPreferences,
    UserProfileCompletion,
    UserConsent,
)


# ---------------------------------------------------------------------------
# Onboarding Step Template Serializer
# ---------------------------------------------------------------------------

class OnboardingStepTemplateSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, default=None)

    class Meta:
        model = OnboardingStepTemplate
        fields = [
            'id',
            'tenant',
            'tenant_name',
            'step_key',
            'display_name',
            'display_name_ar',
            'display_name_en',
            'description',
            'step_type',
            'order',
            'is_required',
            'is_skippable',
            'can_resume_from',
            'depends_on',
            'config',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_step_key(self, value):
        return value.strip().lower()


class StepTemplateReorderItemSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=True)
    order = serializers.IntegerField(required=True, min_value=0)


class StepTemplateReorderSerializer(serializers.Serializer):
    items = serializers.ListField(
        child=StepTemplateReorderItemSerializer(),
        allow_empty=False
    )


# ---------------------------------------------------------------------------
# Dynamic Step Detail Serializer
# ---------------------------------------------------------------------------

class OnboardingStepDetailSerializer(serializers.Serializer):
    step_key = serializers.CharField()
    display_name_ar = serializers.CharField()
    display_name_en = serializers.CharField()
    description_ar = serializers.CharField(allow_blank=True, required=False)
    description_en = serializers.CharField(allow_blank=True, required=False)
    icon = serializers.CharField(allow_blank=True, required=False)
    order = serializers.IntegerField()
    is_required = serializers.BooleanField()
    is_skippable = serializers.BooleanField()
    can_resume_from = serializers.BooleanField()
    depends_on = serializers.ListField(child=serializers.CharField(), default=list)
    status = serializers.CharField()  # COMPLETED, SKIPPED, CURRENT, AVAILABLE, LOCKED
    config = serializers.DictField(default=dict)
    saved_data = serializers.DictField(default=dict)


# ---------------------------------------------------------------------------
# Onboarding State Serializer
# ---------------------------------------------------------------------------

class OnboardingStateSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_lounge_id = serializers.CharField(source='user.lounge_id', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, default=None)

    class Meta:
        model = OnboardingState
        fields = [
            'id',
            'user',
            'user_username',
            'user_lounge_id',
            'tenant',
            'tenant_name',
            'status',
            'current_step',
            'completed_steps',
            'skipped_steps',
            'step_data',
            'started_at',
            'completed_at',
            'skipped_at',
            'last_step_at',
            'onboarding_version',
            'resume_url',
            'is_first_login',
            'source',
            'completion_percentage',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'tenant',
            'user_username',
            'user_lounge_id',
            'tenant_name',
            'started_at',
            'completed_at',
            'skipped_at',
            'last_step_at',
            'created_at',
        ]


# ---------------------------------------------------------------------------
# Flow Status Serializer
# ---------------------------------------------------------------------------

class OnboardingFlowStatusSerializer(serializers.Serializer):
    lounge_id = serializers.CharField()
    username = serializers.CharField()
    status = serializers.CharField()
    current_step = serializers.CharField()
    completion_percentage = serializers.FloatField()
    completed_steps = serializers.ListField(child=serializers.CharField())
    skipped_steps = serializers.ListField(child=serializers.CharField())
    is_first_login = serializers.BooleanField()
    started_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)
    version = serializers.CharField()
    steps = OnboardingStepDetailSerializer(many=True)


# ---------------------------------------------------------------------------
# Action Request Serializers
# ---------------------------------------------------------------------------

class StartOnboardingSerializer(serializers.Serializer):
    source = serializers.ChoiceField(
        choices=OnboardingState.Source.choices,
        default=OnboardingState.Source.HOTSPOT
    )
    context = serializers.DictField(required=False, default=dict)


class CompleteStepSerializer(serializers.Serializer):
    data = serializers.DictField(required=False, default=dict)
    context = serializers.DictField(required=False, default=dict)


class SkipStepSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


# ---------------------------------------------------------------------------
# User Preferences Serializer
# ---------------------------------------------------------------------------

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = [
            'id',
            'language',
            'timezone',
            'date_format',
            'time_format',
            'theme',
            'autoplay_next',
            'autoplay_preview',
            'default_quality',
            'subtitle_language',
            'audio_language',
            'subtitle_enabled',
            'subtitle_size',
            'notifications_enabled',
            'email_notifications',
            'push_notifications',
            'whatsapp_notifications',
            'marketing_emails',
            'content_maturity_rating',
            'reduce_motion',
            'reduce_data_usage',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']


# ---------------------------------------------------------------------------
# User Profile Completion Serializer
# ---------------------------------------------------------------------------

class UserProfileCompletionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    lounge_id = serializers.CharField(source='user.lounge_id', read_only=True)

    class Meta:
        model = UserProfileCompletion
        fields = [
            'id',
            'username',
            'lounge_id',
            'full_name',
            'display_name',
            'phone',
            'phone_verified',
            'email',
            'email_verified',
            'avatar_url',
            'birth_date',
            'gender',
            'country',
            'city',
            'preferred_genres',
            'preferred_content_types',
            'completion_fields',
            'completion_percentage',
            'is_optional_complete',
            'completed_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'username',
            'lounge_id',
            'phone_verified',
            'email_verified',
            'completion_fields',
            'completion_percentage',
            'is_optional_complete',
            'completed_at',
            'updated_at',
        ]


# ---------------------------------------------------------------------------
# User Consent Serializer
# ---------------------------------------------------------------------------

class UserConsentSerializer(serializers.ModelSerializer):
    consent_type_display = serializers.CharField(source='get_consent_type_display', read_only=True)

    class Meta:
        model = UserConsent
        fields = [
            'id',
            'consent_type',
            'consent_type_display',
            'consent_version',
            'granted',
            'granted_at',
            'revoked_at',
            'revoked_reason',
            'ip_address',
            'signature_hash',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'consent_type_display',
            'granted_at',
            'revoked_at',
            'ip_address',
            'signature_hash',
            'created_at',
            'updated_at',
        ]


class RevokeConsentSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, min_length=3, max_length=255)


# ---------------------------------------------------------------------------
# Analytics Serializer
# ---------------------------------------------------------------------------

class OnboardingAnalyticsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    completed_count = serializers.IntegerField()
    in_progress_count = serializers.IntegerField()
    not_started_count = serializers.IntegerField()
    skipped_count = serializers.IntegerField()
    completion_rate_percentage = serializers.FloatField()
    avg_duration_minutes = serializers.FloatField(allow_null=True)
    drop_off_by_step = serializers.DictField(child=serializers.IntegerField())
    first_login_count = serializers.IntegerField()
