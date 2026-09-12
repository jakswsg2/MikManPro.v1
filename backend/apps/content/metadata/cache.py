"""
Phase 15: Metadata Cache Manager
Handles persistence and caching of raw & normalized metadata in ExternalMetadata model
with 30-day TTL, SHA256 data hashing, and stale-entry resilience.
"""
import hashlib
import json
import logging
from datetime import timedelta
from typing import Dict, Any, Optional
from django.utils import timezone
from apps.content.models import ExternalMetadata, MediaItem
from apps.content.metadata.base import UnifiedMetadata

logger = logging.getLogger(__name__)


class MetadataCacheManager:
    """
    Manages caching of external metadata payloads with TTL, hashing and validation.
    """
    DEFAULT_TTL_DAYS = 30

    @classmethod
    def compute_hash(cls, data: Dict[str, Any]) -> str:
        """Computes a deterministic SHA256 hex digest for JSON-serializable dictionary."""
        try:
            serialized = json.dumps(data, sort_keys=True, default=str)
            return hashlib.sha256(serialized.encode('utf-8')).hexdigest()
        except Exception:
            return ""

    @classmethod
    def get_cached(
        cls,
        provider: str,
        external_id: str,
        language: str = "ar",
        allow_stale: bool = False
    ) -> Optional[UnifiedMetadata]:
        """
        Retrieves normalized metadata from ExternalMetadata if cached and not expired.
        If allow_stale is True, returns cached data even if expired.
        """
        if not external_id or not provider:
            return None

        try:
            record = ExternalMetadata.objects.filter(
                provider=provider,
                external_id=str(external_id),
                language=language,
                is_valid=True
            ).first()

            if not record:
                return None

            # Check expiration
            if not allow_stale and record.is_stale():
                logger.debug(f"Cached metadata expired for {provider}:{external_id} [{language}]")
                return None

            if record.normalized_data:
                return UnifiedMetadata.from_dict(record.normalized_data)

        except Exception as e:
            logger.warning(f"Failed to retrieve cached metadata for {provider}:{external_id}: {e}")

        return None

    @classmethod
    def cache_metadata(
        cls,
        provider: str,
        external_id: str,
        language: str,
        raw_data: Dict[str, Any],
        normalized_data: UnifiedMetadata,
        media_item: Optional[MediaItem] = None,
        item_type: str = "movie",
        ttl_days: int = DEFAULT_TTL_DAYS
    ) -> Optional[ExternalMetadata]:
        """
        Persists raw and normalized metadata into ExternalMetadata model.
        """
        if not provider or not external_id:
            return None

        try:
            expires_at = timezone.now() + timedelta(days=ttl_days)
            data_hash = cls.compute_hash(raw_data)
            norm_dict = normalized_data.to_dict() if hasattr(normalized_data, 'to_dict') else dict(normalized_data)

            record, created = ExternalMetadata.objects.update_or_create(
                provider=provider,
                external_id=str(external_id),
                language=language,
                defaults={
                    "media_item": media_item,
                    "item_type": item_type,
                    "raw_data": raw_data,
                    "normalized_data": norm_dict,
                    "fetched_at": timezone.now(),
                    "expires_at": expires_at,
                    "is_valid": True,
                    "data_hash": data_hash
                }
            )
            return record
        except Exception as e:
            logger.error(f"Failed to cache metadata for {provider}:{external_id}: {e}")
            return None

    @classmethod
    def invalidate(
        cls,
        provider: str,
        external_id: str,
        language: Optional[str] = None
    ) -> int:
        """Invalidates (deletes or marks invalid) cached metadata for an item."""
        try:
            qs = ExternalMetadata.objects.filter(provider=provider, external_id=str(external_id))
            if language:
                qs = qs.filter(language=language)
            count = qs.update(is_valid=False)
            return count
        except Exception as e:
            logger.error(f"Failed to invalidate cache for {provider}:{external_id}: {e}")
            return 0
