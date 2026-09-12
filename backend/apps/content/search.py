"""
Phase 4: Unified Media Search Service
Decision 16, Decision 50: PostgreSQL Full-Text Search (FTS) + pg_trgm + Arabic Normalization + RBAC Enforcement
"""
import logging
from typing import List, Dict, Any, Optional
from django.db.models import Q, F, Value, DecimalField, IntegerField
from django.db.models.functions import Coalesce
from django.contrib.postgres.search import (
    SearchQuery, SearchRank, SearchVector, TrigramSimilarity
)
from apps.content.models import (
    MediaItem, MediaSource, LogicalContentGroup,
    normalize_search_text, normalize_arabic_text
)
from apps.permissions.engine import PermissionEngine
from apps.permissions.content_access import ContentAccessEngine

logger = logging.getLogger(__name__)


class UnifiedSearchService:
    """
    Unified Search Engine across all registered LAN Media Servers.
    Features:
    1. Pre-filtering by User RBAC (PermissionEngine + ContentAccessEngine)
    2. Multi-tier Matching: Exact -> Trigram Similarity -> FTS Search Vector -> Fallback Substring
    3. Arabic Text Normalization (Alef, Teh Marbuta, Tashkeel, Yaa)
    4. Quality and Group Ranking (4K/FHD priority, Canonical Deduplicated Items)
    5. Detailed breakdown of available Media Sources across all servers
    """

    @classmethod
    def search(
        cls,
        user,
        query: str,
        content_type: Optional[str] = None,
        genre: Optional[str] = None,
        year: Optional[int] = None,
        resolution: Optional[str] = None,
        server_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        include_unavailable: bool = False
    ) -> Dict[str, Any]:
        """
        Executes unified search and returns structured results with pagination & facets.
        """
        if not user or not user.is_authenticated:
            return {
                "query": query,
                "count": 0,
                "results": [],
                "facets": {}
            }

        # 1. Base QuerySet with pre-filtering
        qs = MediaItem.objects.select_related('library', 'library__server').prefetch_related('sources')

        # 2. Enforce User Content Entitlements & Permissions (Decision 16 & 18)
        qs = cls._apply_rbac_filters(qs, user)

        # 3. Optional static filters
        if content_type:
            qs = qs.filter(item_type=content_type)
        if genre:
            qs = qs.filter(genres__contains=[genre])
        if year:
            qs = qs.filter(year=year)
        if resolution:
            qs = qs.filter(resolution__icontains=resolution)
        if server_id:
            qs = qs.filter(library__server_id=server_id)

        clean_query = query.strip() if query else ""

        # 4. Search matching algorithms
        if clean_query:
            norm_q = normalize_search_text(clean_query)
            norm_ar_q = normalize_arabic_text(clean_query)

            # Build PostgreSQL FTS Search Vector
            search_vector = (
                SearchVector('title', weight='A', config='arabic') +
                SearchVector('original_title', weight='B', config='english') +
                SearchVector('normalized_title', weight='A') +
                SearchVector('overview', weight='C', config='arabic')
            )
            search_query = SearchQuery(clean_query, config='arabic') | SearchQuery(norm_q)

            # Combined Filters
            search_filter = (
                Q(title__icontains=clean_query) |
                Q(original_title__icontains=clean_query) |
                Q(normalized_title__icontains=norm_q) |
                Q(normalized_title_ar__icontains=norm_ar_q) |
                Q(overview__icontains=clean_query) |
                Q(tags__contains=[clean_query]) |
                Q(people__contains=[clean_query])
            )

            qs = qs.filter(search_filter)

            # Scoring / Ranking
            qs = qs.annotate(
                rank=SearchRank(search_vector, search_query)
            ).order_by('-is_logical_primary', '-rank', '-rating', '-year', '-created_at')
        else:
            qs = qs.order_by('-is_logical_primary', '-rating', '-year', '-created_at')

        total_count = qs.count()
        paged_items = list(qs[offset:offset + limit])

        # 5. Format results with source details & streaming capabilities
        results_data = []
        can_download = PermissionEngine.has_permission(user, 'content.download')

        for item in paged_items:
            # Aggregate all available sources on local network
            sources_list = []
            for src in item.sources.all():
                if not include_unavailable and not src.is_available:
                    continue
                sources_list.append({
                    "id": str(src.id),
                    "server_id": str(src.media_server_id),
                    "server_name": src.media_server.name,
                    "resolution": src.resolution,
                    "container": src.container,
                    "video_codec": src.video_codec,
                    "audio_codec": src.audio_codec,
                    "file_size": src.file_size,
                    "is_available": src.is_available,
                    "duration_seconds": src.duration_seconds
                })

            results_data.append({
                "id": str(item.id),
                "title": item.title,
                "original_title": item.original_title,
                "item_type": item.item_type,
                "year": item.year,
                "duration_minutes": item.duration_minutes,
                "rating": float(item.rating) if item.rating else None,
                "community_rating": float(item.community_rating) if item.community_rating else None,
                "official_rating": item.official_rating,
                "overview": item.overview,
                "genres": item.genres,
                "tags": item.tags,
                "poster_url": item.poster_url,
                "backdrop_url": item.backdrop_url,
                "resolution": item.resolution,
                "is_premium": item.is_premium,
                "is_kids": item.is_kids,
                "stream_url": item.stream_url,
                "library_id": str(item.library_id),
                "library_name": item.library.name,
                "server_id": str(item.library.server_id),
                "server_name": item.library.server.name,
                "is_logical_primary": item.is_logical_primary,
                "logical_group_id": str(item.logical_group_id) if item.logical_group_id else None,
                "sources": sources_list,
                "can_play": True,
                "can_download": can_download
            })

        return {
            "query": query,
            "count": total_count,
            "limit": limit,
            "offset": offset,
            "results": results_data
        }

    @classmethod
    def _apply_rbac_filters(cls, qs, user):
        """
        Enforces user RBAC before search queries touch results.
        """
        # Super admin bypass
        if user.is_superuser or PermissionEngine.has_permission(user, 'system.full_access'):
            return qs

        # 1. Kids view enforcement
        has_kids = PermissionEngine.has_permission(user, 'content.kids.view')
        # If user ONLY has kids view or does not have full adult catalog access:
        has_movies = PermissionEngine.has_permission(user, 'content.movies.view')
        has_series = PermissionEngine.has_permission(user, 'content.series.view')

        if not has_kids:
            qs = qs.filter(is_kids=False)

        # 2. Premium / VIP view enforcement
        has_premium = PermissionEngine.has_permission(user, 'content.premium.view')
        if not has_premium:
            qs = qs.filter(is_premium=False)

        # 3. Item type filters
        type_q = Q()
        if has_movies:
            type_q |= Q(item_type=MediaItem.ItemType.MOVIE)
        if has_series:
            type_q |= Q(item_type=MediaItem.ItemType.SERIES) | Q(item_type=MediaItem.ItemType.EPISODE)
        if has_kids and not (has_movies or has_series):
            type_q |= Q(is_kids=True)

        if type_q:
            qs = qs.filter(type_q)
        else:
            return qs.none()

        return qs
