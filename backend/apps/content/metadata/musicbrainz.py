"""
Phase 15: MusicBrainz Metadata Connector
Supports Artists, Albums (Release Groups), Tracks (Recordings) with strict 1 req/sec rate limit.
"""
import logging
import requests
from typing import Dict, Any, List, Optional
from apps.content.metadata.base import (
    BaseMetadataProvider, UnifiedMetadata,
    MetadataNotFoundError, MetadataConnectionError
)
from apps.content.metadata.rate_limiter import TokenBucketRateLimiter
from apps.content.metadata.normalizer import MetadataNormalizer

logger = logging.getLogger(__name__)


class MusicBrainzConnector(BaseMetadataProvider):
    """
    MusicBrainz API v2 Connector.
    Mandates strict 1 request per second and descriptive User-Agent header.
    """
    provider_name = "musicbrainz"
    BASE_URL = "https://musicbrainz.org/ws/2"

    def __init__(
        self,
        rate_limiter: Optional[TokenBucketRateLimiter] = None,
        timeout: int = 10,
        mock_mode: bool = False
    ):
        super().__init__(api_key="", language="en")
        self.timeout = timeout
        self.mock_mode = mock_mode
        # Strict 1 req/sec rate limiter per MusicBrainz API policy
        self.rate_limiter = rate_limiter or TokenBucketRateLimiter(
            rate=1.0,
            capacity=1.0,
            max_retries=3,
            test_mode=self.mock_mode
        )

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Accept": "application/json",
            "User-Agent": "SmartLounge/1.0.0 ( contact@smartlounge.local )"
        }

    def _request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Executes GET request respecting the 1 request/sec rate limiter."""
        if self.mock_mode:
            return self._mock_request(endpoint, params)

        params = dict(params or {})
        params["fmt"] = "json"
        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"

        def _do_get():
            return requests.get(url, headers=self._get_headers(), params=params, timeout=self.timeout)

        try:
            response = self.rate_limiter.execute_with_retry(_do_get)
            if response.status_code == 404:
                return {}
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"MusicBrainz request failed for {endpoint}: {e}")
            raise MetadataConnectionError(f"MusicBrainz connection error: {e}")

    def search(
        self,
        query: str,
        item_type: str = "track",
        year: Optional[int] = None,
        language: str = "en"
    ) -> List[Dict[str, Any]]:
        """Searches MusicBrainz for recordings (tracks) or release-groups (albums)."""
        if not query:
            return []

        entity = "recording" if item_type == "track" else "release-group"
        search_query = f'"{query}"'
        data = self._request(entity, {"query": search_query})

        if entity == "recording":
            return data.get("recordings", [])
        return data.get("release-groups", [])

    def get_details(
        self,
        external_id: str,
        item_type: str = "track",
        language: str = "en"
    ) -> Optional[Dict[str, Any]]:
        """Fetches recording or release-group details with artist credits."""
        if not external_id:
            return None

        entity = "recording" if item_type == "track" else "release-group"
        inc = "artist-credits+releases" if entity == "recording" else "artist-credits+releases+genres"
        data = self._request(f"{entity}/{external_id}", {"inc": inc})
        return data

    def normalize(
        self,
        raw_data: Dict[str, Any],
        item_type: str = "track",
        language: str = "en"
    ) -> UnifiedMetadata:
        """Transforms MusicBrainz JSON into UnifiedMetadata."""
        title = raw_data.get("title") or ""
        mbid = str(raw_data.get("id") or "")

        # Artists
        artists = []
        artist_names = []
        for credit in raw_data.get("artist-credit", []):
            artist = credit.get("artist", {})
            name = artist.get("name") or credit.get("name")
            if name:
                artist_names.append(name)
                artists.append({"name": name, "role": "Artist", "mbid": artist.get("id")})

        artist_str = ", ".join(artist_names)
        full_title = f"{title} - {artist_str}" if artist_str else title

        # Duration (in ms)
        length_ms = raw_data.get("length") or 0
        duration_min = round(length_ms / 60000)

        # Release year
        year = None
        first_release = raw_data.get("first-release-date") or ""
        if first_release:
            year = MetadataNormalizer.extract_year(first_release)

        ext_ids = {"musicbrainz": mbid}

        return UnifiedMetadata(
            title=title,
            original_title=full_title,
            title_localized={language: title},
            year=year,
            duration_minutes=duration_min,
            item_type=item_type,
            people=artists,
            external_ids=ext_ids,
            raw_payload=raw_data
        )

    def _mock_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Mock responses for music queries."""
        params = params or {}
        query = params.get("query", "Fairuz")

        if "recording" in endpoint:
            return {
                "recordings": [{
                    "id": "c1f7b4e9-1234-5678-9abc-def012345678",
                    "title": "Nassim Al-Roh",
                    "length": 245000,
                    "first-release-date": "1978-01-01",
                    "artist-credit": [{"name": "Fairuz", "artist": {"name": "Fairuz", "id": "fairuz-mbid"}}]
                }]
            }
        return {}
