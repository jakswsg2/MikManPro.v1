import secrets
import string
import logging
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.media_servers.models import (
    MediaServer, MediaAccountMapping,
    MediaServerUserSync, MediaServerOrphanUser
)
from apps.accounts.models import User, AuditLog
from apps.media_servers.services import (
    MediaAccountProvisioningService,
    MediaAccountDeprovisioningService,
    ManualLinkingService,
    MediaServerAccountSyncService,
    BulkAccountService,
    PolicyMappingService,
    ProvisioningHealthService,
    AccountAlreadyLinked,
    ExternalUserNotFound,
)
from apps.media_servers.connectors import get_connector
from apps.core.crypto import encrypt_secret
from .serializers import (
    MediaAccountMappingSerializer,
    MediaServerUserSyncSerializer,
    MediaServerOrphanUserSerializer,
    ProvisioningConfigSerializer,
    ManualLinkUserSerializer,
    BulkProvisionSerializer,
    BulkDisableSerializer,
    BulkPolicySerializer,
)

logger = logging.getLogger(__name__)

# =========================================================================
# User Endpoints (/api/v1/me/media-accounts/)
# =========================================================================

class MyMediaAccountsView(APIView):
    """
    GET /api/v1/me/media-accounts/
    Returns all media server accounts linked to the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        mappings = MediaAccountMapping.objects.filter(
            user=request.user,
            deleted_at__isnull=True
        ).select_related('media_server')
        serializer = MediaAccountMappingSerializer(mappings, many=True)
        return Response({'results': serializer.data, 'count': mappings.count()})


class MyMediaAccountDetailView(APIView):
    """
    GET /api/v1/me/media-accounts/{id}/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        mapping = get_object_or_404(
            MediaAccountMapping.objects.select_related('media_server'),
            id=pk,
            user=request.user,
            deleted_at__isnull=True
        )
        return Response(MediaAccountMappingSerializer(mapping).data)


class MyMediaAccountResetPasswordView(APIView):
    """
    POST /api/v1/me/media-accounts/{id}/reset-password/
    Allows the user to reset their Jellyfin/Emby account password.
    Returns the newly generated secure password once for display and copying.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        mapping = get_object_or_404(
            MediaAccountMapping,
            id=pk,
            user=request.user,
            is_active=True,
            deleted_at__isnull=True
        )

        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(secrets.choice(alphabet) for _ in range(20))

        try:
            connector = get_connector(mapping.media_server)
            connector.update_user_password(mapping.external_user_id, new_password)
            mapping.external_password_encrypted = encrypt_secret(new_password)
            mapping.save(update_fields=['external_password_encrypted'])

            AuditLog.objects.create(
                event_type='media_account.user_password_reset',
                user=request.user,
                external_identity_ref=f"{mapping.media_server.name}:{mapping.external_username}",
                details={'mapping_id': str(mapping.id)}
            )

            return Response({
                'success': True,
                'message': 'تم تحديث كلمة مرور خادم الوسائط بنجاح.',
                'new_password': new_password,
                'username': mapping.external_username,
                'server_name': mapping.media_server.name,
                'server_url': mapping.media_server.local_url,
            })
        except Exception as e:
            logger.error(f"Error resetting password for user {request.user.username}: {e}")
            return Response({'error': f'فشل تحديث كلمة المرور: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =========================================================================
# Admin Endpoints (/api/v1/admin/...)
# =========================================================================

class AdminMediaAccountMappingsView(APIView):
    """
    GET /api/v1/admin/media-account-mappings/
    POST /api/v1/admin/media-account-mappings/provision/
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = MediaAccountMapping.objects.filter(deleted_at__isnull=True).select_related('media_server', 'user')

        server_id = request.query_params.get('media_server_id')
        if server_id:
            qs = qs.filter(media_server_id=server_id)

        prov_status = request.query_params.get('status')
        if prov_status:
            qs = qs.filter(provisioning_status=prov_status)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                user__username__icontains=search
            ) | qs.filter(
                external_username__icontains=search
            ) | qs.filter(
                user__lounge_id__icontains=search
            )

        serializer = MediaAccountMappingSerializer(qs, many=True)
        return Response({'results': serializer.data, 'count': qs.count()})

    def post(self, request):
        """Single user provision"""
        user_id = request.data.get('user_id')
        server_id = request.data.get('media_server_id')
        force_mode = request.data.get('provisioning_mode')

        if not user_id or not server_id:
            return Response({'error': 'user_id and media_server_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(User, id=user_id)
        server = get_object_or_404(MediaServer, id=server_id)

        try:
            provisioner = MediaAccountProvisioningService()
            mapping = provisioner.provision_for_user(user, server, force_mode=force_mode, actor=request.user)
            return Response(MediaAccountMappingSerializer(mapping).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminMediaAccountMappingDetailView(APIView):
    """
    GET /api/v1/admin/media-account-mappings/{id}/
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        mapping = get_object_or_404(
            MediaAccountMapping.objects.select_related('media_server', 'user'),
            id=pk
        )
        return Response(MediaAccountMappingSerializer(mapping).data)


class AdminMediaAccountActionView(APIView):
    """
    Actions: disable, enable, delete, apply-policy, reset-password, sync
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk, action):
        mapping = get_object_or_404(
            MediaAccountMapping.objects.select_related('media_server', 'user'),
            id=pk
        )

        deprovisioner = MediaAccountDeprovisioningService()

        if action == 'disable':
            reason = request.data.get('reason', 'Admin manual disable')
            deprovisioner.disable_account(mapping, reason=reason, actor=request.user)
            return Response({'success': True, 'status': 'DISABLED'})

        elif action == 'enable':
            deprovisioner.enable_account(mapping, actor=request.user)
            return Response({'success': True, 'status': 'COMPLETED'})

        elif action == 'delete':
            reason = request.data.get('reason', 'Admin deletion')
            deprovisioner.delete_account(mapping, reason=reason, actor=request.user)
            return Response({'success': True, 'status': 'DELETED'})

        elif action == 'apply-policy':
            policy_mapper = PolicyMappingService()
            connector = get_connector(mapping.media_server)
            policy = policy_mapper.build_policy_from_user(mapping.user, mapping.media_server)
            override = request.data.get('policy_override')
            if override and isinstance(override, dict):
                policy.update(override)
            connector.update_user_policy(mapping.external_user_id, policy)
            mapping.media_server_policy = policy
            mapping.save(update_fields=['media_server_policy'])
            return Response({'success': True, 'policy': policy})

        elif action == 'reset-password':
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            new_password = ''.join(secrets.choice(alphabet) for _ in range(20))
            connector = get_connector(mapping.media_server)
            connector.update_user_password(mapping.external_user_id, new_password)
            mapping.external_password_encrypted = encrypt_secret(new_password)
            mapping.save(update_fields=['external_password_encrypted'])
            return Response({
                'success': True,
                'username': mapping.external_username,
                'new_password': new_password
            })

        elif action == 'sync':
            connector = get_connector(mapping.media_server)
            try:
                ext_user = connector.get_user(mapping.external_user_id)
                mapping.external_username = ext_user.get('Name', mapping.external_username)
                mapping.sync_status = MediaAccountMapping.SyncStatus.IN_SYNC
                mapping.last_sync_at = timezone.now()
                mapping.save()
                return Response({'success': True, 'sync_status': 'IN_SYNC'})
            except Exception as e:
                mapping.sync_status = MediaAccountMapping.SyncStatus.OUT_OF_SYNC
                mapping.save()
                return Response({'success': False, 'sync_status': 'OUT_OF_SYNC', 'error': str(e)})

        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


class AdminBulkOperationsView(APIView):
    """
    POST /api/v1/admin/media-account-mappings/bulk-provision/
    POST /api/v1/admin/media-account-mappings/bulk-disable/
    POST /api/v1/admin/media-account-mappings/bulk-apply-policy/
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, op_type):
        service = BulkAccountService()

        if op_type == 'bulk-provision':
            serializer = BulkProvisionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            res = service.bulk_provision(
                user_ids=serializer.validated_data['user_ids'],
                media_server_id=serializer.validated_data['media_server_id'],
                actor=request.user
            )
            return Response(res)

        elif op_type == 'bulk-disable':
            serializer = BulkDisableSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            res = service.bulk_disable(
                mapping_ids=serializer.validated_data['mapping_ids'],
                reason=serializer.validated_data.get('reason', 'Bulk disable'),
                actor=request.user
            )
            return Response(res)

        elif op_type == 'bulk-apply-policy':
            serializer = BulkPolicySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            res = service.bulk_apply_policy(
                mapping_ids=serializer.validated_data['mapping_ids'],
                policy_override=serializer.validated_data.get('policy_override'),
                actor=request.user
            )
            return Response(res)

        return Response({'error': 'Invalid bulk operation type'}, status=status.HTTP_400_BAD_REQUEST)


class AdminMediaServerUsersView(APIView):
    """
    GET /api/v1/admin/media-servers/{id}/users/
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        server = get_object_or_404(MediaServer, id=pk)
        mappings = MediaAccountMapping.objects.filter(
            media_server=server,
            deleted_at__isnull=True
        ).select_related('user')
        serializer = MediaAccountMappingSerializer(mappings, many=True)
        return Response({'results': serializer.data, 'count': mappings.count()})


class AdminMediaServerProvisioningConfigView(APIView):
    """
    GET, PUT /api/v1/admin/media-servers/{id}/provisioning-config/
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        server = get_object_or_404(MediaServer, id=pk)
        return Response(ProvisioningConfigSerializer(server).data)

    def put(self, request, pk):
        server = get_object_or_404(MediaServer, id=pk)
        serializer = ProvisioningConfigSerializer(server, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminMediaServerSyncUsersView(APIView):
    """
    POST /api/v1/admin/media-servers/{id}/sync-users/
    GET /api/v1/admin/media-servers/{id}/sync-history/
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        server = get_object_or_404(MediaServer, id=pk)
        sync_type = request.data.get('sync_type', 'INCREMENTAL')
        sync_service = MediaServerAccountSyncService()
        record = sync_service.sync_users(server, sync_type=sync_type, actor=request.user)
        return Response(MediaServerUserSyncSerializer(record).data)

    def get(self, request, pk):
        server = get_object_or_404(MediaServer, id=pk)
        history = MediaServerUserSync.objects.filter(media_server=server).order_by('-started_at')[:50]
        return Response({'results': MediaServerUserSyncSerializer(history, many=True).data})


class AdminMediaServerOrphansView(APIView):
    """
    GET /api/v1/admin/media-servers/{id}/orphan-users/
    POST /api/v1/admin/media-servers/{id}/link-user/
    POST /api/v1/admin/media-servers/{id}/claim-orphan/
    POST /api/v1/admin/media-servers/{id}/ignore-orphan/
    POST /api/v1/admin/media-servers/{id}/delete-orphan/
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        server = get_object_or_404(MediaServer, id=pk)
        orphans = MediaServerOrphanUser.objects.filter(media_server=server)
        status_filter = request.query_params.get('status')
        if status_filter:
            orphans = orphans.filter(status=status_filter)
        return Response({'results': MediaServerOrphanUserSerializer(orphans, many=True).data})

    def post(self, request, pk, action=None):
        server = get_object_or_404(MediaServer, id=pk)

        if action == 'link-user' or action == 'claim-orphan':
            user_id = request.data.get('user_id')
            external_user_id = request.data.get('external_user_id')
            if not user_id or not external_user_id:
                return Response({'error': 'user_id and external_user_id required'}, status=status.HTTP_400_BAD_REQUEST)

            user = get_object_or_404(User, id=user_id)
            linking_service = ManualLinkingService()
            try:
                mapping = linking_service.link_existing_account(user, server, external_user_id, actor=request.user)
                return Response(MediaAccountMappingSerializer(mapping).data)
            except AccountAlreadyLinked as al:
                return Response({'error': str(al)}, status=status.HTTP_409_CONFLICT)
            except ExternalUserNotFound as nf:
                return Response({'error': str(nf)}, status=status.HTTP_404_NOT_FOUND)

        elif action == 'ignore-orphan':
            orphan_id = request.data.get('orphan_id')
            orphan = get_object_or_404(MediaServerOrphanUser, id=orphan_id, media_server=server)
            orphan.status = MediaServerOrphanUser.Status.IGNORED
            orphan.resolved_by = request.user
            orphan.resolution_note = request.data.get('note', 'Ignored by admin')
            orphan.save()
            return Response(MediaServerOrphanUserSerializer(orphan).data)

        elif action == 'delete-orphan':
            orphan_id = request.data.get('orphan_id')
            orphan = get_object_or_404(MediaServerOrphanUser, id=orphan_id, media_server=server)
            connector = get_connector(server)
            try:
                connector.delete_user(orphan.external_user_id)
            except Exception as e:
                logger.warning(f"Failed remote deletion for orphan {orphan.external_user_id}: {e}")
            orphan.status = MediaServerOrphanUser.Status.DELETED
            orphan.resolved_by = request.user
            orphan.resolution_note = "Deleted from media server by admin"
            orphan.save()
            return Response({'success': True, 'status': 'DELETED'})

        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


class AdminProvisioningDashboardView(APIView):
    """
    GET /api/v1/admin/media-account-mappings/dashboard/
    Returns high-level health score, sync KPIs, orphan user alerts, and breakdowns.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        server_id = request.query_params.get('media_server_id')
        health_service = ProvisioningHealthService()
        metrics = health_service.get_health_metrics(server_id)

        # Recent sync history
        syncs = MediaServerUserSync.objects.all()
        if server_id:
            syncs = syncs.filter(media_server_id=server_id)
        recent_syncs = MediaServerUserSyncSerializer(syncs.order_by('-started_at')[:10], many=True).data

        # Recent orphans
        orphans = MediaServerOrphanUser.objects.filter(status=MediaServerOrphanUser.Status.NEW)
        if server_id:
            orphans = orphans.filter(media_server_id=server_id)
        recent_orphans = MediaServerOrphanUserSerializer(orphans.order_by('-detected_at')[:10], many=True).data

        return Response({
            'metrics': metrics,
            'recent_syncs': recent_syncs,
            'recent_orphans': recent_orphans,
        })
