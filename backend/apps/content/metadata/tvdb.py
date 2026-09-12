"""
Phase 15: TheTVDB (TV Database) Connector
Supports TV Series, Seasons, Episodes, Artwork, and Extended Metadata.
"""
import logging
import requests
from typing import Dict, Any, List, Optional
from django.conf import settings
from apps.content.metadata.base import (
    BaseMetadataProvider, UnifiedMetadata,
    MetadataNotFoundError, MetadataConnectionError
)
from apps.content.metadata.rate_limiter import TokenBucketRateLimiter
from apps.content.metadata.normalizer import MetadataNormalizer

logger = logging.getLogger(__name__)


class TheTVDBConnector(BaseMetadataProvider):
    """
    TheTVDB API v4 Connector with Bearer token authentication, rate limiting and normalization.
    """
    provider_name = "tvdb"
    BASE_URL = "https://api4.thetvdb.com/v4"

    def __init__(
        self,
        api_key: Optional[str] = None,
        language: str = "ar",
        rate_limiter: Optional[TokenBucketRateLimiter] = None,
        timeout: int = 10,
        mock_mode: bool = False
    ):
        configured_key = api_key or getattr(settings, 'TVDB_API_KEY', '') or ""
        super().__init__(api_key=configured_key, language=language)
        self.timeout = timeout
        self.mock_mode = mock_mode or (not bool(self.api_key))
        self.bearer_token: Optional[str] = None
        self.rate_limiter = rate_limiter or TokenBucketRateLimiter(
            rate=20.0,
            capacity=30.0,
            max_retries=3,
            test_mode=self.mock_mode
        )

    def _login(self) -> bool:
        """Authenticates with TheTVDB v4 API to obtain a JWT bearer token."""
        if self.mock_mode or not self.api_key:
            return False

        url = f"{self.BASE_URL}/login"
        payload = {"apikey": self.api_key}
        try:
            resp = requests.post(url, json=payload, timeout=self.timeout)
            if resp.status_code == 200:
                data = resp.json()
                self.bearer_token = data.get("data", {}).get("token")
                return True
        except Exception as e:
            logger.warning(f"TheTVDB login failed: {e}")
        return False

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "SmartLounge/1.0.0 (Media Metadata Engine)"
        }
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"
        return headers

    def _request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Internal HTTP GET wrapped in rate limiter with token refresh."""
        if self.mock_mode:
            return self._mock_request(endpoint, params)

        if not self.bearer_token:
            if not self._login():
                return {}

        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"

        def _do_get():
            return requests.get(url, headers=self._get_headers(), params=params, timeout=self.timeout)

        try:
            response = self.rate_limiter.execute_with_retry(_do_get)
            if response.status_code == 401:
                # Token expired, retry login once
                if self._login():
                    response = self.rate_limiter.execute_with_retry(_do_get)
            if response.status_code == 404:
                return {}
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"TheTVDB request failed for {endpoint}: {e}")
            raise MetadataConnectionError(f"TheTVDB connection error: {e}")

    def search(
        self,
        query: str,
        item_type: str = "series",
        year: Optional[int] = None,
        language: str = "ar"
    ) -> List[Dict[str, Any]]:
        """Searches TVDB for series or movies."""
        if not query:
            return []

        params: Dict[str, Any] = {"query": query, "type": item_type}
        if year:
            params["year"] = year

        data = self._request("search", params)
        return data.get("data", [])

    def get_details(
        self,
        external_id: str,
        item_type: str = "series",
        language: str = "ar"
    ) -> Optional[Dict[str, Any]]:
        """Fetches extended series or movie details."""
        if not external_id:
            return None

        endpoint = f"series/{external_id}/extended" if item_type == "series" else f"movies/{external_id}/extended"
        data = self._request(endpoint)
        return data.get("data")

    def normalize(
        self,
        raw_data: Dict[str, Any],
        item_type: str = "series",
        language: str = "ar"
    ) -> UnifiedMetadata:
        """Transforms TVDB payload into UnifiedMetadata."""
        name = raw_data.get("name") or ""
        original_name = raw_data.get("originalName") or name
        overview = raw_data.get("overview") or ""
        year = MetadataNormalizer.extract_year(raw_data.get("firstAired") or raw_data.get("year"))

        genres = [g.get("name") for g in raw_data.get("genres", []) if g.get("name")]
        genres_ar = MetadataNormalizer.map_genres_to_arabic(genres)

        poster = raw_data.get("image") or ""
        score = float(raw_data.get("score") or 0.0)

        # External IDs
        ext_ids = {"tvdb": str(raw_data.get("id", ""))}
        for remote in raw_data.get("remoteIds", []):
            src_name = remote.get("sourceName", "").lower()
            if "imdb" in src_name:
                ext_ids["imdb"] = str(remote.get("id"))
            elif "tmdb" in src_name:
                ext_ids["tmdb"] = str(remote.get("id"))

        # Cast / Characters
        people = []
        for char in raw_data.get("characters", [])[:15]:
            people.append({
                "name": char.get("personName") or char.get("name"),
                "role": "Actor",
                "character": char.get("name", ""),
                "profile_path": char.get("image", "")
            })

        return UnifiedMetadata(
            title=name,
            original_title=original_name,
            title_localized={language: name},
            overview=overview,
            overview_localized={language: overview} if overview else {},
            year=year,
            item_type=item_type,
            genres=genres,
            genres_ar=genres_ar,
            community_rating=score,
            poster_url=poster,
            people=people,
            external_ids=ext_ids,
            raw_payload=raw_data
        )

    def _mock_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Provides simulated responses when running without internet or credentials."""
        params = params or {}
        query = params.get("query", "Game of Thrones")

        if "search" in endpoint:
            return {
                "data": [{
                    "id": 121361,
                    "name": query.title(),
                    "overview": "A grand fantasy epic series.",
                    "year": "2011",
                    "image": "https://artworks.thetvdb.com/banners/posters/121361-1.jpg"
                }]
            }
        elif "extended" in endpoint:
            return {
                "data": {
                    "id": 121361,
                    "name": "Game of Thrones",
                    "originalName": "Game of Thrones",
                    "overview": "Seven noble families fight for control of the mythical land of Westeros.",
                    "firstAired": "2011-04-17",
                    "score": 9.3,
                    "image": "https://artworks.thetvdb.com/banners/posters/121361-1.jpg",
                    "genres": [{"name": "Drama"}, {"name": "Fantasy"}, {"name": "Adventure"}],
                    "remoteIds": [
                        {"sourceName": "IMDB", "id": "tt0944947"},
                        {"sourceName": "TheMovieDB.com", "id": "1399"}
                    ],
                    "characters": [
                        {"personName": "Peter Dinklage", "name": "Tyrion Lannister", "image": "https://artworks.thetvdb.com/banners/person/dinklage.jpg"},
                        {"personName": "Emilia Clarke", "name": "Daenerys Targaryen", "image": "https://artworks.thetvdb.com/banners/person/clarke.jpg"}
                    ]
                }
            }
        return {}
