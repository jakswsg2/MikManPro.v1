"""
Phase 16: Faceted Search & Aggregations Service
Computes exact facet distributions and dynamic numerical/temporal buckets (genres, types, resolutions, years, ratings).
"""
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.db.models import Count, Min, Max, Q
from django.core.cache import cache


class SearchFacetService:
    """
    Computes facets and aggregation metrics across search result sets.
    """

    def calculate_facets(
        self,
        base_qs,
        query: str = "",
        current_filters: Optional[Dict[str, Any]] = None,
        requested_facets: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Calculates facet counts for the provided filtered queryset.
        """
        requested = requested_facets or [
            'type', 'genres', 'year', 'language', 'quality', 'rating', 'audience'
        ]
        facets: Dict[str, Any] = {}

        if 'type' in requested:
            facets['type'] = self._facet_type(base_qs)

        if 'genres' in requested:
            facets['genres'] = self._facet_genres(base_qs)

        if 'year' in requested:
            facets['year'] = self._facet_year(base_qs)

        if 'language' in requested:
            facets['language'] = self._facet_language(base_qs)

        if 'quality' in requested:
            facets['quality'] = self._facet_quality(base_qs)

        if 'rating' in requested:
            facets['rating'] = self._facet_rating(base_qs)

        if 'audience' in requested:
            facets['audience'] = self._facet_audience(base_qs)

        return facets

    def _facet_type(self, qs) -> List[Dict[str, Any]]:
        """Counts by media item type (MOVIE, SERIES, EPISODE, TRACK, etc.)."""
        type_counts = qs.values('item_type').annotate(
            count=Count('id')
        ).order_by('-count')
        return [{'key': row['item_type'], 'label': row['item_type'], 'count': row['count']} for row in type_counts]

    def _facet_genres(self, qs, limit: int = 20) -> List[Dict[str, Any]]:
        """Aggregates counts for array-based genres."""
        genre_freq: Dict[str, int] = {}
        # Fetch genres from queryset items efficiently
        sample_items = qs.values_list('genres', flat=True)[:500]
        for genre_list in sample_items:
            if isinstance(genre_list, list):
                for g in genre_list:
                    if g:
                        genre_freq[g] = genre_freq.get(g, 0) + 1

        sorted_genres = sorted(genre_freq.items(), key=lambda x: x[1], reverse=True)[:limit]
        return [{'key': g, 'label': g, 'count': count} for g, count in sorted_genres]

    def _facet_year(self, qs) -> Dict[str, Any]:
        """Aggregates year range and 5-year bucket counts."""
        stats = qs.aggregate(min_year=Min('year'), max_year=Max('year'))
        current_year = timezone.now().year
        min_year = stats.get('min_year') or 1990
        max_year = stats.get('max_year') or current_year

        buckets = []
        for start in range(2000, current_year + 1, 5):
            end = start + 4
            count = qs.filter(year__gte=start, year__lte=end).count()
            if count > 0:
                buckets.append({
                    'range': f"{start}-{end}",
                    'min': start,
                    'max': end,
                    'count': count
                })

        older_count = qs.filter(year__lt=2000).count()
        if older_count > 0:
            buckets.insert(0, {
                'range': "Before 2000",
                'min': min_year,
                'max': 1999,
                'count': older_count
            })

        return {
            'min': min_year,
            'max': max_year,
            'buckets': buckets,
        }

    def _facet_language(self, qs) -> List[Dict[str, Any]]:
        """Counts by original language."""
        lang_counts = qs.exclude(
            original_language__isnull=True
        ).exclude(
            original_language=''
        ).values('original_language').annotate(
            count=Count('id')
        ).order_by('-count')[:15]
        return [{'key': row['original_language'], 'label': row['original_language'].upper(), 'count': row['count']} for row in lang_counts]

    def _facet_quality(self, qs) -> List[Dict[str, Any]]:
        """Counts by resolution / quality from media items or sources."""
        quality_counts = qs.exclude(
            resolution__isnull=True
        ).exclude(
            resolution=''
        ).values('resolution').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        return [{'key': row['resolution'], 'label': row['resolution'], 'count': row['count']} for row in quality_counts]

    def _facet_rating(self, qs) -> Dict[str, Any]:
        """Distributes ratings into 2-point score brackets."""
        buckets = []
        ranges = [(0, 4), (4, 6), (6, 8), (8, 10)]
        for r_min, r_max in ranges:
            count = qs.filter(
                Q(rating__gte=r_min, rating__lt=r_max) |
                Q(community_rating__gte=r_min, community_rating__lt=r_max)
            ).count()
            if count > 0:
                buckets.append({
                    'range': f"{r_min} - {r_max} ⭐",
                    'min': r_min,
                    'max': r_max,
                    'count': count
                })
        return {'buckets': buckets}

    def _facet_audience(self, qs) -> List[Dict[str, Any]]:
        """Counts by official age rating (e.g. PG-13, R, G, TV-MA)."""
        aud_counts = qs.exclude(
            official_rating__isnull=True
        ).exclude(
            official_rating=''
        ).values('official_rating').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        return [{'key': row['official_rating'], 'label': row['official_rating'], 'count': row['count']} for row in aud_counts]
