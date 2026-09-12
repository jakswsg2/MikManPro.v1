"""
Phase 16: Search History Service
Tracks personalized search history, intent classification, and enforces GDPR data removal.
"""
from typing import List, Dict, Any, Optional
from apps.content.models import SearchQuery, normalize_search_text
from apps.content.search.understanding import QueryUnderstandingService


class SearchHistoryService:
    """
    Manages user search history with a maximum 50 records ceiling per user.
    """

    MAX_HISTORY = 50

    def record_search(
        self,
        user: Optional[Any],
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        results_count: int = 0,
        execution_time_ms: int = 0,
        search_type: str = 'FULL_TEXT',
        device_name: Optional[str] = None,
        client_info: Optional[Dict[str, Any]] = None,
        tenant: Optional[Any] = None,
    ) -> Optional[SearchQuery]:
        """Records a new search interaction in the database."""
        if not query or not query.strip():
            return None

        clean_q = query.strip()
        norm_q = normalize_search_text(clean_q)

        # Detect intent and language
        understanding = QueryUnderstandingService().analyze(clean_q, user)
        resolved_tenant = tenant or (getattr(user, 'tenant', None) if user else None)
        if not resolved_tenant:
            return None

        search_record = SearchQuery.objects.create(
            tenant=resolved_tenant,
            user=user if (user and getattr(user, 'is_authenticated', False)) else None,
            query_text=clean_q[:500],
            query_normalized=norm_q[:500],
            query_language=understanding['language'],
            query_intent=understanding['intent'],
            filters_applied=filters or {},
            results_count=results_count,
            execution_time_ms=execution_time_ms,
            search_type=search_type,
            device_name=device_name,
            client_info=client_info or {},
        )

        if user and getattr(user, 'is_authenticated', False):
            self._enforce_history_limit(user)

        return search_record

    def get_history(self, user: Any, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieves user recent search queries list."""
        if not user or not getattr(user, 'is_authenticated', False):
            return []

        qs = SearchQuery.objects.filter(
            user=user,
            search_type__in=['FULL_TEXT', 'FUZZY', 'NL']
        ).exclude(
            query_text=''
        ).order_by('-created_at')[:limit]

        return [
            {
                'id': str(sq.id),
                'query': sq.query_text,
                'normalized_query': sq.query_normalized,
                'filters': sq.filters_applied,
                'results_count': sq.results_count,
                'search_type': sq.search_type,
                'created_at': sq.created_at.isoformat() if sq.created_at else None,
            }
            for sq in qs
        ]

    def clear_history(self, user: Any) -> int:
        """Deletes all search history for the authenticated user."""
        if not user or not getattr(user, 'is_authenticated', False):
            return 0
        deleted_count = SearchQuery.objects.filter(user=user).delete()[0]
        return deleted_count

    def delete_item(self, user: Any, search_id: str) -> bool:
        """Deletes a specific search history entry."""
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        deleted_count = SearchQuery.objects.filter(user=user, id=search_id).delete()[0]
        return deleted_count > 0

    def record_click(self, user: Optional[Any], search_id: str, item_id: str, position: int) -> bool:
        """Updates search record with clicked result ID and position for CTR calculation."""
        try:
            query_filter = {'id': search_id}
            if user and getattr(user, 'is_authenticated', False):
                query_filter['user'] = user

            sq = SearchQuery.objects.get(**query_filter)
            clicked = sq.results_clicked or []
            if item_id not in clicked:
                clicked.append(item_id)
                sq.results_clicked = clicked
            sq.clicked_position = position
            sq.save(update_fields=['results_clicked', 'clicked_position'])
            return True
        except SearchQuery.DoesNotExist:
            return False

    def _enforce_history_limit(self, user: Any):
        """Retains only the latest MAX_HISTORY records for the user."""
        count = SearchQuery.objects.filter(user=user).count()
        if count > self.MAX_HISTORY:
            latest_ids = list(
                SearchQuery.objects.filter(user=user)
                .order_by('-created_at')
                .values_list('id', flat=True)[:self.MAX_HISTORY]
            )
            SearchQuery.objects.filter(user=user).exclude(id__in=latest_ids).delete()
