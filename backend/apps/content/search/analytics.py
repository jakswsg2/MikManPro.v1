"""
Phase 16: Search Analytics & Intelligence Service
Calculates search performance metrics, zero-results rates, top queries, and automated synonym suggestions.
"""
from typing import Dict, Any, List, Optional
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Avg, F
try:
    from django.db.models.functions import ExtractHour
except ImportError:
    try:
        from django.db.models.functions.datetime import ExtractHour
    except ImportError:
        ExtractHour = None
from apps.content.models import SearchQuery, normalize_search_text


class SearchAnalyticsService:
    """
    Search analytics and reporting engine for tenant administrators.
    """

    def get_analytics(
        self,
        tenant: Any,
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Calculates comprehensive search analytics over the specified timeframe."""
        end = end_date or timezone.now()
        start = start_date or (end - timedelta(days=30))

        queries = SearchQuery.objects.filter(
            tenant=tenant,
            created_at__gte=start,
            created_at__lte=end,
        )

        total_searches = queries.count()
        zero_results_count = queries.filter(results_count=0).count()
        unique_users = queries.exclude(user__isnull=True).values('user').distinct().count()

        aggregates = queries.aggregate(
            avg_latency=Avg('execution_time_ms'),
            avg_results=Avg('results_count')
        )

        zero_results_rate = (zero_results_count / total_searches) if total_searches > 0 else 0.0

        return {
            'period': {
                'start': start.isoformat() if hasattr(start, 'isoformat') else str(start),
                'end': end.isoformat() if hasattr(end, 'isoformat') else str(end),
            },
            'summary': {
                'total_searches': total_searches,
                'unique_users': unique_users,
                'zero_results_count': zero_results_count,
                'zero_results_rate': round(zero_results_rate * 100, 2),
                'avg_execution_time_ms': round(aggregates.get('avg_latency') or 0, 1),
                'avg_results_per_query': round(aggregates.get('avg_results') or 0, 1),
            },
            'top_queries': self._top_queries(queries, limit=20),
            'zero_result_queries': self._zero_result_queries(queries, limit=20),
            'by_language': self._by_language(queries),
            'by_intent': self._by_intent(queries),
            'by_hour': self._by_hour(queries),
            'slow_queries': self._slow_queries(queries, limit=20),
        }

    def _top_queries(self, queries, limit: int = 20) -> List[Dict[str, Any]]:
        """Top performed search queries ordered by count."""
        top = queries.exclude(query_text='').values('query_normalized').annotate(
            count=Count('id'),
            avg_results=Avg('results_count'),
            avg_position=Avg('clicked_position')
        ).order_by('-count')[:limit]

        return [
            {
                'query': item['query_normalized'],
                'count': item['count'],
                'avg_results': round(item['avg_results'] or 0, 1),
                'avg_clicked_position': round(item['avg_position'] or 0, 1) if item['avg_position'] else None,
            }
            for item in top
        ]

    def _zero_result_queries(self, queries, limit: int = 20) -> List[Dict[str, Any]]:
        """Queries that returned 0 results to identify content gaps and missing synonyms."""
        zero = queries.filter(results_count=0).exclude(query_text='').values('query_normalized').annotate(
            count=Count('id'),
            last_searched=F('created_at')
        ).order_by('-count')[:limit]

        return [{'query': item['query_normalized'], 'count': item['count']} for item in zero]

    def _by_language(self, queries) -> List[Dict[str, Any]]:
        """Search query distribution by detected language."""
        by_lang = queries.values('query_language').annotate(
            count=Count('id')
        ).order_by('-count')
        return [{'language': item['query_language'], 'count': item['count']} for item in by_lang]

    def _by_intent(self, queries) -> List[Dict[str, Any]]:
        """Search query distribution by detected user intent."""
        by_intent = queries.values('query_intent').annotate(
            count=Count('id')
        ).order_by('-count')
        return [{'intent': item['query_intent'], 'count': item['count']} for item in by_intent]

    def _by_hour(self, queries) -> List[Dict[str, Any]]:
        """Search activity volume grouped by hour of the day."""
        hours_data = queries.annotate(
            hour=ExtractHour('created_at')
        ).values('hour').annotate(
            count=Count('id')
        ).order_by('hour')

        # Map 0-23 hours
        hour_map = {i: 0 for i in range(24)}
        for row in hours_data:
            if row['hour'] is not None:
                hour_map[int(row['hour'])] = row['count']

        return [{'hour': h, 'count': c} for h, c in sorted(hour_map.items())]

    def _slow_queries(self, queries, limit: int = 20) -> List[Dict[str, Any]]:
        """Identifies queries that took > 500ms for optimization."""
        slow = queries.filter(execution_time_ms__gt=500).values(
            'query_text', 'query_normalized', 'execution_time_ms', 'search_type'
        ).order_by('-execution_time_ms')[:limit]

        return list(slow)

    def get_zero_result_dashboard(self, tenant: Any, days: int = 7) -> Dict[str, Any]:
        """Dedicated Zero Results dashboard with smart synonym suggestions."""
        since = timezone.now() - timedelta(days=days)
        zero_queries = SearchQuery.objects.filter(
            tenant=tenant,
            results_count=0,
            created_at__gte=since
        ).exclude(query_text='')

        total_zero = zero_queries.count()
        top_zero = list(
            zero_queries.values('query_normalized').annotate(
                count=Count('id')
            ).order_by('-count')[:20]
        )

        suggested_synonyms = self._suggest_synonyms_for_zero_queries(tenant, top_zero)

        return {
            'timeframe_days': days,
            'total_zero_results': total_zero,
            'unique_failed_queries': len(top_zero),
            'top_zero_queries': [{'query': item['query_normalized'], 'count': item['count']} for item in top_zero],
            'suggested_synonyms': suggested_synonyms,
        }

    def _suggest_synonyms_for_zero_queries(self, tenant: Any, top_zero: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Matches failed queries against popular successful queries to suggest synonyms."""
        suggestions = []
        successful_queries = list(
            SearchQuery.objects.filter(
                tenant=tenant,
                results_count__gt=0
            ).values_list('query_normalized', flat=True).distinct()[:200]
        )

        for item in top_zero[:10]:
            failed_q = item['query_normalized']
            for succ_q in successful_queries:
                if succ_q != failed_q and (succ_q in failed_q or failed_q in succ_q):
                    suggestions.append({
                        'failed_query': failed_q,
                        'suggested_synonym': succ_q,
                        'confidence': 0.8,
                    })
                    break

        return suggestions
