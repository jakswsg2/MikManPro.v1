"""
Phase 15: TMDB (The Movie Database) Connector
Supports Movies, TV Shows, Dual-Language (AR/EN) enrichment, External IDs lookup, and Rate Limiting.
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


class TMDBConnector(BaseMetadataProvider):
    """
    TMDB API v3 Connector with multi-language merging, rate limiting, and fallback handling.
    """
    provider_name = "tmdb"
    BASE_URL = "https://api.themoviedb.org/3"

    def __init__(
        self,
        api_key: Optional[str] = None,
        language: str = "ar",
        rate_limiter: Optional[TokenBucketRateLimiter] = None,
        timeout: int = 10,
        mock_mode: bool = False
    ):
        configured_key = api_key or getattr(settings, 'TMDB_API_KEY', '') or ""
        super().__init__(api_key=configured_key, language=language)
        self.timeout = timeout
        self.mock_mode = mock_mode or (not bool(self.api_key))
        self.rate_limiter = rate_limiter or TokenBucketRateLimiter(
            rate=40.0,
            capacity=50.0,
            max_retries=3,
            test_mode=self.mock_mode
        )

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "SmartLounge/1.0.0 (Media Metadata Engine)"
        }
        # If token is a JWT Bearer Token (v4 auth), use Authorization header
        if self.api_key and len(self.api_key) > 50:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Internal HTTP GET execution wrapped in TokenBucket rate limiter."""
        if self.mock_mode:
            return self._mock_request(endpoint, params)

        params = dict(params or {})
        # If API key is standard 32-char v3 key, pass as query param
        if self.api_key and len(self.api_key) <= 50:
            params["api_key"] = self.api_key

        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"

        def _do_get():
            return requests.get(
                url,
                headers=self._get_headers(),
                params=params,
                timeout=self.timeout
            )

        try:
            response = self.rate_limiter.execute_with_retry(_do_get)
            if response.status_code == 404:
                return {}
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"TMDB request failed for {endpoint}: {e}")
            raise MetadataConnectionError(f"TMDB connection error: {e}")

    def search(
        self,
        query: str,
        item_type: str = "movie",
        year: Optional[int] = None,
        language: str = "ar"
    ) -> List[Dict[str, Any]]:
        """Searches TMDB for movies or TV series."""
        if not query or not query.strip():
            return []

        endpoint = "search/movie" if item_type == "movie" else "search/tv"
        params: Dict[str, Any] = {
            "query": query.strip(),
            "language": language,
            "include_adult": "false"
        }
        if year:
            if item_type == "movie":
                params["year"] = year
            else:
                params["first_air_date_year"] = year

        data = self._request(endpoint, params)
        results = data.get("results", [])
        return results

    def get_details(
        self,
        external_id: str,
        item_type: str = "movie",
        language: str = "ar"
    ) -> Optional[Dict[str, Any]]:
        """Fetches full movie or series details by TMDB ID."""
        if not external_id:
            return None

        endpoint = f"movie/{external_id}" if item_type == "movie" else f"tv/{external_id}"
        params = {
            "language": language,
            "append_to_response": "credits,images,external_ids,keywords"
        }
        data = self._request(endpoint, params)
        return data if data and "id" in data else None

    def find_by_external_id(
        self,
        external_id: str,
        external_source: str = "imdb_id"
    ) -> Optional[Dict[str, Any]]:
        """Finds items by external ID (e.g. IMDb ID: tt1375666)."""
        if not external_id:
            return None

        endpoint = f"find/{external_id}"
        params = {"external_source": external_source}
        data = self._request(endpoint, params)

        # Look in movie_results, tv_results
        movie_results = data.get("movie_results", [])
        if movie_results:
            return {"type": "movie", "item": movie_results[0]}
        tv_results = data.get("tv_results", [])
        if tv_results:
            return {"type": "series", "item": tv_results[0]}
        return None

    def normalize(
        self,
        raw_data: Dict[str, Any],
        item_type: str = "movie",
        language: str = "ar"
    ) -> UnifiedMetadata:
        """Standardizes TMDB response into UnifiedMetadata."""
        if item_type == "series" or "first_air_date" in raw_data:
            return MetadataNormalizer.normalize_tmdb_series(raw_data, language=language)
        return MetadataNormalizer.normalize_tmdb_movie(raw_data, language=language)

    def fetch_dual_language_metadata(
        self,
        external_id: str,
        item_type: str = "movie"
    ) -> Optional[UnifiedMetadata]:
        """
        Fetches Arabic and English metadata, then merges them.
        Arabic takes precedence for display in Arab regions, with English fallbacks.
        """
        raw_ar = self.get_details(external_id, item_type=item_type, language="ar")
        raw_en = self.get_details(external_id, item_type=item_type, language="en")

        if not raw_ar and not raw_en:
            return None

        meta_en = self.normalize(raw_en or {}, item_type=item_type, language="en") if raw_en else None
        meta_ar = self.normalize(raw_ar or {}, item_type=item_type, language="ar") if raw_ar else None

        if meta_en and meta_ar:
            # Merge: Start with AR, blend EN for missing fields
            # Ensure EN title and overview are recorded in localized dicts
            if meta_en.title and "en" not in meta_ar.title_localized:
                meta_ar.title_localized["en"] = meta_en.title
            if meta_en.overview and "en" not in meta_ar.overview_localized:
                meta_ar.overview_localized["en"] = meta_en.overview
            if meta_en.tagline and "en" not in meta_ar.tagline_localized:
                meta_ar.tagline_localized["en"] = meta_en.tagline

            # If AR overview is empty, copy EN overview
            if not meta_ar.overview and meta_en.overview:
                meta_ar.overview = meta_en.overview

            # Merge external IDs and credits if missing in AR
            for k, v in meta_en.external_ids.items():
                if k not in meta_ar.external_ids:
                    meta_ar.external_ids[k] = v
            if not meta_ar.people and meta_en.people:
                meta_ar.people = meta_en.people

            return meta_ar

        return meta_ar or meta_en

    # =========================================================================
    # Offline & Mock Fallback Handler (for LAN lounges or test suites)
    # =========================================================================
    def _mock_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generates realistic responses when testing or running in air-gapped LAN."""
        params = params or {}
        query = params.get("query", "").lower()

        if "search" in endpoint:
            mock_id = 27205 if "inception" in query else 550
            mock_title = "Inception" if "inception" in query else "Fight Club"
            is_tv = "tv" in endpoint or "breaking" in query
            if is_tv:
                return {
                    "results": [{
                        "id": 1396,
                        "name": "Breaking Bad",
                        "original_name": "Breaking Bad",
                        "overview": "A chemistry teacher diagnosed with terminal lung cancer...",
                        "first_air_date": "2008-01-20",
                        "poster_path": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
                        "backdrop_path": "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
                        "vote_average": 8.9,
                        "vote_count": 14000
                    }]
                }
            return {
                "results": [{
                    "id": mock_id,
                    "title": mock_title,
                    "original_title": mock_title,
                    "overview": f"A high quality movie about {mock_title}.",
                    "release_date": "2010-07-16" if mock_id == 27205 else "1999-10-15",
                    "poster_path": "/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
                    "backdrop_path": "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
                    "vote_average": 8.4,
                    "vote_count": 35000
                }]
            }

        elif "movie/" in endpoint:
            movie_id = endpoint.split("/")[-1].split("?")[0]
            lang = params.get("language", "en")
            is_ar = lang.startswith("ar")
            title = "بداية (Inception)" if is_ar else "Inception"
            overview = "فيلم خيال علمي يدور حول غرس الأفكار داخل الأحلام." if is_ar else "A thief who steals corporate secrets through dream-sharing..."

            return {
                "id": int(movie_id) if movie_id.isdigit() else 27205,
                "title": title,
                "original_title": "Inception",
                "overview": overview,
                "tagline": "Your mind is the scene of the crime.",
                "release_date": "2010-07-16",
                "runtime": 148,
                "vote_average": 8.4,
                "vote_count": 35000,
                "poster_path": "/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
                "backdrop_path": "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
                "genres": [{"id": 28, "name": "Action"}, {"id": 878, "name": "Science Fiction"}],
                "imdb_id": "tt1375666",
                "external_ids": {"imdb_id": "tt1375666", "wikidata_id": "Q25188"},
                "credits": {
                    "cast": [
                        {"name": "Leonardo DiCaprio", "character": "Dom Cobb", "order": 0, "profile_path": "/wo2hxdaapJQi2hh12G885vd22R3.jpg"},
                        {"name": "Joseph Gordon-Levitt", "character": "Arthur", "order": 1, "profile_path": "/dhv95p4yG72G7163f.jpg"}
                    ],
                    "crew": [
                        {"name": "Christopher Nolan", "job": "Director", "profile_path": "/xuAIuYSmsUzKlUMBFGVZaWsY3Z5.jpg"},
                        {"name": "Hans Zimmer", "job": "Original Music Composer", "profile_path": "/tpQup1zLkyrNdtK4930.jpg"}
                    ]
                },
                "keywords": {"keywords": [{"name": "dream"}, {"name": "subconscious"}]}
            }

        elif "tv/" in endpoint:
            series_id = endpoint.split("/")[-1].split("?")[0]
            lang = params.get("language", "en")
            is_ar = lang.startswith("ar")
            title = "بريكينغ باد" if is_ar else "Breaking Bad"
            overview = "معلم كيمياء يتحول إلى تجارة المخدرات لتأمين عائلته." if is_ar else "A chemistry teacher diagnosed with inoperable lung cancer..."

            return {
                "id": int(series_id) if series_id.isdigit() else 1396,
                "name": title,
                "original_name": "Breaking Bad",
                "overview": overview,
                "tagline": "Change the equation.",
                "first_air_date": "2008-01-20",
                "episode_run_time": [47],
                "vote_average": 8.9,
                "vote_count": 14000,
                "poster_path": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
                "backdrop_path": "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
                "genres": [{"id": 18, "name": "Drama"}, {"id": 80, "name": "Crime"}],
                "external_ids": {"imdb_id": "tt0903747", "tvdb_id": 81189},
                "created_by": [{"name": "Vince Gilligan", "profile_path": "/creator.jpg"}],
                "credits": {
                    "cast": [
                        {"name": "Bryan Cranston", "character": "Walter White", "order": 0, "profile_path": "/bryan.jpg"},
                        {"name": "Aaron Paul", "character": "Jesse Pinkman", "order": 1, "profile_path": "/aaron.jpg"}
                    ]
                },
                "seasons": [
                    {"season_number": 1, "name": "الموسم 1", "episode_count": 7, "air_date": "2008-01-20", "poster_path": "/s1.jpg"},
                    {"season_number": 2, "name": "الموسم 2", "episode_count": 13, "air_date": "2009-03-08", "poster_path": "/s2.jpg"}
                ]
            }

        elif "find/" in endpoint:
            ext_id = endpoint.split("/")[-1].split("?")[0]
            return {
                "movie_results": [{
                    "id": 27205,
                    "title": "Inception",
                    "original_title": "Inception",
                    "release_date": "2010-07-16",
                    "poster_path": "/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg"
                }],
                "tv_results": []
            }

        return {}
