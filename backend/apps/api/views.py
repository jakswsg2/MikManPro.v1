from rest_framework import viewsets, status, views
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q

from apps.accounts.models import User, ExternalIdentity, LoungeSession, AuditLog
from apps.accounts.services import SecureTokenService, SSORegistrationService
from apps.profiles.models import Profile, UserProfileAssignment
from apps.permissions.models import (
    Permission, UserPermissionOverride, Role, RolePermission,
    UserRoleAssignment, PermissionGroup, GroupPermission,
    UserGroupAssignment, ResourcePermissionOverride
)
from apps.permissions.engine import PermissionEngine
from apps.permissions.content_access import SmartContentAccessEngine
from apps.media_servers.models import MediaServer
from apps.media_servers.connectors import get_connector
from apps.content.models import Library, MediaItem
from apps.integrations.mikrotik.models import MikroTikRouter
from apps.integrations.mikrotik.gateway import MikroTikGateway
from apps.integrations.mikrotik.serializers import MikroTikRouterSerializer
from apps.integrations.radius.models import RadiusServer
from apps.integrations.radius.gateway import RadiusGateway
from apps.integrations.radius.serializers import RadiusServerSerializer
from .serializers import (
    UserSerializer, ProfileSerializer, PermissionSerializer,
    MediaServerSerializer, LibrarySerializer, MediaItemSerializer,
    UserProfileAssignmentSerializer, UserPermissionOverrideSerializer,
    ExternalIdentitySerializer, LoungeSessionSerializer, AuditLogSerializer,
    CaptivePortalLoginSerializer, SSOExchangeSerializer, SessionRefreshSerializer,
    SessionRevokeSerializer, LinkCardSerializer,
    RoleSerializer, RolePermissionSerializer, UserRoleAssignmentSerializer,
    PermissionGroupSerializer, GroupPermissionSerializer, UserGroupAssignmentSerializer,
    ResourcePermissionOverrideSerializer,
    MediaSourceSerializer, LogicalContentGroupSerializer, SyncJobSerializer
)
from .permissions import IsLoungeAdmin
from apps.content.search import UnifiedSearchService
from apps.content.sync_engine import MediaSyncEngine
from apps.content.models import MediaSource, LogicalContentGroup
from apps.media_servers.models import SyncJob
from apps.content.tasks import sync_media_server_task, sync_all_active_servers_task

class CurrentUserView(views.APIView):
    """
    Returns authenticated Lounge User profile, status, active limits,
    and effective permissions computed by the PermissionEngine.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().select_related('tenant').prefetch_related('profile_assignments__profile', 'permission_overrides__permission')
    serializer_class = UserSerializer
    permission_classes = [IsLoungeAdmin]

    @action(detail=True, methods=['post'], url_path='assign-profile')
    def assign_profile(self, request, pk=None):
        user = self.get_object()
        profile_id = request.data.get('profile_id')
        if not profile_id:
            return Response({'error': 'profile_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile = Profile.objects.get(pk=profile_id)
        except Profile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        assignment = UserProfileAssignment.objects.create(
            user=user,
            profile=profile,
            assigned_by=request.user,
            is_active=True
        )
        return Response({
            'message': f'تم إسناد بروفايل {profile.name} بنجاح للمستخدم {user.username}',
            'assignment': UserProfileAssignmentSerializer(assignment).data,
            'effective_permissions': sorted(list(PermissionEngine.get_effective_permissions(user)))
        })

    @action(detail=True, methods=['post'], url_path='override-permission')
    def override_permission(self, request, pk=None):
        user = self.get_object()
        permission_code = request.data.get('permission_code')
        is_granted = request.data.get('is_granted', True)
        reason = request.data.get('reason', '')

        try:
            permission = Permission.objects.get(code=permission_code)
        except Permission.DoesNotExist:
            return Response({'error': 'Permission code not found'}, status=status.HTTP_404_NOT_FOUND)

        override, created = UserPermissionOverride.objects.update_or_create(
            user=user,
            permission=permission,
            defaults={
                'is_granted': is_granted,
                'reason': reason,
            }
        )
        return Response({
            'message': 'تم تحديث استثناء الصلاحية بنجاح',
            'override': UserPermissionOverrideSerializer(override).data,
            'effective_permissions': sorted(list(PermissionEngine.get_effective_permissions(user)))
        })

class ProfileViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]

class MediaServerViewSet(viewsets.ModelViewSet):
    queryset = MediaServer.objects.all().prefetch_related('libraries')
    serializer_class = MediaServerSerializer
    permission_classes = [IsLoungeAdmin]

    @action(detail=True, methods=['post'], url_path='test-connection')
    def test_connection(self, request, pk=None):
        server = self.get_object()
        connector = get_connector(server)
        result = connector.test_connection()

        if result.get('success'):
            server.status = MediaServer.Status.ONLINE
            server.last_ping_at = timezone.now()
            server.server_info = result
            server.save()
            return Response({
                'status': 'online',
                'message': f'تم الاتصال بنجاح مع {server.name}',
                'server_info': result
            })
        else:
            server.status = MediaServer.Status.ERROR
            server.save()
            return Response({
                'status': 'error',
                'message': result.get('error', 'فشل الاتصال بالسيرفر المحلي'),
            }, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=True, methods=['post'], url_path='sync-libraries')
    def sync_libraries(self, request, pk=None):
        server = self.get_object()
        sync_type = request.data.get('sync_type', SyncJob.SyncType.INCREMENTAL)
        async_task = request.data.get('async', False)

        if async_task:
            task = sync_media_server_task.delay(str(server.id), sync_type=sync_type)
            return Response({
                'status': 'queued',
                'message': f'تمت جدولة مهمة المزامنة للسيرفر {server.name} بنجاح عبر Celery Queue',
                'task_id': task.id
            })

        job = MediaSyncEngine.run_sync(server, sync_type=sync_type)
        return Response({
            'status': job.status,
            'job_id': str(job.id),
            'message': f'تمت المزامنة بنجاح ({server.name})',
            'scanned': job.items_scanned,
            'created': job.items_created,
            'updated': job.items_updated,
            'unavailable': job.items_marked_unavailable,
            'deduplicated': job.items_deduplicated
        })

    @action(detail=False, methods=['post'], url_path='sync-all')
    def sync_all(self, request):
        sync_type = request.data.get('sync_type', SyncJob.SyncType.INCREMENTAL)
        task = sync_all_active_servers_task.delay(sync_type=sync_type)
        return Response({
            'status': 'queued',
            'message': f'تم إطلاق مهام المزامنة عبر Celery لجميع السيرفرات النشطة',
            'task_id': task.id
        })

class LibraryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Library.objects.filter(is_enabled=True)
    serializer_class = LibrarySerializer
    permission_classes = [IsAuthenticated]

class MediaItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Returns media items filtered strictly based on the calling user's
    active permissions.
    """
    serializer_class = MediaItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = MediaItem.objects.select_related('library').prefetch_related('seasons__episodes').all()

        # Check if user has Kids profile or only kids permission
        has_kids_view = PermissionEngine.has_permission(user, 'content.kids.view')
        has_movies_view = PermissionEngine.has_permission(user, 'content.movies.view')
        has_series_view = PermissionEngine.has_permission(user, 'content.series.view')
        has_premium_view = PermissionEngine.has_permission(user, 'content.premium.view')

        # Kids isolation
        active_profile = user.active_profile
        if active_profile and active_profile.code == 'Kids':
            return queryset.filter(is_kids=True)

        q_filter = Q()
        if has_movies_view:
            q_filter |= Q(item_type=MediaItem.ItemType.MOVIE, is_kids=False)
        if has_series_view:
            q_filter |= Q(item_type=MediaItem.ItemType.SERIES, is_kids=False)
        if has_kids_view:
            q_filter |= Q(is_kids=True)

        queryset = queryset.filter(q_filter)

        # Filter out premium if user has no premium entitlement
        if not has_premium_view:
            queryset = queryset.filter(is_premium=False)

        # Query parameter filters
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(original_title__icontains=search) |
                Q(overview__icontains=search)
            )

        category = self.request.query_params.get('category')
        if category == 'movies':
            queryset = queryset.filter(item_type=MediaItem.ItemType.MOVIE)
        elif category == 'series':
            queryset = queryset.filter(item_type=MediaItem.ItemType.SERIES)
        elif category == 'kids':
            queryset = queryset.filter(is_kids=True)
        elif category == 'premium':
            queryset = queryset.filter(is_premium=True)

        return queryset


class UnifiedSearchView(views.APIView):
    """
    Phase 4: Unified Media Search across all Media Servers.
    (Decision 16, Decision 50)
    Executes PostgreSQL FTS + Trigram + Arabic Normalization with strict pre-RBAC enforcement.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        content_type = request.query_params.get('type')
        genre = request.query_params.get('genre')
        year = request.query_params.get('year')
        resolution = request.query_params.get('resolution')
        server_id = request.query_params.get('server_id')
        
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        include_unavailable = request.query_params.get('include_unavailable', 'false').lower() == 'true'

        parsed_year = int(year) if year and year.isdigit() else None

        results = UnifiedSearchService.search(
            user=request.user,
            query=query,
            content_type=content_type,
            genre=genre,
            year=parsed_year,
            resolution=resolution,
            server_id=server_id,
            limit=limit,
            offset=offset,
            include_unavailable=include_unavailable
        )

        return Response(results)


class SyncJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Sync Jobs Dashboard & History (Decision 19, Decision 56)
    """
    queryset = SyncJob.objects.select_related('media_server').all()
    serializer_class = SyncJobSerializer
    permission_classes = [IsLoungeAdmin]


class MediaSourceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Physical Media File Sources ViewSet
    """
    queryset = MediaSource.objects.select_related('media_server', 'media_item').all()
    serializer_class = MediaSourceSerializer
    permission_classes = [IsAuthenticated]


class LogicalContentGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Deduplication & Logical Content Grouping ViewSet
    """
    queryset = LogicalContentGroup.objects.select_related('primary_item').all()
    serializer_class = LogicalContentGroupSerializer
    permission_classes = [IsAuthenticated]


class CaptivePortalLoginView(views.APIView):
    """
    نقطة وصول المصادقة المركزية لـ Captive Portal / MikroTik Hotspot
    (Decision 1, Decision 4, Decision 10, Decision 26)
    1. تستقبل بيانات الكارت أو المتصل
    2. تفحص الصلاحية عبر RADIUS Gateway (مع دعم Failover)
    3. إذا كان أول دخول للمستخدم -> تنشئ Lounge User تلقائياً وتربط الهوية (Decision 26)
    4. تصدر جلسة LoungeSession آمنة وتوكنات مشفرة وتنشئ One-Time Token (OTT)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CaptivePortalLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        external_id = data['external_id'].strip().upper()
        identity_type = data['identity_type']
        password = data.get('password', '')
        ip_address = data.get('ip_address') or request.META.get('REMOTE_ADDR', '192.168.1.104')
        user_agent = data.get('user_agent') or request.META.get('HTTP_USER_AGENT', 'CaptivePortalBrowser/1.0')
        mac_address = data.get('mac_address', '')

        # 1. RADIUS verification with failover
        try:
            is_valid, radius_attrs, server_name = RadiusGateway.authenticate_card_with_failover(
                card_number=external_id,
                password=password
            )
        except Exception as e:
            return Response({
                'error': f'فشل الاتصال بخوادم RADIUS: {str(e)}',
                'status': 'RADIUS_UNREACHABLE'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not is_valid:
            AuditLog.objects.create(
                event_type=AuditLog.EventType.LOGIN_FAILED,
                external_identity_ref=f"{identity_type}:{external_id}",
                ip_address=ip_address,
                user_agent=user_agent,
                details={'reason': radius_attrs.get('reply_message', 'Invalid card')}
            )
            return Response({
                'error': radius_attrs.get('reply_message', 'بيانات الكارت غير صحيحة أو منتهية'),
                'status': 'AUTH_FAILED'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 2. Authenticate or First-Time Register in Smart Lounge
        user, identity, token_pair, is_first_time = SSORegistrationService.authenticate_or_register(
            identity_type=identity_type,
            external_id=external_id,
            source=LoungeSession.Source.HOTSPOT if identity_type == ExternalIdentity.IdentityType.MIKROTIK else LoungeSession.Source.RADIUS,
            metadata={
                'radius_server': server_name,
                'radius_group': radius_attrs.get('Mikrotik-Group'),
                'session_timeout': radius_attrs.get('Session-Timeout'),
                'mac_address': mac_address,
            },
            context={
                'ip_address': ip_address,
                'user_agent': user_agent,
                'device_fingerprint': data.get('device_fingerprint'),
                'radius_session_id': f"acct-{secrets_token(8)}"
            }
        )

        # 3. Generate One-Time Token (OTT) for redirect if needed
        ott = SecureTokenService.generate_one_time_token(
            user_id=str(user.id),
            external_id=external_id,
            identity_type=identity_type,
            metadata={'server_used': server_name},
            ttl_seconds=60
        )

        return Response({
            'message': 'تم التحقق من هوية المستخدم بنجاح ومزامنته مع نظام الاستراحة الذكية',
            'is_first_time': is_first_time,
            'lounge_user_id': user.lounge_id,
            'user': UserSerializer(user).data,
            'external_identity': ExternalIdentitySerializer(identity).data,
            'tokens': token_pair.to_dict(),
            'one_time_token': ott,
            'radius_server_used': server_name,
            'radius_attributes': radius_attrs,
        }, status=status.HTTP_200_OK)


class SSOExchangeView(views.APIView):
    """
    استبدال رمز الـ One-Time Token (OTT) بجلسة وتوكنات الاستراحة
    (للاستخدام عند التحويل التلقائي من Captive Portal -> Smart Lounge Portal)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SSOExchangeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ott = serializer.validated_data['one_time_token']
        try:
            payload = SecureTokenService.validate_one_time_token(ott)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        user_id = payload.get('user_id')
        user = User.objects.get(id=user_id)

        token_pair = SecureTokenService.issue_token(
            user=user,
            source=LoungeSession.Source.SSO,
            ttl_minutes=480,
            context={
                'ip_address': serializer.validated_data.get('ip_address') or request.META.get('REMOTE_ADDR'),
                'user_agent': serializer.validated_data.get('user_agent') or request.META.get('HTTP_USER_AGENT', ''),
            }
        )

        return Response({
            'message': 'تم إتمام المصادقة الأحادية (SSO) بنجاح',
            'user': UserSerializer(user).data,
            'tokens': token_pair.to_dict()
        })


class CustomTokenRefreshView(views.APIView):
    """
    تدوير توكنات الجلسة (Refresh Token Rotation)
    يلغي الـ Refresh Token السابق فورياً ويصدر توكناً جديداً بالكامل
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SessionRefreshSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        refresh_token = serializer.validated_data['refresh_token']
        try:
            new_tokens = SecureTokenService.refresh_tokens(
                plain_refresh_token=refresh_token,
                context={
                    'ip_address': request.META.get('REMOTE_ADDR'),
                    'user_agent': request.META.get('HTTP_USER_AGENT', '')
                }
            )
            return Response({
                'message': 'تم تدوير توكن الجلسة وتجديده بنجاح',
                'tokens': new_tokens.to_dict()
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)


class SessionRevokeView(views.APIView):
    """
    إلغاء جلسة محددة فورياً وإضافتها للـ Blacklist
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SessionRevokeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        session_id = str(serializer.validated_data['session_id'])
        reason = serializer.validated_data.get('reason', 'User requested logout')

        # Check ownership or admin
        session = LoungeSession.objects.filter(id=session_id).first()
        if not session:
            return Response({'error': 'الجلسة غير موجودة'}, status=status.HTTP_404_NOT_FOUND)

        if session.user != request.user and not request.user.is_staff:
            return Response({'error': 'ليس لديك صلاحية إلغاء هذه الجلسة'}, status=status.HTTP_403_FORBIDDEN)

        success = SecureTokenService.revoke_session(session_id, reason=reason)
        return Response({'message': 'تم إلغاء الجلسة بنجاح', 'revoked': success})


class SessionRevokeAllView(views.APIView):
    """
    تسجيل الخروج من كافة الأجهزة وإلغاء جميع الجلسات النشطة للمستخدم
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        reason = request.data.get('reason', 'تسجيل خروج من جميع الأجهزة')
        count = SecureTokenService.revoke_all_user_sessions(str(request.user.id), reason=reason)
        return Response({
            'message': f'تم إلغاء كافة الجلسات النشطة بنجاح ({count} جلسة)',
            'revoked_count': count
        })


class LoungeSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    استعراض الجلسات النشطة وتتبع الأجهزة المتصلة
    """
    serializer_class = LoungeSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return LoungeSession.objects.all().select_related('user', 'external_identity')
        return LoungeSession.objects.filter(user=self.request.user).select_related('user', 'external_identity')


class ExternalIdentityViewSet(viewsets.ModelViewSet):
    """
    إدارة الهويات الخارجية وربط الكروت الإضافية (Decision 25)
    """
    serializer_class = ExternalIdentitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return ExternalIdentity.objects.all().select_related('user')
        return ExternalIdentity.objects.filter(user=self.request.user).select_related('user')

    @action(detail=False, methods=['post'], url_path='link-card')
    def link_card(self, request):
        """
        Decision 25: ربط كارت إضافي بحساب المستخدم الحالي
        """
        serializer = LinkCardSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        card_number = serializer.validated_data['card_number']
        identity_type = serializer.validated_data['identity_type']

        try:
            identity = SSORegistrationService.link_card_to_user(
                user=request.user,
                external_id=card_number,
                identity_type=identity_type,
                metadata={'linked_via_portal': True}
            )
            return Response({
                'message': f'تم ربط الكارت {card_number} بنجاح بحسابك في الاستراحة ({request.user.lounge_id})',
                'external_identity': ExternalIdentitySerializer(identity).data
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MikroTikRouterViewSet(viewsets.ModelViewSet):
    """
    بوابة التحكم في موجهات MikroTik RouterOS (Decision 31: Least Privilege)
    """
    queryset = MikroTikRouter.objects.all()
    serializer_class = MikroTikRouterSerializer
    permission_classes = [IsLoungeAdmin]

    @action(detail=True, methods=['post'])
    def ping(self, request, pk=None):
        router = self.get_object()
        gw = MikroTikGateway(router)
        res = gw.ping_and_health_check()
        return Response({
            'message': 'تم فحص الاتصال بالراوتر بنجاح',
            'health': res,
            'router': MikroTikRouterSerializer(router).data
        })

    @action(detail=True, methods=['get'], url_path='active-users')
    def active_users(self, request, pk=None):
        router = self.get_object()
        gw = MikroTikGateway(router)
        users = gw.get_active_hotspot_users()
        return Response({
            'router_name': router.name,
            'count': len(users),
            'active_users': users
        })

    @action(detail=True, methods=['post'], url_path='kick-user')
    def kick_user(self, request, pk=None):
        router = self.get_object()
        user_identifier = request.data.get('user_identifier')
        if not user_identifier:
            return Response({'error': 'user_identifier is required'}, status=status.HTTP_400_BAD_REQUEST)

        gw = MikroTikGateway(router)
        success = gw.kick_hotspot_user(user_identifier)
        return Response({
            'message': f'تم فصل المستخدم {user_identifier} من شبكة الهوتسبوت',
            'success': success
        })


class RadiusServerViewSet(viewsets.ModelViewSet):
    """
    إدارة خوادم RADIUS AAA (Decision 32: Primary / Secondary / Failover)
    """
    queryset = RadiusServer.objects.all()
    serializer_class = RadiusServerSerializer
    permission_classes = [IsLoungeAdmin]

    @action(detail=False, methods=['post'], url_path='test-auth')
    def test_auth(self, request):
        card_number = request.data.get('card_number', 'CARD-10001')
        password = request.data.get('password', '')
        try:
            is_valid, attrs, server_name = RadiusGateway.authenticate_card_with_failover(
                card_number=card_number,
                password=password
            )
            return Response({
                'is_valid': is_valid,
                'server_used': server_name,
                'attributes': attrs,
                'message': 'تم فحص استجابة خادم RADIUS بنجاح' if is_valid else 'رفض خادم RADIUS هذا الكارت'
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    استعراض سجلات التدقيق الأمني (Decision 35: Enterprise Audit Log)
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsLoungeAdmin]


# -------------------------------------------------------------
# Phase 3: Enterprise Hybrid Authorization & Smart Content Access
# -------------------------------------------------------------

class RoleViewSet(viewsets.ModelViewSet):
    """
    إدارة أدوار المنظومة (Decision 37: SUPER_ADMIN, TENANT_ADMIN, SITE_MANAGER, etc.)
    """
    queryset = Role.objects.all().prefetch_related('permissions_map__permission')
    serializer_class = RoleSerializer
    permission_classes = [IsLoungeAdmin]


class UserRoleAssignmentViewSet(viewsets.ModelViewSet):
    """
    تعيينات الأدوار للمستخدمين بنطاق Global / Tenant / Site
    """
    queryset = UserRoleAssignment.objects.all().select_related('user', 'role', 'tenant', 'site')
    serializer_class = UserRoleAssignmentSerializer
    permission_classes = [IsLoungeAdmin]

    def perform_create(self, serializer):
        instance = serializer.save(assigned_by=self.request.user if self.request.user.is_authenticated else None)
        PermissionEngine.invalidate_cache(user_id=str(instance.user.id))

    def perform_update(self, serializer):
        instance = serializer.save()
        PermissionEngine.invalidate_cache(user_id=str(instance.user.id))

    def perform_destroy(self, instance):
        uid = str(instance.user.id)
        instance.delete()
        PermissionEngine.invalidate_cache(user_id=uid)


class PermissionGroupViewSet(viewsets.ModelViewSet):
    """
    مجموعات الصلاحيات وأولوياتها (Decision 12 & Decision 37)
    """
    queryset = PermissionGroup.objects.all().prefetch_related('group_permissions__permission', 'members')
    serializer_class = PermissionGroupSerializer
    permission_classes = [IsLoungeAdmin]


class UserGroupAssignmentViewSet(viewsets.ModelViewSet):
    """
    إسناد المستخدمين لمجموعات الصلاحيات
    """
    queryset = UserGroupAssignment.objects.all().select_related('user', 'group', 'tenant', 'site')
    serializer_class = UserGroupAssignmentSerializer
    permission_classes = [IsLoungeAdmin]

    def perform_create(self, serializer):
        instance = serializer.save()
        PermissionEngine.invalidate_cache(user_id=str(instance.user.id))

    def perform_destroy(self, instance):
        uid = str(instance.user.id)
        instance.delete()
        PermissionEngine.invalidate_cache(user_id=uid)


class ResourcePermissionOverrideViewSet(viewsets.ModelViewSet):
    """
    استثناءات الصلاحيات على مستوى الموارد بعينها (Decision 37: Resource-Level)
    """
    queryset = ResourcePermissionOverride.objects.all().select_related('user', 'permission')
    serializer_class = ResourcePermissionOverrideSerializer
    permission_classes = [IsLoungeAdmin]

    def perform_create(self, serializer):
        instance = serializer.save()
        PermissionEngine.invalidate_cache(user_id=str(instance.user.id))

    def perform_destroy(self, instance):
        uid = str(instance.user.id)
        instance.delete()
        PermissionEngine.invalidate_cache(user_id=uid)


class PermissionSimulationView(views.APIView):
    """
    محاكي سلسلة اتخاذ قرار الصلاحية خطوة بخطوة وفق القرار 59:
    Global -> Tenant -> Site -> Group -> User Override -> Profile -> Resource
    """
    permission_classes = [IsLoungeAdmin]

    def post(self, request):
        user_id = request.data.get('user_id')
        permission_code = request.data.get('permission_code')
        resource_type = request.data.get('resource_type')
        resource_id = request.data.get('resource_id')

        if not user_id or not permission_code:
            return Response({'error': 'user_id and permission_code are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        trace = PermissionEngine.simulate_permission_evaluation(
            user=target_user,
            permission_code=permission_code,
            resource_type=resource_type,
            resource_id=resource_id,
            tenant=getattr(target_user, 'tenant', None)
        )
        return Response(trace)


class MediaAccessEvaluationView(views.APIView):
    """
    نقطة فحص إمكانية وصول المستخدم لمادة معينة عبر Smart Content Access Engine (Decision 38)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        media_item_id = request.data.get('media_item_id')

        # Allow admins to evaluate for any user in simulation mode
        simulated_user_id = request.data.get('target_user_id')
        if simulated_user_id and (user.is_staff or user.is_superuser):
            try:
                user = User.objects.get(pk=simulated_user_id)
            except User.DoesNotExist:
                return Response({'error': 'Simulated user not found'}, status=status.HTTP_404_NOT_FOUND)

        if not media_item_id:
            return Response({'error': 'media_item_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            media_item = MediaItem.objects.select_related('library').get(pk=media_item_id)
        except MediaItem.DoesNotExist:
            return Response({'error': 'Media item not found'}, status=status.HTTP_404_NOT_FOUND)

        evaluation = SmartContentAccessEngine.evaluate_media_access(
            user=user,
            media_item=media_item,
            tenant=getattr(user, 'tenant', None)
        )
        return Response(evaluation)


class PermissionCacheInvalidateView(views.APIView):
    """
    تفريغ الذاكرة المؤقتة لـ Redis الخاصة بالصلاحيات (Redis Invalidation)
    """
    permission_classes = [IsLoungeAdmin]

    def post(self, request):
        user_id = request.data.get('user_id')
        tenant_id = request.data.get('tenant_id')
        site_id = request.data.get('site_id')

        PermissionEngine.invalidate_cache(user_id=user_id, tenant_id=tenant_id, site_id=site_id)
        return Response({
            'status': 'success',
            'message': f'تم إبطال الكاش للصلاحيات بنجاح ({user_id or "All Users"})',
            'cleared_at': timezone.now().isoformat()
        })


def secrets_token(n: int = 8) -> str:
    import secrets
    return secrets.token_hex(n)

