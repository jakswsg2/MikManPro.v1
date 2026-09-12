"""
Phase 15: External Metadata Providers Architecture
Base interfaces, Unified Metadata Dataclass, and Provider Exceptions.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional
import json


class MetadataProviderError(Exception):
    """Base exception for all metadata provider errors."""
    pass


class RateLimitExceededError(MetadataProviderError):
    """Raised when provider rate limit is exceeded."""
    pass


class MetadataNotFoundError(MetadataProviderError):
    """Raised when requested item is not found in external provider."""
    pass


class MetadataConnectionError(MetadataProviderError):
    """Raised when external provider network connection fails."""
    pass


@dataclass
class UnifiedMetadata:
    """
    Standardized, normalized metadata representation across all providers
    (TMDB, TVDB, MusicBrainz, IMDb, etc.)
    """
    title: str = ""
    original_title: str = ""
    title_localized: Dict[str, str] = field(default_factory=dict)
    overview: str = ""
    overview_localized: Dict[str, str] = field(default_factory=dict)
    tagline: str = ""
    tagline_localized: Dict[str, str] = field(default_factory=dict)
    year: Optional[int] = None
    release_date: str = ""
    duration_minutes: int = 0
    item_type: str = "movie"  # movie, series, episode, track, album
    genres: List[str] = field(default_factory=list)
    genres_ar: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    content_rating: str = ""  # PG-13, TV-MA, R, G, 18+, 15, etc.
    community_rating: float = 0.0
    community_rating_count: int = 0
    poster_url: str = ""
    backdrop_url: str = ""
    logo_url: str = ""
    people: List[Dict[str, Any]] = field(default_factory=list)
    external_ids: Dict[str, str] = field(default_factory=dict)
    seasons: List[Dict[str, Any]] = field(default_factory=list)
    episodes: List[Dict[str, Any]] = field(default_factory=list)
    audio_languages: List[str] = field(default_factory=list)
    subtitle_languages: List[str] = field(default_factory=list)
    production_countries: List[str] = field(default_factory=list)
    production_companies: List[str] = field(default_factory=list)
    raw_payload: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Converts the dataclass to a plain dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UnifiedMetadata':
        """Constructs a UnifiedMetadata instance from a dictionary, ignoring unknown fields."""
        if not data:
            return cls()
        valid_fields = set(cls.__dataclass_fields__.keys())
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered)

    def get_title(self, lang: str = "ar") -> str:
        """Returns title in requested language with fallback to EN then original."""
        if self.title_localized and lang in self.title_localized and self.title_localized[lang]:
            return self.title_localized[lang]
        if self.title_localized and "en" in self.title_localized and self.title_localized["en"]:
            return self.title_localized["en"]
        return self.title or self.original_title or ""

    def get_overview(self, lang: str = "ar") -> str:
        """Returns overview in requested language with fallback to EN then default."""
        if self.overview_localized and lang in self.overview_localized and self.overview_localized[lang]:
            return self.overview_localized[lang]
        if self.overview_localized and "en" in self.overview_localized and self.overview_localized["en"]:
            return self.overview_localized["en"]
        return self.overview or ""

    def merge_with(self, other: 'UnifiedMetadata', overwrite: bool = False) -> 'UnifiedMetadata':
        """
        Merges another UnifiedMetadata into this one.
        If overwrite is False, existing non-empty values are preserved.
        Dictionaries (like title_localized, external_ids) are combined.
        Lists (like genres, people, tags) are deduped.
        """
        if not other:
            return self

        # Localized dicts
        for lang, val in (other.title_localized or {}).items():
            if val and (overwrite or lang not in self.title_localized or not self.title_localized[lang]):
                self.title_localized[lang] = val

        for lang, val in (other.overview_localized or {}).items():
            if val and (overwrite or lang not in self.overview_localized or not self.overview_localized[lang]):
                self.overview_localized[lang] = val

        for lang, val in (other.tagline_localized or {}).items():
            if val and (overwrite or lang not in self.tagline_localized or not self.tagline_localized[lang]):
                self.tagline_localized[lang] = val

        # External IDs
        for k, v in (other.external_ids or {}).items():
            if v and (overwrite or k not in self.external_ids or not self.external_ids[k]):
                self.external_ids[k] = str(v)

        # Basic scalar fields
        scalar_fields = [
            'title', 'original_title', 'overview', 'tagline', 'year',
            'release_date', 'duration_minutes', 'item_type', 'content_rating',
            'community_rating', 'community_rating_count', 'poster_url',
            'backdrop_url', 'logo_url'
        ]
        for field_name in scalar_fields:
            other_val = getattr(other, field_name, None)
            curr_val = getattr(self, field_name, None)
            if other_val:
                if overwrite or not curr_val:
                    setattr(self, field_name, other_val)

        # List fields (deduplicate while preserving order)
        list_fields = [
            'genres', 'genres_ar', 'tags', 'audio_languages',
            'subtitle_languages', 'production_countries', 'production_companies'
        ]
        for field_name in list_fields:
            other_list = getattr(other, field_name, []) or []
            curr_list = getattr(self, field_name, []) or []
            for item in other_list:
                if item and item not in curr_list:
                    curr_list.append(item)
            setattr(self, field_name, curr_list)

        # People list merging (deduplicate by name + role)
        if other.people:
            existing_keys = {
                f"{p.get('name', '')}:{p.get('role', '')}".lower()
                for p in self.people
            }
            for p in other.people:
                key = f"{p.get('name', '')}:{p.get('role', '')}".lower()
                if key not in existing_keys:
                    self.people.append(p)
                    existing_keys.add(key)

        # Seasons & Episodes
        if other.seasons and (overwrite or not self.seasons):
            self.seasons = other.seasons
        if other.episodes and (overwrite or not self.episodes):
            self.episodes = other.episodes

        return self


class BaseMetadataProvider(ABC):
    """
    Abstract Base Class for all external metadata providers (TMDB, TVDB, MusicBrainz, etc.).
    """
    provider_name: str = "base"

    def __init__(self, api_key: str = "", language: str = "ar", **kwargs):
        self.api_key = api_key
        self.default_language = language

    @abstractmethod
    def search(
        self,
        query: str,
        item_type: str = "movie",
        year: Optional[int] = None,
        language: str = "ar"
    ) -> List[Dict[str, Any]]:
        """Searches the provider for items matching the title query and optional year."""
        pass

    @abstractmethod
    def get_details(
        self,
        external_id: str,
        item_type: str = "movie",
        language: str = "ar"
    ) -> Optional[Dict[str, Any]]:
        """Fetches full metadata details for a specific item by provider's ID."""
        pass

    @abstractmethod
    def normalize(
        self,
        raw_data: Dict[str, Any],
        item_type: str = "movie",
        language: str = "ar"
    ) -> UnifiedMetadata:
        """Transforms raw provider response into a standard UnifiedMetadata instance."""
        pass

    def find_by_external_id(
        self,
        external_id: str,
        external_source: str = "imdb_id"
    ) -> Optional[Dict[str, Any]]:
        """Optional lookup by cross-referenced external identifier (e.g. IMDb ID)."""
        return None
