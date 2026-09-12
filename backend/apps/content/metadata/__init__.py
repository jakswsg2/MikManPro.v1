"""
Phase 15: External Metadata Package
Unified multi-provider connectors (TMDB, TVDB, MusicBrainz), Rate Limiters, Normalizers,
Caching layer and Aggregator.
"""
from apps.content.metadata.base import (
    BaseMetadataProvider,
    UnifiedMetadata,
    MetadataProviderError,
    RateLimitExceededError,
    MetadataNotFoundError,
    MetadataConnectionError
)
from apps.content.metadata.rate_limiter import TokenBucketRateLimiter
from apps.content.metadata.normalizer import MetadataNormalizer
from apps.content.metadata.tmdb import TMDBConnector
from apps.content.metadata.tvdb import TheTVDBConnector
from apps.content.metadata.musicbrainz import MusicBrainzConnector
from apps.content.metadata.cache import MetadataCacheManager
from apps.content.metadata.aggregator import MetadataAggregator

__all__ = [
    "BaseMetadataProvider",
    "UnifiedMetadata",
    "MetadataProviderError",
    "RateLimitExceededError",
    "MetadataNotFoundError",
    "MetadataConnectionError",
    "TokenBucketRateLimiter",
    "MetadataNormalizer",
    "TMDBConnector",
    "TheTVDBConnector",
    "MusicBrainzConnector",
    "MetadataCacheManager",
    "MetadataAggregator",
]
