"""
Phase 16: Search Suggestions & Autocomplete Service
Provides multi-source suggestions: query completion, fuzzy media titles, and curated trending items.
"""
from typing import Dict, Any, List, Optional
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q
from apps.content.models import SearchQuery, SearchSuggestion, MediaItem, normalize_search_text
from apps.permissions.content_access import ContentAccessEngine


class SearchSuggestionsService:
    """
    Supplies instant suggestions for the search interface.
    """

    def get_suggestions(
        self,
        user: Any,
        query: str = '',
        limit: int = 10,
        include_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Returns structured suggestions dictionary for autocomplete dropdowns.
        """
        requested = include_types or ['queries', 'content', 'trending']
        result: Dict[str, Any] = {
            'queries': [],
            'content': [],
            'trending': []
        }

        clean_q = query.strip() if query else ''

        if 'queries' in requested and clean_q:
            result['queries'] = self._query_suggestions(user, clean_q, limit)

        if 'content' in requested and clean_q:
            result['content'] = self._content_suggestions(user, clean_q, limit)

        if 'trending' in requested and (not clean_q or len(result['queries']) < 3):
            result['trending'] = self._trending_suggestions(user, limit)

        return result

    def _query_suggestions(self, user: Any, query: str, limit: int) -> List[str]:
        """Collects query text suggestions from personal and tenant search history."""
        norm_q = normalize_search_text(query).lower()
        suggestions: List[str] = []
        seen = set()

        # 1. Personal search history (if authenticated)
        if user and getattr(user, 'is_authenticated', False):
            personal_qs = SearchQuery.objects.filter(
                user=user,
                query_normalized__icontains=norm_q
            ).values('query_text').annotate(
                freq=Count('id')
            ).order_by('-freq')[:5]

            for item in personal_qs:
                text = item['query_text'].strip()
                if text and text.lower() not in seen:
                    seen.add(text.lower())
                    suggestions.append(text)

        # 2. Tenant trending recent search queries (last 7 days)
        tenant = getattr(user, 'tenant', None)
        if tenant:
            seven_days_ago = timezone.now() - timedelta(days=7)
            trending_qs = SearchQuery.objects.filter(
                tenant=tenant,
                created_at__gte=seven_days_ago,
                query_normalized__icontains=norm_q
            ).values('query_text').annotate(
                freq=Count('id')
            ).order_by('-freq')[:10]

            for item in trending_qs:
                text = item['query_text'].strip()
                if text and text.lower() not in seen:
                    seen.add(text.lower())
                    suggestions.append(text)

        return suggestions[:limit]

    def _content_suggestions(self, user: Any, query: str, limit: int) -> List[Dict[str, Any]]:
        """Finds matching media item titles and metadata for instant autocomplete."""
        norm_q = normalize_search_text(query).lower()

        base_qs = MediaItem.objects.select_related('library')
        if user and getattr(user, 'tenant', None):
            base_qs = base_qs.filter(library__server__tenant=user.tenant)

        # Pre-filter by user RBAC entitlements
        base_qs = ContentAccessEngine().filter_queryset(user, base_qs, action='view')

        # Matching filters
        search_filter = (
            Q(title__icontains=query) |
            Q(original_title__icontains=query) |
            Q(normalized_title__icontains=norm_q) |
            Q(normalized_title_ar__icontains=norm_q)
        )
        matching_items = base_qs.filter(search_filter).order_by(
            '-is_logical_primary', '-rating', '-year'
        )[:limit]

        results = []
        for item in matching_items:
            results.append({
                'id': str(item.id),
                'title': item.title,
                'original_title': item.original_title,
                'item_type': item.item_type,
                'year': item.year,
                'poster_url': getattr(item, 'poster_url', None) or getattr(item, 'thumbnail_url', None),
                'rating': float(item.rating) if item.rating else None,
                'resolution': item.resolution,
            })
        return results

    def _trending_suggestions(self, user: Any, limit: int) -> List[Dict[str, Any]]:
        """Loads curated and trending search pills configured by admins."""
        tenant = getattr(user, 'tenant', None)
        now = timezone.now()

        qs = SearchSuggestion.objects.filter(is_active=True)
        if tenant:
            qs = qs.filter(tenant=tenant)

        qs = qs.filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=now)
        ).filter(
            Q(valid_until__isnull=True) | Q(valid_until__gte=now)
        ).order_by('priority', '-created_at')[:limit]

        trending_list = []
        for s in qs:
            trending_list.append({
                'id': str(s.id),
                'text': s.text,
                'text_localized': s.text_localized,
                'type': s.suggestion_type,
                'icon': s.icon or 'Sparkles',
                'action_url': s.action_url,
                'priority': s.priority,
            })

        # Fallback default trending suggestions if none configured
        if not trending_list:
            default_trends = [
                {'text': 'أحدث أفلام الأكشن', 'type': 'TRENDING', 'icon': 'Flame'},
                {'text': 'أفلام بدقة 4K', 'type': 'FEATURED', 'icon': 'Tv'},
                {'text': 'مسلسلات خيال علمي', 'type': 'TRENDING', 'icon': 'Sparkles'},
                {'text': 'أفلام عائلية', 'type': 'EDITORIAL', 'icon': 'Smile'},
            ]
            trending_list = default_trends[:limit]

        return trending_list
