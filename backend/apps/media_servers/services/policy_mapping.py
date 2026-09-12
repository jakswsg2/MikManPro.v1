import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class PolicyMappingService:
    """
    Translates Smart Lounge User Entitlements, Roles, and Active Profiles
    into standard Jellyfin / Emby User Policy specifications.
    """

    DEFAULT_POLICY_PRESETS = {
        'BASIC': {
            'EnableMediaPlayback': True,
            'EnableAudioPlaybackTranscoding': True,
            'EnableVideoPlaybackTranscoding': False,
            'EnablePlaybackRemuxing': True,
            'EnableContentDownloading': False,
            'EnableSyncTranscoding': False,
            'EnableLiveTvAccess': False,
            'EnableLiveTvManagement': False,
            'MaxParentalRating': None,
        },
        'STANDARD': {
            'EnableMediaPlayback': True,
            'EnableAudioPlaybackTranscoding': True,
            'EnableVideoPlaybackTranscoding': True,
            'EnablePlaybackRemuxing': True,
            'EnableContentDownloading': True,
            'EnableSyncTranscoding': False,
            'EnableLiveTvAccess': False,
            'MaxParentalRating': None,
        },
        'VIP': {
            'EnableMediaPlayback': True,
            'EnableAudioPlaybackTranscoding': True,
            'EnableVideoPlaybackTranscoding': True,
            'EnablePlaybackRemuxing': True,
            'EnableContentDownloading': True,
            'EnableSyncTranscoding': True,
            'EnableLiveTvAccess': True,
            'MaxParentalRating': None,
        },
        'KIDS': {
            'EnableMediaPlayback': True,
            'EnableAudioPlaybackTranscoding': True,
            'EnableVideoPlaybackTranscoding': True,
            'EnablePlaybackRemuxing': True,
            'EnableContentDownloading': False,
            'EnableSyncTranscoding': False,
            'EnableLiveTvAccess': False,
            'MaxParentalRating': 7,
            'BlockedTags': ['horror', 'adult', 'violence', 'crime'],
        },
    }

    def build_policy_from_user(self, user, media_server) -> Dict[str, Any]:
        """
        Builds a comprehensive Policy dictionary based on:
        1. User profile (Kids vs Standard vs VIP)
        2. Superuser status
        3. Allowed folders & libraries
        4. MediaServer default policy settings
        """
        active_profile = getattr(user, 'active_profile', None)
        is_kids = False
        is_vip = False

        if active_profile:
            code = (getattr(active_profile, 'code', '') or getattr(active_profile, 'name', '')).upper()
            if 'KID' in code:
                is_kids = True
            elif 'VIP' in code or 'PREMIUM' in code:
                is_vip = True

        # Base default policy
        if is_kids:
            policy = dict(self.DEFAULT_POLICY_PRESETS['KIDS'])
        elif is_vip:
            policy = dict(self.DEFAULT_POLICY_PRESETS['VIP'])
        else:
            policy = dict(self.DEFAULT_POLICY_PRESETS['STANDARD'])

        # Administrator access
        if getattr(user, 'is_superuser', False):
            policy['IsAdministrator'] = True
            policy['EnableAllFolders'] = True
        else:
            policy['IsAdministrator'] = False
            # Resolve allowed library folders
            allowed_libraries = self._resolve_libraries(user, media_server)
            if allowed_libraries:
                policy['EnableAllFolders'] = False
                policy['EnabledFolders'] = allowed_libraries
            else:
                # Default to whatever server allows
                policy['EnableAllFolders'] = True

        # Merge with server-defined default policy override
        if media_server.default_policy:
            policy.update(media_server.default_policy)

        return policy

    def _resolve_libraries(self, user, media_server) -> List[str]:
        """
        Computes the list of library IDs this user is authorized to access on the given server.
        """
        libraries = list(media_server.default_library_ids or [])
        return list(set(libraries))
