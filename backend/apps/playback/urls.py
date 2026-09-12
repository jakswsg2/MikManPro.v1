from django.urls import path
from apps.playback.views import (
    PlayerPreferencesView, PlaybackSyncView, ExternalPlayerLaunchView,
    PrepareCastView, WatchPartyCreateView, WatchPartyJoinView,
    WatchPartyStateView, WatchPartySyncView, WatchPartyLeaveView,
    SubtitleListView, SubtitleUploadView, SubtitleSyncView,
    WatchStatsView, PlaybackQualityLogView, MediaItemNextEpisodeView,
    MediaItemIntroMarkerView
)

urlpatterns = [
    # Player Preferences
    path('me/player-preferences/', PlayerPreferencesView.as_view(), name='player-preferences'),

    # Cross-Device Continue Watching & Sync
    path('playback/sync/', PlaybackSyncView.as_view(), name='playback-sync'),

    # External Player Deep Launch
    path('playback/external/', ExternalPlayerLaunchView.as_view(), name='playback-external'),

    # Casting (Chromecast / AirPlay)
    path('playback/cast/prepare/', PrepareCastView.as_view(), name='playback-cast-prepare'),

    # Quality & Buffer Analytics
    path('playback/quality-log/', PlaybackQualityLogView.as_view(), name='playback-quality-log'),
    path('me/watch-stats/', WatchStatsView.as_view(), name='my-watch-stats'),

    # Next Episode & Intro Markers
    path('media/items/<uuid:media_id>/next/', MediaItemNextEpisodeView.as_view(), name='media-item-next'),
    path('media/items/<uuid:media_id>/intro/', MediaItemIntroMarkerView.as_view(), name='media-item-intro'),

    # Custom & Built-in Subtitles
    path('media/items/<uuid:media_id>/subtitles/', SubtitleListView.as_view(), name='subtitle-list'),
    path('media/items/<uuid:media_id>/subtitles/upload/', SubtitleUploadView.as_view(), name='subtitle-upload'),
    path('subtitles/<uuid:sid>/sync/', SubtitleSyncView.as_view(), name='subtitle-sync'),

    # Watch Party Sessions
    path('watch-party/create/', WatchPartyCreateView.as_view(), name='watch-party-create'),
    path('watch-party/join/', WatchPartyJoinView.as_view(), name='watch-party-join'),
    path('watch-party/<uuid:party_id>/state/', WatchPartyStateView.as_view(), name='watch-party-state'),
    path('watch-party/<uuid:party_id>/sync/', WatchPartySyncView.as_view(), name='watch-party-sync'),
    path('watch-party/<uuid:party_id>/leave/', WatchPartyLeaveView.as_view(), name='watch-party-leave'),
]
