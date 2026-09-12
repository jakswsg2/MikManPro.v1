from .base import BaseMediaServerConnector
from .jellyfin import JellyfinConnector
from .emby import EmbyConnector
from .exceptions import MediaServerError, UserNotFoundError

def get_connector(server) -> BaseMediaServerConnector:
    if server.server_type == 'emby':
        return EmbyConnector(server.local_url, server.api_key)
    return JellyfinConnector(server.local_url, server.api_key)
