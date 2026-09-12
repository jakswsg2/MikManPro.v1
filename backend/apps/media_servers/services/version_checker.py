import re
import logging
from typing import Dict, Any, Tuple
from django.utils import timezone
from apps.media_servers.models import MediaServer

logger = logging.getLogger(__name__)

# Compatibility guidelines
# Jellyfin: Minimum 10.8.0, Recommended 10.8.13+, 10.9.x supported
# Emby: Minimum 4.7.0, Recommended 4.8.x+
COMPATIBILITY_RULES = {
    MediaServer.ServerType.JELLYFIN: {
        'min_version': (10, 8, 0),
        'recommended_version': (10, 8, 13),
        'max_tested_version': (10, 10, 0),
    },
    MediaServer.ServerType.EMBY: {
        'min_version': (4, 7, 0),
        'recommended_version': (4, 8, 0),
        'max_tested_version': (4, 9, 0),
    }
}

class VersionCompatibilityService:
    """
    Validates Media Server software versions against Smart Lounge platform requirements.
    Detects deprecated API endpoints, breaking changes, and warns administrators.
    """

    def parse_version(self, version_str: str) -> Tuple[int, ...]:
        """Parses version strings like '10.8.13' into a tuple of ints (10, 8, 13)."""
        if not version_str:
            return (0, 0, 0)
        clean = re.sub(r'[^\d.]', '', version_str)
        parts = clean.split('.')
        nums = []
        for p in parts[:3]:
            try:
                nums.append(int(p))
            except ValueError:
                nums.append(0)
        while len(nums) < 3:
            nums.append(0)
        return tuple(nums)

    def check_compatibility(self, media_server: MediaServer) -> Dict[str, Any]:
        """
        Evaluates a media server's version and determines compatibility status:
        - COMPATIBLE
        - WARNING (older than recommended or newer than tested)
        - INCOMPATIBLE (below minimum required)
        """
        rules = COMPATIBILITY_RULES.get(media_server.server_type)
        version_str = media_server.server_version or '0.0.0'
        parsed = self.parse_version(version_str)

        status = 'COMPATIBLE'
        notes = []

        if rules:
            min_ver = rules['min_version']
            rec_ver = rules['recommended_version']
            max_ver = rules['max_tested_version']

            if parsed < min_ver:
                status = 'INCOMPATIBLE'
                notes.append(f"Version {version_str} is below minimum supported {'.'.join(map(str, min_ver))}.")
            elif parsed < rec_ver:
                status = 'WARNING'
                notes.append(f"Version {version_str} is older than recommended {'.'.join(map(str, rec_ver))}.")
            elif parsed > max_ver:
                status = 'WARNING'
                notes.append(f"Version {version_str} is newer than max tested {'.'.join(map(str, max_ver))}.")
            else:
                notes.append(f"Version {version_str} is fully compatible and recommended.")
        else:
            notes.append(f"No specific version rules defined for {media_server.server_type}.")

        media_server.last_version_check_at = timezone.now()
        media_server.save(update_fields=['last_version_check_at'])

        return {
            'server_id': str(media_server.id),
            'server_name': media_server.name,
            'server_type': media_server.server_type,
            'version': version_str,
            'status': status,
            'notes': notes,
            'is_compatible': status != 'INCOMPATIBLE',
        }
