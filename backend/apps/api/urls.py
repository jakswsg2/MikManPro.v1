from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    CurrentUserView, UserViewSet, ProfileViewSet,
    PermissionViewSet, MediaServerViewSet, LibraryViewSet,
    MediaItemViewSet,
    TenantViewSet, SiteViewSet,
    CaptivePortalLoginView, SSOExchangeView, CustomTokenRefreshView,
    SessionRevokeView, SessionRevokeAllView,
    LoungeSessionViewSet, ExternalIdentityViewSet,
    MikroTikRouterViewSet, RadiusServerViewSet, AuditLogViewSet,
    RoleViewSet, UserRoleAssignmentViewSet, PermissionGroupViewSet,
    UserGroupAssignmentViewSet, ResourcePermissionOverrideViewSet,
    PermissionSimulationView, MediaAccessEvaluationView,
    PermissionCacheInvalidateView,
    UnifiedSearchView, SyncJobViewSet, MediaSourceViewSet, LogicalContentGroupViewSet
)
from .media_account_views import (
    MyMediaAccountsView, MyMediaAccountDetailView, MyMediaAccountResetPasswordView,
    AdminMediaAccountMappingsView, AdminMediaAccountMappingDetailView,
    AdminMediaAccountActionView, AdminBulkOperationsView,
    AdminMediaServerUsersView, AdminMediaServerProvisioningConfigView,
    AdminMediaServerSyncUsersView, AdminMediaServerOrphansView,
    AdminProvisioningDashboardView,
)
from .onboarding_views import (
    OnboardingStatusView,
    OnboardingStartView,
    OnboardingStepDetailView,
    OnboardingStepCompleteView,
    OnboardingStepSkipView,
    OnboardingResumeView,
    OnboardingCompleteView,
    MyPreferencesView,
    MyProfileCompletionView,
    MyConsentsView,
    ConsentRevokeView,
    AdminOnboardingStepTemplateViewSet,
    AdminOnboardingAnalyticsView,
)
from .media_server_management_views import (
    AdminMediaServerDiscoveryView,
    AdminMediaServerDiscoveryActionView,
    AdminMediaServerCircuitBreakerResetView,
    AdminMediaServerHealthCheckTriggerView,
    AdminMediaServerCapabilityRefreshView,
    AdminMediaServerVersionCheckView,
    AdminMediaServerLoadBalanceSimulateView,
    AdminMediaServerDashboardView,
    PrometheusMetricsView,
)
from .search_views import (
    UserSearchView,
    SearchSuggestionsView,
    NaturalLanguageSearchView,
    SearchHistoryView,
    SearchHistoryDetailView,
    SavedSearchViewSet,
    AdminSearchAnalyticsView,
    AdminSearchZeroResultsView,
    AdminSearchRankingConfigView,
    AdminSearchSynonymsViewSet,
    AdminSearchSuggestionsViewSet,
    AdminSearchABTestViewSet,
    AdminSearchReindexView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'sites', SiteViewSet, basename='site')
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'media-servers', MediaServerViewSet, basename='media-server')
router.register(r'libraries', LibraryViewSet, basename='library')
router.register(r'content/items', MediaItemViewSet, basename='media-item')
router.register(r'content/sources', MediaSourceViewSet, basename='media-source')
router.register(r'content/groups', LogicalContentGroupViewSet, basename='logical-group')
router.register(r'sync-jobs', SyncJobViewSet, basename='sync-job')

# Phase 2 Gateways & Auth ViewSets
router.register(r'auth/sessions', LoungeSessionViewSet, basename='session')
router.register(r'auth/external-identities', ExternalIdentityViewSet, basename='external-identity')
router.register(r'gateways/mikrotik/routers', MikroTikRouterViewSet, basename='mikrotik-router')
router.register(r'gateways/radius/servers', RadiusServerViewSet, basename='radius-server')
router.register(r'core/audit-logs', AuditLogViewSet, basename='audit-log')

# Phase 3 Authorization & Enterprise Hybrid Models
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'role-assignments', UserRoleAssignmentViewSet, basename='role-assignment')
router.register(r'permission-groups', PermissionGroupViewSet, basename='permission-group')
router.register(r'group-assignments', UserGroupAssignmentViewSet, basename='group-assignment')
router.register(r'resource-overrides', ResourcePermissionOverrideViewSet, basename='resource-override')

# Phase 11 / Decision 33: Onboarding Step Templates
router.register(r'admin/onboarding/templates', AdminOnboardingStepTemplateViewSet, basename='admin-onboarding-template')

# Phase 16: Search Routers
router.register(r'me/saved-searches', SavedSearchViewSet, basename='my-saved-searches')
router.register(r'admin/search/synonyms', AdminSearchSynonymsViewSet, basename='admin-search-synonyms')
router.register(r'admin/search/suggestions', AdminSearchSuggestionsViewSet, basename='admin-search-suggestions')
router.register(r'admin/search/ab-tests', AdminSearchABTestViewSet, basename='admin-search-ab-tests')

urlpatterns = [
    # Phase 3 Authorization & Diagnostic Engine
    path('permissions/simulate-evaluation/', PermissionSimulationView.as_view(), name='permission-simulate'),
    path('permissions/evaluate-media-access/', MediaAccessEvaluationView.as_view(), name='media-access-evaluate'),
    path('permissions/cache-invalidate/', PermissionCacheInvalidateView.as_view(), name='permission-cache-invalidate'),

    # Captive Portal & SSO Gateway (Decision 4, Decision 10, Decision 26)
    path('auth/captive-portal/login/', CaptivePortalLoginView.as_view(), name='captive-portal-login'),
    path('auth/sso/exchange/', SSOExchangeView.as_view(), name='sso-exchange'),
    
    # Session Management & Token Rotation (Decision 10)
    path('auth/token/refresh-rotated/', CustomTokenRefreshView.as_view(), name='token-refresh-rotated'),
    path('auth/sessions/revoke/', SessionRevokeView.as_view(), name='session-revoke'),
    path('auth/sessions/revoke-all/', SessionRevokeAllView.as_view(), name='session-revoke-all'),

    # Standard SimpleJWT Fallback
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Current User & Entitlements
    path('users/me/', CurrentUserView.as_view(), name='user-me'),

    # Phase 4 Unified Media Search (Decision 16, Decision 50)
    path('content/search/', UnifiedSearchView.as_view(), name='unified-search'),

    # Phase 16 Enterprise Unified Search Endpoints
    path('content/search/unified/', UserSearchView.as_view(), name='search-unified'),
    path('content/search/suggestions/', SearchSuggestionsView.as_view(), name='search-suggestions'),
    path('content/search/nl/', NaturalLanguageSearchView.as_view(), name='search-natural-language'),
    path('me/search-history/', SearchHistoryView.as_view(), name='my-search-history'),
    path('me/search-history/<uuid:search_id>/', SearchHistoryDetailView.as_view(), name='my-search-history-detail'),
    path('me/search-history/<uuid:search_id>/click/', SearchHistoryDetailView.as_view(), name='my-search-history-click'),

    # Admin Search Management
    path('admin/search/analytics/', AdminSearchAnalyticsView.as_view(), name='admin-search-analytics'),
    path('admin/search/zero-results/', AdminSearchZeroResultsView.as_view(), name='admin-search-zero-results'),
    path('admin/search/ranking-config/', AdminSearchRankingConfigView.as_view(), name='admin-search-ranking-config'),
    path('admin/search/reindex/', AdminSearchReindexView.as_view(), name='admin-search-reindex'),

    # =========================================================================
    # Phase 10: Jellyfin/Emby Account Management Endpoints
    # =========================================================================
    # User Endpoints
    path('me/media-accounts/', MyMediaAccountsView.as_view(), name='my-media-accounts'),
    path('me/media-accounts/<uuid:pk>/', MyMediaAccountDetailView.as_view(), name='my-media-account-detail'),
    path('me/media-accounts/<uuid:pk>/reset-password/', MyMediaAccountResetPasswordView.as_view(), name='my-media-account-reset-password'),

    # Admin Account Mapping Endpoints
    path('admin/media-account-mappings/', AdminMediaAccountMappingsView.as_view(), name='admin-media-accounts'),
    path('admin/media-account-mappings/dashboard/', AdminProvisioningDashboardView.as_view(), name='admin-provisioning-dashboard'),
    path('admin/media-account-mappings/provision/', AdminMediaAccountMappingsView.as_view(), name='admin-media-account-provision'),
    path('admin/media-account-mappings/<uuid:pk>/', AdminMediaAccountMappingDetailView.as_view(), name='admin-media-account-detail'),
    path('admin/media-account-mappings/<uuid:pk>/<str:action>/', AdminMediaAccountActionView.as_view(), name='admin-media-account-action'),
    path('admin/media-account-mappings/bulk/<str:op_type>/', AdminBulkOperationsView.as_view(), name='admin-media-account-bulk'),

    # Admin Media Server Management & Orphans
    path('admin/media-servers/<uuid:pk>/users/', AdminMediaServerUsersView.as_view(), name='admin-media-server-users'),
    path('admin/media-servers/<uuid:pk>/provisioning-config/', AdminMediaServerProvisioningConfigView.as_view(), name='admin-media-server-config'),
    path('admin/media-servers/<uuid:pk>/sync-users/', AdminMediaServerSyncUsersView.as_view(), name='admin-media-server-sync-users'),
    path('admin/media-servers/<uuid:pk>/sync-history/', AdminMediaServerSyncUsersView.as_view(), name='admin-media-server-sync-history'),
    path('admin/media-servers/<uuid:pk>/orphan-users/', AdminMediaServerOrphansView.as_view(), name='admin-media-server-orphans'),
    path('admin/media-servers/<uuid:pk>/<str:action>/', AdminMediaServerOrphansView.as_view(), name='admin-media-server-orphan-action'),

    # =========================================================================
    # Phase 11 / Decision 33: User Onboarding Flow & Extended Profiling
    # =========================================================================
    # User Onboarding Flow Endpoints
    path('onboarding/status/', OnboardingStatusView.as_view(), name='onboarding-status'),
    path('onboarding/start/', OnboardingStartView.as_view(), name='onboarding-start'),
    path('onboarding/step/<str:step_key>/', OnboardingStepDetailView.as_view(), name='onboarding-step-detail'),
    path('onboarding/step/<str:step_key>/complete/', OnboardingStepCompleteView.as_view(), name='onboarding-step-complete'),
    path('onboarding/step/<str:step_key>/skip/', OnboardingStepSkipView.as_view(), name='onboarding-step-skip'),
    path('onboarding/resume/', OnboardingResumeView.as_view(), name='onboarding-resume'),
    path('onboarding/finish/', OnboardingCompleteView.as_view(), name='onboarding-finish'),

    # Extended Profile, Preferences & Consent Endpoints
    path('me/preferences/', MyPreferencesView.as_view(), name='my-preferences'),
    path('me/profile-completion/', MyProfileCompletionView.as_view(), name='my-profile-completion'),
    path('me/consents/', MyConsentsView.as_view(), name='my-consents'),
    path('me/consents/<str:consent_type>/revoke/', ConsentRevokeView.as_view(), name='consent-revoke'),

    # Admin Onboarding Analytics
    path('admin/onboarding/analytics/', AdminOnboardingAnalyticsView.as_view(), name='admin-onboarding-analytics'),

    # =========================================================================
    # Phase 14: Enterprise Media Server Management, Discovery & Metrics
    # =========================================================================
    # Discovery & Actions
    path('admin/media-servers/discovery/', AdminMediaServerDiscoveryView.as_view(), name='admin-media-servers-discovery'),
    path('admin/media-servers/discovery/scan/', AdminMediaServerDiscoveryView.as_view(), name='admin-media-servers-scan'),
    path('admin/media-servers/discovery/<uuid:pk>/<str:action_name>/', AdminMediaServerDiscoveryActionView.as_view(), name='admin-media-servers-discovery-action'),

    # Infrastructure Operations & Health
    path('admin/media-servers/dashboard/', AdminMediaServerDashboardView.as_view(), name='admin-media-servers-dashboard'),
    path('admin/media-servers/load-balance/simulate/', AdminMediaServerLoadBalanceSimulateView.as_view(), name='admin-media-servers-lb-simulate'),
    path('admin/media-servers/<uuid:pk>/health-check/', AdminMediaServerHealthCheckTriggerView.as_view(), name='admin-media-servers-health-check'),
    path('admin/media-servers/<uuid:pk>/circuit-breaker/reset/', AdminMediaServerCircuitBreakerResetView.as_view(), name='admin-media-servers-cb-reset'),
    path('admin/media-servers/<uuid:pk>/capabilities/refresh/', AdminMediaServerCapabilityRefreshView.as_view(), name='admin-media-servers-cap-refresh'),
    path('admin/media-servers/<uuid:pk>/version-check/', AdminMediaServerVersionCheckView.as_view(), name='admin-media-servers-version-check'),

    # Prometheus OpenMetrics
    path('metrics/prometheus/', PrometheusMetricsView.as_view(), name='metrics-prometheus'),

    # Router endpoints
    path('', include(router.urls)),
]

