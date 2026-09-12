import logging
import requests
from typing import Dict, Any, List, Optional
from .base import BaseMediaServerConnector

logger = logging.getLogger(__name__)

class MediaServerAPIError(Exception):
    """Base exception for media server API failures."""
    pass

class UserNotFoundError(MediaServerAPIError):
    """Raised when external user is not found on media server."""
    pass

class JellyfinConnector(BaseMediaServerConnector):
    """
    Direct LAN REST client for Jellyfin Media Server.
    Supports system info, catalog sync, and comprehensive User Account Management:
    - User Provisioning (/Users/New)
    - Policy Management (/Users/{userId}/Policy)
    - Folder/Library Access (/Users/{userId}/Policy)
    - Password Rotation (/Users/{userId}/Password)
    - Deletion and State Toggles (Enable/Disable)
    """

    def _headers(self) -> Dict[str, str]:
        return {
            'X-Emby-Token': self.api_key,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'SmartLounge-Gateway/1.0',
        }

    def test_connection(self) -> Dict[str, Any]:
        try:
            url = f"{self.base_url}/System/Info"
            response = requests.get(url, headers=self._headers(), timeout=8)
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'server_name': data.get('ServerName', 'Jellyfin LAN'),
                    'version': data.get('Version', 'Unknown'),
                    'id': data.get('Id', ''),
                    'operating_system': data.get('OperatingSystem', ''),
                }
            return {
                'success': False,
                'error': f'HTTP {response.status_code}: {response.text[:200]}'
            }
        except requests.RequestException as e:
            return {
                'success': False,
                'error': f'Connection failed: {str(e)}'
            }

    def get_system_info(self) -> Dict[str, Any]:
        """GET /System/Info - Retrieves comprehensive hardware, version, and architecture info."""
        try:
            url = f"{self.base_url}/System/Info"
            response = requests.get(url, headers=self._headers(), timeout=8)
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'server_name': data.get('ServerName', 'Jellyfin LAN'),
                    'version': data.get('Version', 'Unknown'),
                    'id': data.get('Id', ''),
                    'operating_system': data.get('OperatingSystem', ''),
                    'architecture': data.get('SystemArchitecture', ''),
                    'supports_hardware_transcoding': data.get('SupportsHardwareEncoding', False),
                    'can_self_restart': data.get('CanSelfRestart', False),
                    'web_socket_port_number': data.get('WebSocketPortNumber'),
                    'raw': data,
                }
            return {'success': False, 'error': f'HTTP {response.status_code}'}
        except Exception as e:
            logger.error(f"Error fetching system info from {self.base_url}: {e}")
            return {'success': False, 'error': str(e)}

    def get_system_status(self) -> Dict[str, Any]:
        """GET /Sessions - Retrieves active sessions, active transcode streams, and client activity."""
        try:
            url = f"{self.base_url}/Sessions"
            response = requests.get(url, headers=self._headers(), timeout=8)
            if response.status_code == 200:
                sessions = response.json()
                active_sessions = len(sessions)
                transcoding_count = 0
                for s in sessions:
                    play_state = s.get('PlayState', {})
                    transcoding_info = s.get('TranscodingInfo')
                    if transcoding_info or (play_state and play_state.get('PlayMethod') == 'Transcode'):
                        transcoding_count += 1
                return {
                    'success': True,
                    'active_sessions': active_sessions,
                    'active_transcodes': transcoding_count,
                    'sessions': sessions,
                }
            return {'success': False, 'active_sessions': 0, 'active_transcodes': 0}
        except Exception as e:
            logger.error(f"Error fetching system status/sessions from {self.base_url}: {e}")
            return {'success': False, 'active_sessions': 0, 'active_transcodes': 0, 'error': str(e)}

    def get_installed_plugins(self) -> List[Dict[str, Any]]:
        """GET /Plugins - Returns all installed plugins and their versions/status."""
        try:
            url = f"{self.base_url}/Plugins"
            response = requests.get(url, headers=self._headers(), timeout=10)
            if response.status_code == 200:
                data = response.json()
                plugins = []
                for p in data:
                    plugins.append({
                        'id': p.get('Id'),
                        'name': p.get('Name'),
                        'version': p.get('Version'),
                        'status': p.get('Status'),
                        'description': p.get('Description'),
                    })
                return plugins
            return []
        except Exception as e:
            logger.error(f"Error fetching plugins from {self.base_url}: {e}")
            return []

    def get_scheduled_tasks(self) -> List[Dict[str, Any]]:
        """GET /ScheduledTasks - Returns background indexing, scan, and maintenance tasks."""
        try:
            url = f"{self.base_url}/ScheduledTasks"
            response = requests.get(url, headers=self._headers(), timeout=10)
            if response.status_code == 200:
                data = response.json()
                tasks = []
                for t in data:
                    tasks.append({
                        'id': t.get('Id'),
                        'name': t.get('Name'),
                        'state': t.get('State'),
                        'current_progress_percentage': t.get('CurrentProgressPercentage'),
                        'category': t.get('Category'),
                        'last_execution_result': t.get('LastExecutionResult'),
                    })
                return tasks
            return []
        except Exception as e:
            logger.error(f"Error fetching scheduled tasks from {self.base_url}: {e}")
            return []

    def get_playback_capabilities(self) -> Dict[str, Any]:
        """GET /Playback/BitrateTest or system encoding profiles."""
        info = self.get_system_info()
        return {
            'supports_hardware_transcoding': info.get('supports_hardware_transcoding', False),
            'supported_codecs': ['h264', 'hevc', 'vp9', 'av1', 'aac', 'ac3', 'eac3', 'mp3', 'opus'],
            'supported_containers': ['mp4', 'mkv', 'webm', 'ts', 'm3u8'],
            'direct_play': True,
            'direct_stream': True,
            'transcode': True,
        }


    def get_libraries(self) -> List[Dict[str, Any]]:
        try:
            url = f"{self.base_url}/Library/MediaFolders"
            response = requests.get(url, headers=self._headers(), timeout=10)
            if response.status_code == 200:
                data = response.json()
                items = data.get('Items', [])
                libraries = []
                for item in items:
                    libraries.append({
                        'external_id': item.get('Id'),
                        'name': item.get('Name'),
                        'collection_type': item.get('CollectionType', 'movies'),
                        'item_count': item.get('ChildCount', 0),
                    })
                return libraries
            return []
        except Exception as e:
            logger.error(f"Error fetching libraries from Jellyfin: {e}")
            return []

    def get_library_items(self, library_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        try:
            url = f"{self.base_url}/Items"
            params = {
                'ParentId': library_id,
                'Limit': limit,
                'Recursive': 'true',
                'IncludeItemTypes': 'Movie,Series',
                'Fields': 'Overview,Genres,PremiereDate,RunTimeTicks,MediaStreams,CommunityRating',
            }
            response = requests.get(url, headers=self._headers(), params=params, timeout=15)
            if response.status_code == 200:
                data = response.json()
                return data.get('Items', [])
            return []
        except Exception as e:
            logger.error(f"Error fetching library items from Jellyfin: {e}")
            return []

    # =========================================================================
    # Phase 10: Jellyfin User Management APIs
    # =========================================================================

    def list_users(self) -> List[Dict[str, Any]]:
        """
        GET /Users
        Lists all user accounts currently provisioned on Jellyfin.
        """
        try:
            url = f"{self.base_url}/Users"
            response = requests.get(url, headers=self._headers(), timeout=12)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Jellyfin list_users failed on {self.base_url}: {e}")
            raise MediaServerAPIError(f"Could not list users: {str(e)}")

    def get_user(self, user_id: str) -> Dict[str, Any]:
        """
        GET /Users/{userId}
        Retrieves full details and active policies for a specific Jellyfin user.
        """
        try:
            url = f"{self.base_url}/Users/{user_id}"
            response = requests.get(url, headers=self._headers(), timeout=10)
            if response.status_code == 404:
                raise UserNotFoundError(f"User {user_id} not found on Jellyfin.")
            response.raise_for_status()
            return response.json()
        except UserNotFoundError:
            raise
        except requests.RequestException as e:
            logger.error(f"Jellyfin get_user {user_id} failed: {e}")
            raise MediaServerAPIError(f"Could not get user: {str(e)}")

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Searches existing users by exact case-insensitive username match.
        """
        users = self.list_users()
        username_lower = username.strip().lower()
        for u in users:
            if u.get('Name', '').strip().lower() == username_lower:
                return u
        return None

    def create_user(self, username: str, password: str) -> Dict[str, Any]:
        """
        POST /Users/New
        Creates a new user on Jellyfin with initial random secure password.
        Returns user payload with 'Id' and 'Name'.
        """
        try:
            url = f"{self.base_url}/Users/New"
            payload = {
                'Name': username,
                'Password': password,
            }
            response = requests.post(url, headers=self._headers(), json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Successfully created Jellyfin user: {username} (ID: {data.get('Id')})")
            return data
        except requests.RequestException as e:
            logger.error(f"Jellyfin create_user failed for {username}: {e}")
            raise MediaServerAPIError(f"Failed to create user {username}: {str(e)}")

    def update_user_policy(self, user_id: str, policy: Dict[str, Any]) -> None:
        """
        POST /Users/{userId}/Policy
        Configures parental ratings, playback privileges, transcoding limits, and folder access.
        """
        try:
            # Merge with current policy if needed
            current_user = self.get_user(user_id)
            current_policy = current_user.get('Policy', {})
            merged_policy = {**current_policy, **policy}

            url = f"{self.base_url}/Users/{user_id}/Policy"
            response = requests.post(url, headers=self._headers(), json=merged_policy, timeout=12)
            response.raise_for_status()
            logger.info(f"Updated policy for Jellyfin user: {user_id}")
        except requests.RequestException as e:
            logger.error(f"Failed to update policy for user {user_id}: {e}")
            raise MediaServerAPIError(f"Failed to update policy: {str(e)}")

    def set_user_libraries(self, user_id: str, library_ids: List[str]) -> None:
        """
        Restricts or allows specific media libraries for this user.
        """
        policy_patch = {
            'EnableAllFolders': False if library_ids else True,
            'EnabledFolders': library_ids or [],
        }
        self.update_user_policy(user_id, policy_patch)

    def disable_user(self, user_id: str) -> None:
        """
        Sets IsDisabled=True on Jellyfin policy, blocking login & playback.
        """
        self.update_user_policy(user_id, {'IsDisabled': True})
        logger.info(f"Disabled Jellyfin user account: {user_id}")

    def enable_user(self, user_id: str) -> None:
        """
        Restores access by setting IsDisabled=False.
        """
        self.update_user_policy(user_id, {'IsDisabled': False})
        logger.info(f"Enabled Jellyfin user account: {user_id}")

    def delete_user(self, user_id: str) -> None:
        """
        DELETE /Users/{userId}
        Permanently deletes user from the Jellyfin media server.
        """
        try:
            url = f"{self.base_url}/Users/{user_id}"
            response = requests.delete(url, headers=self._headers(), timeout=12)
            if response.status_code in (200, 204, 404):
                logger.info(f"Deleted Jellyfin user: {user_id}")
                return
            response.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Failed to delete Jellyfin user {user_id}: {e}")
            raise MediaServerAPIError(f"Could not delete user: {str(e)}")

    def update_user_password(self, user_id: str, new_password: str, reset_password: bool = False) -> None:
        """
        POST /Users/{userId}/Password
        Sets a new password for the user on Jellyfin.
        """
        try:
            url = f"{self.base_url}/Users/{user_id}/Password"
            payload = {
                'Id': user_id,
                'NewPw': new_password,
                'ResetPassword': reset_password,
            }
            response = requests.post(url, headers=self._headers(), json=payload, timeout=12)
            response.raise_for_status()
            logger.info(f"Rotated password for Jellyfin user {user_id}")
        except requests.RequestException as e:
            logger.error(f"Failed to update password for Jellyfin user {user_id}: {e}")
            raise MediaServerAPIError(f"Could not update password: {str(e)}")
