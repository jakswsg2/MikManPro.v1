from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseMediaServerConnector(ABC):
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Validates network connectivity, authentication key and extracts server metadata."""
        pass

    @abstractmethod
    def get_libraries(self) -> List[Dict[str, Any]]:
        """Returns media folders and categories (Movies, TV Shows, Kids, etc.)."""
        pass

    @abstractmethod
    def get_library_items(self, library_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns catalog items in a specific library."""
        pass

    def get_system_info(self) -> Dict[str, Any]:
        """Returns detailed system info (hardware, OS, version). Default returns test_connection()."""
        return self.test_connection()

    def get_system_status(self) -> Dict[str, Any]:
        """Returns server runtime metrics (sessions, transcode count)."""
        return {}

    def get_installed_plugins(self) -> List[Dict[str, Any]]:
        """Returns list of installed plugins on the media server."""
        return []

    def get_scheduled_tasks(self) -> List[Dict[str, Any]]:
        """Returns scheduled background tasks on the media server."""
        return []

    def get_playback_capabilities(self) -> Dict[str, Any]:
        """Returns hardware transcoding and media playback capabilities."""
        return {}
