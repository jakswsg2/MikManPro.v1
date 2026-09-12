from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.content.models import MediaItem, MediaSource
from apps.playback.models import DevicePlayerPreference, WatchHistory, CustomSubtitle, PlaybackSession
from apps.playback.serializers import (
    DevicePlayerPreferenceSerializer, WatchHistorySerializer,
    CustomSubtitleSerializer, WatchPartySessionSerializer
)
from apps.playback.services.adaptive_bitrate import AdaptiveBitrateService
from apps.playback.services.subtitle import SubtitleService
from apps.playback.services.external_player import ExternalPlayerLauncher
from apps.playback.services.casting import CastingService
from apps.playback.services.cross_device_sync import CrossDeviceSyncService
from apps.playback.services.watch_party import WatchPartyService
from apps.playback.services.analytics import PlaybackAnalyticsService
from apps.playback.services.intro_detection import IntroDetectionService
from apps.playback.services.next_episode import NextEpisodeService

# =============================================================================
# 16. API — Player Preferences (تفضيلات المشغل للجهاز والمستخدم)
# =============================================================================

class PlayerPreferencesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        device_id = request.query_params.get('device_id') or 'default'
        pref, _ = DevicePlayerPreference.objects.get_or_create(
            user=request.user,
            device_id=device_id,
            defaults={'tenant': getattr(request.user, 'tenant', None)}
        )
        serializer = DevicePlayerPreferenceSerializer(pref)
        return Response(serializer.data)

    def put(self, request):
        device_id = request.data.get('device_id') or 'default'
        pref, _ = DevicePlayerPreference.objects.get_or_create(
            user=request.user,
            device_id=device_id,
            defaults={'tenant': getattr(request.user, 'tenant', None)}
        )
        serializer = DevicePlayerPreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# =============================================================================
# 17. API — Cross-Device Sync (مزامنة الموضع والاستئناف)
# =============================================================================

class PlaybackSyncView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        media_item_id = request.query_params.get('media_item_id')
        if media_item_id:
            h = WatchHistory.objects.filter(user=request.user, media_item_id=media_item_id).first()
            if not h:
                return Response({'position_seconds': 0, 'sync_version': 0})
            return Response({
                'media_item_id': str(h.media_item_id),
                'position_seconds': h.position_seconds,
                'duration_seconds': h.duration_seconds,
                'completion_percentage': float(h.completion_percentage),
                'sync_version': h.sync_version,
                'last_device': h.updated_by_device,
            })

        # Return full continue watching list
        service = CrossDeviceSyncService()
        items = service.get_continue_watching(user=request.user)
        return Response(items)

    def post(self, request):
        media_item_id = request.data.get('media_item_id')
        position_seconds = int(request.data.get('position_seconds', 0))
        duration_seconds = int(request.data.get('duration_seconds', 0))
        device_id = request.data.get('device_id', 'web-client')
        watch_delta = int(request.data.get('watch_delta_seconds', 0))

        media_item = get_object_or_404(MediaItem, id=media_item_id)
        service = CrossDeviceSyncService()
        result = service.sync_position(
            user=request.user,
            media_item=media_item,
            position_seconds=position_seconds,
            duration_seconds=duration_seconds,
            device_id=device_id,
            watch_delta_seconds=watch_delta,
            preferred_quality=request.data.get('preferred_quality'),
            preferred_audio=request.data.get('preferred_audio'),
            preferred_subtitle=request.data.get('preferred_subtitle'),
        )
        return Response(result)


# =============================================================================
# 18. API — External Player Launcher (VLC, Infuse, Kodi, MX Player, IINA)
# =============================================================================

class ExternalPlayerLaunchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        media_item_id = request.data.get('media_item_id')
        player = request.data.get('player', 'vlc')
        platform = request.data.get('platform', 'web')
        device_id = request.data.get('device_id', 'external-device')

        media_item = get_object_or_404(MediaItem, id=media_item_id)
        service = ExternalPlayerLauncher()
        try:
            result = service.launch(
                user=request.user,
                media_item=media_item,
                player=player,
                device_id=device_id,
                platform=platform,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 19. API — Casting (Chromecast & AirPlay Basics)
# =============================================================================

class PrepareCastView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        media_item_id = request.data.get('media_item_id')
        cast_device_id = request.data.get('cast_device_id', 'chromecast-default')
        cast_device_name = request.data.get('cast_device_name', 'Google Cast TV')

        media_item = get_object_or_404(MediaItem, id=media_item_id)
        service = CastingService()
        try:
            result = service.prepare_cast_session(
                user=request.user,
                media_item=media_item,
                cast_device_id=cast_device_id,
                cast_device_name=cast_device_name,
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 20. API — Watch Party (Basics)
# =============================================================================

class WatchPartyCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        media_item_id = request.data.get('media_item_id')
        is_public = bool(request.data.get('is_public', False))
        max_p = int(request.data.get('max_participants', 10))

        media_item = get_object_or_404(MediaItem, id=media_item_id)
        service = WatchPartyService()
        party = service.create_party(
            host=request.user,
            media_item=media_item,
            is_public=is_public,
            max_participants=max_p
        )
        return Response(WatchPartySessionSerializer(party).data, status=status.HTTP_201_CREATED)


class WatchPartyJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        invite_code = request.data.get('invite_code')
        if not invite_code:
            return Response({'error': 'رمز الدعوة مطلوب'}, status=status.HTTP_400_BAD_REQUEST)

        service = WatchPartyService()
        try:
            participant = service.join_party(
                user=request.user,
                invite_code=invite_code,
                device_id=request.data.get('device_id')
            )
            state = service.get_state(participant.party_id, user=request.user)
            return Response(state)
        except (ValueError, PermissionError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WatchPartyStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, party_id):
        service = WatchPartyService()
        try:
            state = service.get_state(party_id, user=request.user)
            return Response(state)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)


class WatchPartySyncView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, party_id):
        position = int(request.data.get('position_seconds', 0))
        status_val = request.data.get('status', 'PLAYING')
        rate = float(request.data.get('playback_rate', 1.0))

        service = WatchPartyService()
        try:
            res = service.sync_playback(
                party_id=party_id,
                actor=request.user,
                position_seconds=position,
                status=status_val,
                playback_rate=rate
            )
            return Response(res)
        except (ValueError, PermissionError) as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)


class WatchPartyLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, party_id):
        service = WatchPartyService()
        service.leave_party(request.user, party_id)
        return Response({'status': 'left'})


# =============================================================================
# 21. API — Subtitles (قائمة الترجمات والرفع والتزامن)
# =============================================================================

class SubtitleListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, media_id):
        media_item = get_object_or_404(MediaItem, id=media_id)
        service = SubtitleService()
        subs = service.list_subtitles(media_item, user=request.user)
        return Response(subs)


class SubtitleUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, media_id):
        media_item = get_object_or_404(MediaItem, id=media_id)
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'الملف مطلوب'}, status=status.HTTP_400_BAD_REQUEST)

        language = request.data.get('language', 'ar')
        label = request.data.get('label')
        is_public = bool(request.data.get('is_public', False))

        service = SubtitleService()
        custom_sub = service.upload_custom_subtitle(
            user=request.user,
            media_item=media_item,
            file_content=file_obj.read(),
            filename=file_obj.name,
            language=language,
            label=label,
            is_public=is_public
        )
        return Response(CustomSubtitleSerializer(custom_sub).data, status=status.HTTP_201_CREATED)


class SubtitleSyncView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, sid):
        offset = float(request.data.get('offset_seconds', 0.0))
        service = SubtitleService()
        try:
            sub = service.sync_subtitle_offset(sid, offset, user=request.user)
            return Response(CustomSubtitleSerializer(sub).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 22. API — Watch Stats & Quality Log
# =============================================================================

class WatchStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        service = PlaybackAnalyticsService()
        stats = service.get_user_watch_stats(request.user, days=days)
        return Response(stats)


class PlaybackQualityLogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('playback_session_id')
        session = get_object_or_404(PlaybackSession, id=session_id, user=request.user)

        event_type = request.data.get('event_type', 'SWITCH')
        service = PlaybackAnalyticsService()

        if event_type == 'SWITCH':
            log = service.track_quality_change(
                playback_session=session,
                new_quality=request.data.get('quality', '1080p'),
                reason=request.data.get('reason', 'manual'),
                buffer_health=float(request.data.get('buffer_health', 0.0)),
                bitrate_kbps=int(request.data.get('bitrate_kbps', 0))
            )
        else:
            log = service.track_buffer_event(
                playback_session=session,
                event_type=event_type,
                buffer_duration_seconds=float(request.data.get('buffer_duration_seconds', 0.0)),
                buffer_health=float(request.data.get('buffer_health', 0.0))
            )

        return Response({'status': 'logged', 'id': str(log.id)})


class MediaItemNextEpisodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, media_id):
        media_item = get_object_or_404(MediaItem, id=media_id)
        service = NextEpisodeService()
        next_ep = service.get_next_episode(media_item)
        if not next_ep:
            return Response({'has_next': False}, status=status.HTTP_200_OK)
        return Response({'has_next': True, 'next_episode': next_ep})


class MediaItemIntroMarkerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, media_id):
        media_item = get_object_or_404(MediaItem, id=media_id)
        service = IntroDetectionService()
        intro = service.get_intro_range(media_item)
        return Response({'has_intro': intro is not None, 'intro': intro})
