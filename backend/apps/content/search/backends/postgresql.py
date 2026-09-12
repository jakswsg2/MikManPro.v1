"""
Phase 16: PostgreSQL Full-Text & Trigram Search Backend
"""
from typing import Dict, Any, List, Optional
from django.db.models import Q
from apps.content.search.backends.base import SearchBackend
from apps.content.models import normalize_search_text, normalize_arabic_text


class PostgreSQLSearchBackend(SearchBackend):
    """
    PostgreSQL Full-Text Search, Trigram Similarity and normalized text backend.
    """

    def search(
        self,
        base_qs,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        expanded_terms: Optional[List[str]] = None,
        understanding: Optional[Dict[str, Any]] = None,
    ):
        qs = base_qs
        filters = filters or {}
        expanded = expanded_terms or []

        # 1. Apply structured filters
        if 'item_type' in filters and filters['item_type']:
            qs = qs.filter(item_type=filters['item_type'])
        elif 'type' in filters and filters['type']:
            qs = qs.filter(item_type=filters['type'])

        if 'year' in filters and filters['year']:
            qs = qs.filter(year=filters['year'])
        if 'year_from' in filters and filters['year_from']:
            qs = qs.filter(year__gte=filters['year_from'])
        if 'year_to' in filters and filters['year_to']:
            qs = qs.filter(year__lte=filters['year_to'])

        if 'genres' in filters and filters['genres']:
            genre_val = filters['genres']
            if isinstance(genre_val, list):
                for g in genre_val:
                    qs = qs.filter(genres__contains=[g])
            else:
                qs = qs.filter(genres__contains=[genre_val])

        if 'resolution' in filters and filters['resolution']:
            qs = qs.filter(resolution__icontains=filters['resolution'])

        if 'language' in filters and filters['language']:
            qs = qs.filter(original_language=filters['language'])

        if 'rating_from' in filters and filters['rating_from']:
            qs = qs.filter(Q(rating__gte=filters['rating_from']) | Q(community_rating__gte=filters['rating_from']))

        clean_q = query.strip() if query else ""
        if not clean_q and not expanded:
            return qs

        # 2. Build multi-term query conditions
        search_terms = [clean_q] if clean_q else []
        for term in expanded:
            if term not in search_terms:
                search_terms.append(term)

        combined_condition = Q()
        for term in search_terms:
            t_norm = normalize_search_text(term)
            t_ar_norm = normalize_arabic_text(term)

            term_cond = (
                Q(title__icontains=term) |
                Q(original_title__icontains=term) |
                Q(normalized_title__icontains=t_norm) |
                Q(normalized_title_ar__icontains=t_ar_norm) |
                Q(overview__icontains=term) |
                Q(tags__contains=[term]) |
                Q(people__contains=[term])
            )
            combined_condition |= term_cond

        return qs.filter(combined_condition)
