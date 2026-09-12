import logging
from typing import Dict
from .jellyfin import JellyfinConnector

logger = logging.getLogger(__name__)

class EmbyConnector(JellyfinConnector):
    """
    Emby Media Server Connector.
    Inherits from JellyfinConnector, adapting Emby-specific header formats
    (X-MediaBrowser-Token) and API compatibility nuances.
    """

    def _headers(self) -> Dict[str, str]:
        return {
            'X-MediaBrowser-Token': self.api_key,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'SmartLounge-EmbyGateway/1.0',
        }
