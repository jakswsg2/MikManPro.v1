"""
Phase 16: Enterprise Unified Search Engine
Orchestrates query understanding, synonym expansion, backend retrieval,
multi-factor ranking, faceted aggregation, personalization, and search analytics.
"""
import time
from typing import Dict, Any, List, Optional
from apps.content.models import MediaItem, normalize_search_text
from apps.permissions.content_access import ContentAccessEngine
from apps.content.search.understanding import QueryUnderstandingService
from apps.content.search.synonyms import SynonymService
from apps.content.search.ranking import SearchRankingService
from apps.content.search.facets import SearchFacetService
from apps.content.search.suggestions import SearchSuggestionsService
from apps.content.search.history import SearchHistoryService
from apps.content.search.ab_testing import SearchABTestService
from apps.content.search.backends.opensearch import SearchBackendFactory


class UnifiedSearchEngine:
    """
    Enterprise Unified Search Engine for Smart Lounge.
    """

    def __init__(self):
        self.understanding_service = QueryUnderstandingService()
        self.synonym_service = SynonymService()
        self.ranking_service = SearchRankingService()
        self.facet_service = SearchFacetService()
        self.suggestion_service = SearchSuggestionsService()
        self.history_service = SearchHistoryService()
        self.ab_test_service = SearchABTestService()

    def search(
        self,
        user: Any,
        query: str = "",
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20,
        context: Optional[Dict[str, Any]] = None,
        search_type: str = 'FULL_TEXT',
        include_facets: bool = True,
        ab_test_id: Optional[str] = None,
        device_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Complete end-to-end multi-tier search execution.
        """
        start_time = time.time()
        clean_query = query.strip() if query else ""

        # 1. Query Understanding
        understanding = self.understanding_service.analyze(clean_query, user)

        # 2. Normalize
        normalized_q = normalize_search_text(clean_query)

        # 3. Synonym Expansion
        tokens = clean_query.split() if clean_query else []
        tenant = getattr(user, 'tenant', None)
        expanded_terms = self.synonym_service.expand(
            terms=[clean_query] + tokens,
            language=understanding['language'],
            tenant=tenant
        ) if clean_query else []

        # 4. Merge Filters (Implicit + Explicit)
        merged_filters = dict(understanding.get('implicit_filters', {}))
        if filters:
            merged_filters.update(filters)

        # 5. Base Queryset & Permission Pre-filtering
        base_qs = MediaItem.objects.select_related('library', 'library__server').prefetch_related('sources')
        if tenant:
            base_qs = base_qs.filter(library__server__tenant=tenant)

        base_qs = ContentAccessEngine().filter_queryset(user, base_qs, action='view')

        # 6. Execute Backend Search
        backend = SearchBackendFactory.get_backend()
        search_term = understanding.get('cleaned_query') or clean_query
        results_qs = backend.search(
            base_qs=base_qs,
            query=search_term,
            filters=merged_filters,
            expanded_terms=expanded_terms,
            understanding=understanding,
        )

        candidate_items = list(results_qs[:300])

        # 7. A/B Testing Config Evaluation
        variant = None
        ranking_weights = None
        if ab_test_id:
            variant = self.ab_test_service.get_variant(ab_test_id, user)
            ab_config = self.ab_test_service.get_config(ab_test_id, variant)
            ranking_weights = ab_config.get('weights')

        # 8. Multi-Factor Ranking
        ranked_items = self.ranking_service.rank(
            items=candidate_items,
            query=clean_query,
            user=user,
            context=context,
            weights=ranking_weights,
        )

        # 9. Deduplication (Group identical normalized titles, keeping highest scored)
        deduped_items = self._deduplicate(ranked_items)

        # 10. Facets Calculation (Optional)
        facets = {}
        if include_facets:
            facets = self.facet_service.calculate_facets(
                base_qs=results_qs,
                query=clean_query,
                current_filters=merged_filters,
            )

        # 11. Pagination
        total = len(deduped_items)
        page_num = max(1, page)
        size = max(1, min(page_size, 100))
        start_idx = (page_num - 1) * size
        end_idx = start_idx + size
        paginated_items = deduped_items[start_idx:end_idx]

        execution_time_ms = max(1, int((time.time() - start_time) * 1000))

        # 12. Search History & Analytics Tracking
        search_record = self.history_service.record_search(
            user=user,
            query=clean_query,
            filters=merged_filters,
            results_count=total,
            execution_time_ms=execution_time_ms,
            search_type=search_type,
            device_name=device_name or (context.get('device') if context else None),
            client_info=context.get('client_info') if context else None,
            tenant=tenant,
        )
        search_id = str(search_record.id) if search_record else None

        # Record A/B test metrics if applicable
        if ab_test_id and variant:
            self.ab_test_service.record_metric(ab_test_id, variant, 'EXECUTION_TIME', execution_time_ms)
            self.ab_test_service.record_metric(ab_test_id, variant, 'ZERO_RESULTS_RATE', 1.0 if total == 0 else 0.0)

        # 13. Dynamic Suggestions
        suggestions = self.suggestion_service.get_suggestions(
            user=user,
            query=clean_query,
            limit=5,
        )

        # 14. Format & Return Payload
        return {
            'search_id': search_id,
            'query': clean_query,
            'normalized_query': normalized_q,
            'understanding': understanding,
            'expanded_terms': expanded_terms,
            'results': [self._serialize_item(item) for item in paginated_items],
            'total': total,
            'page': page_num,
            'page_size': size,
            'total_pages': (total + size - 1) // size if total > 0 else 1,
            'facets': facets,
            'suggestions': suggestions,
            'execution_time_ms': execution_time_ms,
            'ab_test': {
                'test_id': ab_test_id,
                'variant': variant,
            } if ab_test_id else None,
        }

    def _deduplicate(self, items: List[Any]) -> List[Any]:
        """Deduplicates items by title/year/logical group, keeping highest-scoring version."""
        seen_keys = set()
        deduped = []

        for item in items:
            key = getattr(item, 'normalized_title', None) or getattr(item, 'title', '')
            year = getattr(item, 'year', None) or ''
            dedup_key = f"{key.lower().strip()}_{year}"

            if dedup_key not in seen_keys:
                seen_keys.add(dedup_key)
                deduped.append(item)

        return deduped

    def _serialize_item(self, item: Any) -> Dict[str, Any]:
        """Serializes media item into consumer-friendly dictionary."""
        sources = []
        if hasattr(item, 'sources'):
            for s in item.sources.all():
                sources.append({
                    'id': str(s.id),
                    'server_id': str(s.media_server_id),
                    'resolution': s.resolution,
                    'is_available': s.is_available,
                })

        return {
            'id': str(item.id),
            'title': item.title,
            'original_title': item.original_title,
            'item_type': item.item_type,
            'year': item.year,
            'duration_minutes': getattr(item, 'duration_minutes', None),
            'rating': float(item.rating) if getattr(item, 'rating', None) else None,
            'community_rating': float(item.community_rating) if getattr(item, 'community_rating', None) else None,
            'official_rating': getattr(item, 'official_rating', None),
            'overview': getattr(item, 'overview', ''),
            'genres': getattr(item, 'genres', []) or [],
            'tags': getattr(item, 'tags', []) or [],
            'poster_url': getattr(item, 'poster_url', None) or getattr(item, 'thumbnail_url', None),
            'backdrop_url': getattr(item, 'backdrop_url', None),
            'resolution': getattr(item, 'resolution', None),
            'is_logical_primary': getattr(item, 'is_logical_primary', True),
            'popularity_score': float(getattr(item, 'popularity_score', 0) or 0),
            'rank_score': round(float(getattr(item, '_calculated_rank_score', 0)), 3) if hasattr(item, '_calculated_rank_score') else None,
            'sources_count': len(sources),
            'sources': sources,
        }
