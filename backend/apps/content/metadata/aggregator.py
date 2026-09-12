"""
Phase 15: Metadata Aggregator & Enrichment Orchestrator
Coordinates multi-provider lookups (TMDB, TVDB, MusicBrainz), dual-language merging (AR/EN),
caching, fallback chains, and MediaItem enrichment with audit logging.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from django.utils import timezone
from apps.content.models import (
    MediaItem, ExternalMetadata, ContentLifecycleLog
)
from apps.content.metadata.base import UnifiedMetadata, BaseMetadataProvider
from apps.content.metadata.tmdb import TMDBConnector
from apps.content.metadata.tvdb import TheTVDBConnector
from apps.content.metadata.musicbrainz import MusicBrainzConnector
from apps.content.metadata.cache import MetadataCacheManager

logger = logging.getLogger(__name__)


class MetadataAggregator:
    """
    Central Metadata Orchestrator.
    Manages provider priority, multi-language synthesis, caching and enrichment workflows.
    """

    def __init__(
        self,
        tmdb: Optional[TMDBConnector] = None,
        tvdb: Optional[TheTVDBConnector] = None,
        musicbrainz: Optional[MusicBrainzConnector] = None,
        cache_manager: Optional[MetadataCacheManager] = None
    ):
        self.tmdb = tmdb or TMDBConnector()
        self.tvdb = tvdb or TheTVDBConnector()
        self.musicbrainz = musicbrainz or MusicBrainzConnector()
        self.cache = cache_manager or MetadataCacheManager()

    def fetch_by_external_id(
        self,
        provider: str,
        external_id: str,
        item_type: str = "movie",
        languages: List[str] = None,
        force_refresh: bool = False
    ) -> Optional[UnifiedMetadata]:
        """
        Fetches metadata for a specific provider ID, utilizing cache and dual-language merging.
        """
        languages = languages or ["ar", "en"]
        primary_lang = languages[0] if languages else "ar"

        # 1. Check cache unless forced
        if not force_refresh:
            cached = self.cache.get_cached(provider, external_id, language=primary_lang)
            if cached:
                logger.debug(f"Cache hit for {provider}:{external_id} [{primary_lang}]")
                return cached

        # 2. Fetch from designated provider
        unified_result: Optional[UnifiedMetadata] = None

        if provider == "tmdb":
            # Use TMDB dual-language fetch
            unified_result = self.tmdb.fetch_dual_language_metadata(external_id, item_type=item_type)
            if unified_result:
                # Cache both languages
                self.cache.cache_metadata(
                    provider="tmdb",
                    external_id=external_id,
                    language=primary_lang,
                    raw_data=unified_result.raw_payload or {},
                    normalized_data=unified_result,
                    item_type=item_type
                )

        elif provider == "tvdb":
            raw = self.tvdb.get_details(external_id, item_type=item_type, language=primary_lang)
            if raw:
                unified_result = self.tvdb.normalize(raw, item_type=item_type, language=primary_lang)
                self.cache.cache_metadata(
                    provider="tvdb",
                    external_id=external_id,
                    language=primary_lang,
                    raw_data=raw,
                    normalized_data=unified_result,
                    item_type=item_type
                )

        elif provider == "musicbrainz":
            raw = self.musicbrainz.get_details(external_id, item_type=item_type)
            if raw:
                unified_result = self.musicbrainz.normalize(raw, item_type=item_type)
                self.cache.cache_metadata(
                    provider="musicbrainz",
                    external_id=external_id,
                    language="en",
                    raw_data=raw,
                    normalized_data=unified_result,
                    item_type=item_type
                )

        return unified_result

    def search_and_fetch(
        self,
        title: str,
        item_type: str = "movie",
        year: Optional[int] = None,
        languages: List[str] = None
    ) -> Optional[UnifiedMetadata]:
        """
        Searches across providers (TMDB -> TVDB -> MusicBrainz) using fallback strategy,
        then fetches full enriched metadata.
        """
        languages = languages or ["ar", "en"]

        if item_type in ["track", "album", "audio"]:
            results = self.musicbrainz.search(title, item_type="track" if item_type == "track" else "album")
            if results:
                top_id = results[0].get("id")
                return self.fetch_by_external_id("musicbrainz", top_id, item_type=item_type, languages=languages)
            return None

        # Try TMDB First
        tmdb_type = "series" if item_type == "series" else "movie"
        tmdb_results = self.tmdb.search(title, item_type=tmdb_type, year=year, language="en")
        if not tmdb_results and languages[0] != "en":
            tmdb_results = self.tmdb.search(title, item_type=tmdb_type, year=year, language=languages[0])

        if tmdb_results:
            top_id = str(tmdb_results[0].get("id"))
            meta = self.fetch_by_external_id("tmdb", top_id, item_type=tmdb_type, languages=languages)
            if meta:
                return meta

        # Fallback to TheTVDB for Series
        if item_type == "series":
            tvdb_results = self.tvdb.search(title, item_type="series", year=year)
            if tvdb_results:
                top_id = str(tvdb_results[0].get("id"))
                meta = self.fetch_by_external_id("tvdb", top_id, item_type="series", languages=languages)
                if meta:
                    return meta

        return None

    def enrich_media_item(
        self,
        media_item: MediaItem,
        force_refresh: bool = False,
        changed_by: str = "metadata_enricher"
    ) -> Tuple[bool, Optional[UnifiedMetadata], float]:
        """
        Enriches a MediaItem with external metadata:
        1. Checks for existing external IDs (tmdb, imdb, tvdb).
        2. If missing, searches by normalized title and year.
        3. Merges multi-language titles, overviews, artwork, credits, and taxonomy.
        4. Calculates new data quality score.
        5. Logs lifecycle transition.
        6. Preserves original_metadata untouched.
        Returns (success, enriched_metadata, new_quality_score).
        """
        media_item.enrichment_attempts = (media_item.enrichment_attempts or 0) + 1
        media_item.enrichment_status = MediaItem.EnrichmentStatus.IN_PROGRESS

        # Preserve original metadata if empty
        if not media_item.original_metadata:
            media_item.original_metadata = {
                "title": media_item.title,
                "original_title": media_item.original_title,
                "overview": media_item.overview,
                "year": media_item.year,
                "poster_url": media_item.poster_url,
                "backdrop_url": media_item.backdrop_url,
                "genres": list(media_item.genres or []),
                "provider_ids": dict(media_item.provider_ids or {})
            }

        item_type = media_item.item_type or "movie"
        ext_ids = dict(media_item.external_ids or media_item.provider_ids or {})
        enriched: Optional[UnifiedMetadata] = None

        try:
            # 1. Look up by TMDB ID if present
            if "tmdb" in ext_ids and ext_ids["tmdb"]:
                enriched = self.fetch_by_external_id(
                    "tmdb",
                    str(ext_ids["tmdb"]),
                    item_type=item_type,
                    force_refresh=force_refresh
                )

            # 2. Look up by IMDb ID via TMDB find
            if not enriched and "imdb" in ext_ids and ext_ids["imdb"]:
                found = self.tmdb.find_by_external_id(str(ext_ids["imdb"]), external_source="imdb_id")
                if found and "item" in found:
                    tmdb_id = str(found["item"].get("id"))
                    enriched = self.fetch_by_external_id(
                        "tmdb",
                        tmdb_id,
                        item_type=item_type,
                        force_refresh=force_refresh
                    )

            # 3. Look up by TVDB ID for series
            if not enriched and "tvdb" in ext_ids and ext_ids["tvdb"]:
                enriched = self.fetch_by_external_id(
                    "tvdb",
                    str(ext_ids["tvdb"]),
                    item_type=item_type,
                    force_refresh=force_refresh
                )

            # 4. Search by Title & Year if no external ID matched
            if not enriched:
                search_query = media_item.original_title or media_item.title
                enriched = self.search_and_fetch(
                    title=search_query,
                    item_type=item_type,
                    year=media_item.year
                )

            if not enriched:
                media_item.enrichment_status = MediaItem.EnrichmentStatus.FAILED
                media_item.enrichment_error = f"No metadata found on external providers for '{media_item.title}'"
                media_item.save(update_fields=["enrichment_status", "enrichment_attempts", "enrichment_error"])
                return False, None, media_item.data_quality_score

            # Apply Enriched Metadata
            # Localized Titles
            if enriched.title_localized:
                if not media_item.title_localized:
                    media_item.title_localized = {}
                for lang, val in enriched.title_localized.items():
                    if val:
                        media_item.title_localized[lang] = val
                # Set default title if empty
                if "ar" in media_item.title_localized and media_item.title_localized["ar"]:
                    media_item.title = media_item.title_localized["ar"]
                elif "en" in media_item.title_localized and media_item.title_localized["en"]:
                    media_item.title = media_item.title_localized["en"]

            # Localized Overviews
            if enriched.overview_localized:
                if not media_item.overview_localized:
                    media_item.overview_localized = {}
                for lang, val in enriched.overview_localized.items():
                    if val:
                        media_item.overview_localized[lang] = val
                if "ar" in media_item.overview_localized:
                    media_item.overview = media_item.overview_localized["ar"]
                elif "en" in media_item.overview_localized and not media_item.overview:
                    media_item.overview = media_item.overview_localized["en"]

            # Taglines
            if enriched.tagline_localized:
                if not media_item.tagline_localized:
                    media_item.tagline_localized = {}
                for lang, val in enriched.tagline_localized.items():
                    media_item.tagline_localized[lang] = val

            # Artwork
            if enriched.poster_url and not media_item.poster_url:
                media_item.poster_url = enriched.poster_url
            if enriched.backdrop_url and not media_item.backdrop_url:
                media_item.backdrop_url = enriched.backdrop_url

            # Taxonomy & Genres (Combine English + Arabic genres)
            if enriched.genres or enriched.genres_ar:
                existing_genres = set(media_item.genres or [])
                for g in enriched.genres:
                    existing_genres.add(g)
                for g in enriched.genres_ar:
                    existing_genres.add(g)
                media_item.genres = list(existing_genres)

            # People / Cast & Crew
            if enriched.people:
                media_item.people = enriched.people

            # External IDs
            if enriched.external_ids:
                if not media_item.external_ids:
                    media_item.external_ids = {}
                for k, v in enriched.external_ids.items():
                    media_item.external_ids[k] = str(v)
                media_item.provider_ids = dict(media_item.external_ids)

            # Specs
            if enriched.duration_minutes and not media_item.duration_minutes:
                media_item.duration_minutes = enriched.duration_minutes
            if enriched.year and not media_item.year:
                media_item.year = enriched.year
            if enriched.community_rating and not media_item.community_rating:
                media_item.community_rating = enriched.community_rating

            # Status & Timestamps
            media_item.enrichment_status = MediaItem.EnrichmentStatus.ENRICHED
            media_item.enrichment_error = ""
            media_item.last_enriched_at = timezone.now()

            # Recalculate Data Quality Score
            media_item.data_quality_score = media_item.calculate_data_quality_score()

            # Auto-approve if quality score >= 80 and status was INDEXED
            old_status = media_item.status
            if media_item.data_quality_score >= 80.0 and media_item.status in [
                MediaItem.ContentLifecycleStatus.INDEXED,
                MediaItem.ContentLifecycleStatus.PENDING
            ]:
                media_item.status = MediaItem.ContentLifecycleStatus.APPROVED

            media_item.save()

            # Record Lifecycle Log if status changed
            if old_status != media_item.status:
                try:
                    ContentLifecycleLog.objects.create(
                        media_item=media_item,
                        from_status=old_status,
                        to_status=media_item.status,
                        reason=f"Auto-approved via metadata enrichment (Quality Score: {media_item.data_quality_score}%)",
                        changed_by=changed_by,
                        details={
                            "data_quality_score": media_item.data_quality_score,
                            "external_ids": media_item.external_ids
                        }
                    )
                except Exception as log_err:
                    logger.warning(f"Could not write lifecycle log: {log_err}")

            return True, enriched, media_item.data_quality_score

        except Exception as e:
            logger.error(f"Enrichment exception for '{media_item.title}': {e}", exc_info=True)
            media_item.enrichment_status = MediaItem.EnrichmentStatus.FAILED
            media_item.enrichment_error = str(e)
            media_item.save(update_fields=["enrichment_status", "enrichment_error"])
            return False, None, media_item.data_quality_score
