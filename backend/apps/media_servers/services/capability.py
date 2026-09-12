import logging
from typing import Dict, Any, List
from django.utils import timezone
from apps.media_servers.models import MediaServer, MediaServerCapability
from apps.media_servers.connectors.jellyfin import JellyfinConnector
from apps.media_servers.connectors.emby import EmbyConnector

logger = logging.getLogger(__name__)

class CapabilityDiscoveryService:
    """
    Probes and indexes media server capabilities (Transcoding profiles, Codecs,
    Plugins, API Version, Live TV, Subtitles, Intro Detection, Trickplay).
    Stores results in MediaServer.capabilities (JSON) and MediaServerCapability records.
    """

    def get_connector(self, media_server: MediaServer):
        if media_server.server_type == MediaServer.ServerType.EMBY:
            return EmbyConnector(base_url=media_server.base_url, api_key=media_server.api_key)
        return JellyfinConnector(base_url=media_server.base_url, api_key=media_server.api_key)

    def discover_and_update(self, media_server: MediaServer) -> Dict[str, Any]:
        connector = self.get_connector(media_server)
        system_info = connector.get_system_info()
        plugins = connector.get_installed_plugins()
        tasks = connector.get_scheduled_tasks()
        playback_caps = connector.get_playback_capabilities()

        # Check for key plugins
        plugin_names = [p.get('name', '').lower() for p in plugins]
        has_intro_skipper = any('intro' in name for name in plugin_names)
        has_ldap = any('ldap' in name for name in plugin_names)
        has_sso = any('sso' in name or 'oidc' in name for name in plugin_names)
        has_opensubtitles = any('subtitles' in name for name in plugin_names)

        caps_matrix = {
            'hardware_transcoding': playback_caps.get('supports_hardware_transcoding', False),
            'supported_codecs': playback_caps.get('supported_codecs', []),
            'supported_containers': playback_caps.get('supported_containers', []),
            'direct_play': playback_caps.get('direct_play', True),
            'direct_stream': playback_caps.get('direct_stream', True),
            'transcode': playback_caps.get('transcode', True),
            'intro_skip_plugin': has_intro_skipper,
            'ldap_plugin': has_ldap,
            'sso_plugin': has_sso,
            'subtitles_plugin': has_opensubtitles,
            'plugins_count': len(plugins),
            'plugins': plugins,
            'scheduled_tasks_count': len(tasks),
            'operating_system': system_info.get('operating_system', ''),
            'architecture': system_info.get('architecture', ''),
            'server_version': system_info.get('version', media_server.server_version or 'unknown'),
        }

        # Update MediaServer record
        media_server.capabilities = caps_matrix
        media_server.capabilities_discovered_at = timezone.now()
        if system_info.get('version'):
            media_server.server_version = system_info['version']
        media_server.save(update_fields=['capabilities', 'capabilities_discovered_at', 'server_version'])

        # Store individual records in MediaServerCapability
        self._upsert_capability_records(media_server, caps_matrix)

        return caps_matrix

    def _upsert_capability_records(self, media_server: MediaServer, matrix: Dict[str, Any]):
        for key, val in matrix.items():
            try:
                MediaServerCapability.objects.update_or_create(
                    media_server=media_server,
                    capability_key=key,
                    defaults={
                        'capability_value': {'value': val} if not isinstance(val, dict) else val,
                        'detected_at': timezone.now(),
                        'is_active': bool(val),
                    }
                )
            except Exception as e:
                logger.error(f"Error persisting MediaServerCapability {key}: {e}")

    def matches_requirements(self, media_server: MediaServer, requirements: Dict[str, Any]) -> bool:
        """
        Validates whether a media server supports requested requirements (e.g. 4k transcoding).
        """
        caps = media_server.capabilities or {}
        for req_key, req_val in requirements.items():
            if req_key == 'hardware_transcoding' and req_val and not caps.get('hardware_transcoding'):
                return False
            if req_key == 'codec' and req_val not in caps.get('supported_codecs', []):
                return False
            if req_key == 'intro_skip' and req_val and not caps.get('intro_skip_plugin'):
                return False
        return True
