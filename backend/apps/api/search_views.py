"""
Phase 16: Enterprise Unified Search REST API Views
Includes User Search, Autocomplete Suggestions, Natural Language Search,
Personal History, Saved Searches, Admin Search Analytics, Synonym Management,
Ranking Weights Configuration, and Search A/B Testing.
"""
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from apps.content.models import (
    SearchQuery, SearchSuggestion, SearchSynonym,
    SearchRankingConfig, SavedSearch, SearchABTest
)
from apps.content.search.engine import UnifiedSearchEngine
from apps.content.search.suggestions import SearchSuggestionsService
from apps.content.search.nl_search import NaturalLanguageSearchService
from apps.content.search.history import SearchHistoryService
from apps.content.search.saved_searches import SavedSearchService
from apps.content.search.analytics import SearchAnalyticsService
from apps.content.search.ab_testing import SearchABTestService
from apps.content.tasks import rebuild_search_index_task
from apps.permissions.engine import PermissionEngine


# =============================================================================
# User Search & Discovery Views
# =============================================================================

class UserSearchView(APIView):
    """
    Primary Unified Search endpoint with multi-tier ranking, filters, and facets.
    GET /api/v1/content/search/unified/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        ab_test_id = request.query_params.get('ab_test_id', None)

        filters = {}
        for param in ['item_type', 'type', 'genre', 'resolution', 'language']:
            val = request.query_params.get(param)
            if val:
                filters[param] = val

        if 'genres' in request.query_params:
            filters['genres'] = request.query_params.getlist('genres')

        for num_param in ['year', 'year_from', 'year_to', 'rating_from']:
            val = request.query_params.get(num_param)
            if val:
                try:
                    filters[num_param] = float(val) if '.' in val else int(val)
                except ValueError:
                    pass

        engine = UnifiedSearchEngine()
        context = {
            'device': request.META.get('HTTP_USER_AGENT', 'Web'),
            'client_info': {
                'ip': request.META.get('REMOTE_ADDR'),
                'user_agent': request.META.get('HTTP_USER_AGENT')
            }
        }

        results = engine.search(
            user=request.user,
            query=query,
            filters=filters,
            page=page,
            page_size=page_size,
            context=context,
            ab_test_id=ab_test_id,
        )

        return Response(results, status=status.HTTP_200_OK)


class SearchSuggestionsView(APIView):
    """
    Autocomplete Suggestions endpoint.
    GET /api/v1/content/search/suggestions/?q=...
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '')
        limit = int(request.query_params.get('limit', 8))
        service = SearchSuggestionsService()
        data = service.get_suggestions(user=request.user, query=query, limit=limit)
        return Response(data, status=status.HTTP_200_OK)


class NaturalLanguageSearchView(APIView):
    """
    Pattern-based Natural Language Search.
    POST /api/v1/content/search/nl/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = request.data.get('query', '')
        page = int(request.data.get('page', 1))
        page_size = int(request.data.get('page_size', 20))

        if not query:
            return Response({'error': 'Query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        service = NaturalLanguageSearchService()
        results = service.search_nl(
            user=request.user,
            query=query,
            page=page,
            page_size=page_size
        )
        return Response(results, status=status.HTTP_200_OK)


# =============================================================================
# User History & Saved Searches Views
# =============================================================================

class SearchHistoryView(APIView):
    """
    User Search History List & Clear.
    GET /api/v1/me/search-history/
    DELETE /api/v1/me/search-history/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        history = SearchHistoryService().get_history(request.user, limit=limit)
        return Response({'history': history}, status=status.HTTP_200_OK)

    def delete(self, request):
        count = SearchHistoryService().clear_history(request.user)
        return Response({'cleared_count': count, 'message': 'Search history cleared successfully'}, status=status.HTTP_200_OK)


class SearchHistoryDetailView(APIView):
    """
    Delete single search history item or record click.
    DELETE /api/v1/me/search-history/<search_id>/
    POST /api/v1/me/search-history/<search_id>/click/
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, search_id):
        success = SearchHistoryService().delete_item(request.user, search_id)
        if success:
            return Response({'message': 'Item deleted'}, status=status.HTTP_200_OK)
        return Response({'error': 'Item not found'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, search_id):
        item_id = request.data.get('item_id')
        position = int(request.data.get('position', 1))
        if not item_id:
            return Response({'error': 'item_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        recorded = SearchHistoryService().record_click(request.user, search_id, item_id, position)
        return Response({'recorded': recorded}, status=status.HTTP_200_OK)


class SavedSearchViewSet(viewsets.ModelViewSet):
    """
    CRUD for User Saved Searches.
    /api/v1/me/saved-searches/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedSearch.objects.filter(user=self.request.user).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        searches = SavedSearchService().list_saved_searches(request.user)
        return Response({'saved_searches': searches})

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', '')
        query = request.data.get('query', '')
        filters = request.data.get('filters', {})
        notification_enabled = bool(request.data.get('notification_enabled', False))
        notification_frequency = request.data.get('notification_frequency', 'WEEKLY')

        try:
            saved = SavedSearchService().save_search(
                user=request.user,
                name=name,
                query=query,
                filters=filters,
                notification_enabled=notification_enabled,
                notification_frequency=notification_frequency,
            )
            return Response({
                'id': str(saved.id),
                'name': saved.name,
                'query': saved.query,
                'filters': saved.filters,
                'notification_enabled': saved.notification_enabled,
                'notification_frequency': saved.notification_frequency,
                'created_at': saved.created_at.isoformat(),
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        instance.delete()


# =============================================================================
# Admin Search Analytics, Config, Synonyms & A/B Testing Views
# =============================================================================

class AdminSearchAnalyticsView(APIView):
    """
    Admin Search Analytics Dashboard.
    GET /api/v1/admin/search/analytics/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not PermissionEngine.has_permission(request.user, 'content.view_analytics'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        tenant = request.user.tenant
        analytics = SearchAnalyticsService().get_analytics(tenant=tenant)
        return Response(analytics, status=status.HTTP_200_OK)


class AdminSearchZeroResultsView(APIView):
    """
    Admin Zero Results & Missing Synonyms Dashboard.
    GET /api/v1/admin/search/zero-results/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not PermissionEngine.has_permission(request.user, 'content.view_analytics'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        days = int(request.query_params.get('days', 7))
        tenant = request.user.tenant
        dashboard = SearchAnalyticsService().get_zero_result_dashboard(tenant=tenant, days=days)
        return Response(dashboard, status=status.HTTP_200_OK)


class AdminSearchRankingConfigView(APIView):
    """
    Admin Multi-Factor Ranking Weights Config.
    GET /api/v1/admin/search/ranking-config/
    POST /api/v1/admin/search/ranking-config/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        tenant = request.user.tenant
        config = SearchRankingConfig.objects.filter(tenant=tenant, is_active=True).first()
        weights = config.weights if config else SearchRankingConfig.get_default_weights()
        return Response({'weights': weights, 'is_custom': config is not None}, status=status.HTTP_200_OK)

    def post(self, request):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        weights = request.data.get('weights', {})
        tenant = request.user.tenant
        config, _ = SearchRankingConfig.objects.get_or_create(
            tenant=tenant,
            config_key='default',
            defaults={'weights': weights, 'is_active': True}
        )
        config.weights = weights
        config.is_active = True
        config.save()
        return Response({'weights': config.weights, 'status': 'updated'}, status=status.HTTP_200_OK)


class AdminSearchSynonymsViewSet(viewsets.ModelViewSet):
    """
    CRUD for Search Synonyms across languages.
    /api/v1/admin/search/synonyms/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = self.request.user.tenant
        return SearchSynonym.objects.filter(tenant=tenant).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset()
        return Response({
            'synonyms': [
                {
                    'id': str(s.id),
                    'term': s.term,
                    'synonyms': s.synonyms,
                    'language': s.language,
                    'is_active': s.is_active,
                    'created_at': s.created_at.isoformat() if s.created_at else None,
                }
                for s in qs
            ]
        })

    def create(self, request, *args, **kwargs):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        term = request.data.get('term', '').strip()
        synonyms_list = request.data.get('synonyms', [])
        language = request.data.get('language', 'ar')

        if not term:
            return Response({'error': 'term is required'}, status=status.HTTP_400_BAD_REQUEST)

        syn, created = SearchSynonym.objects.update_or_create(
            tenant=request.user.tenant,
            term=term,
            language=language,
            defaults={'synonyms': synonyms_list, 'is_active': True}
        )

        return Response({
            'id': str(syn.id),
            'term': syn.term,
            'synonyms': syn.synonyms,
            'language': syn.language,
            'is_active': syn.is_active,
        }, status=status.HTTP_201_CREATED)


class AdminSearchSuggestionsViewSet(viewsets.ModelViewSet):
    """
    CRUD for Curated & Featured Search Suggestions.
    /api/v1/admin/search/suggestions/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = self.request.user.tenant
        return SearchSuggestion.objects.filter(tenant=tenant).order_by('priority', '-created_at')

    def list(self, request, *args, **kwargs):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset()
        return Response({
            'suggestions': [
                {
                    'id': str(s.id),
                    'text': s.text,
                    'text_localized': s.text_localized,
                    'type': s.suggestion_type,
                    'priority': s.priority,
                    'icon': s.icon,
                    'action_url': s.action_url,
                    'is_active': s.is_active,
                    'created_at': s.created_at.isoformat() if s.created_at else None,
                }
                for s in qs
            ]
        })

    def create(self, request, *args, **kwargs):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'text is required'}, status=status.HTTP_400_BAD_REQUEST)

        suggestion = SearchSuggestion.objects.create(
            tenant=request.user.tenant,
            text=text,
            text_localized=request.data.get('text_localized', {}),
            suggestion_type=request.data.get('type', 'TRENDING'),
            priority=int(request.data.get('priority', 100)),
            icon=request.data.get('icon', 'Flame'),
            action_url=request.data.get('action_url', ''),
            is_active=bool(request.data.get('is_active', True)),
        )
        return Response({
            'id': str(suggestion.id),
            'text': suggestion.text,
            'type': suggestion.suggestion_type,
            'priority': suggestion.priority,
        }, status=status.HTTP_201_CREATED)


class AdminSearchABTestViewSet(viewsets.ModelViewSet):
    """
    CRUD & Evaluation for Search A/B Tests.
    /api/v1/admin/search/ab-tests/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = self.request.user.tenant
        return SearchABTest.objects.filter(tenant=tenant).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset()
        return Response({
            'tests': [
                {
                    'id': str(t.id),
                    'name': t.name,
                    'test_type': t.test_type,
                    'status': t.status,
                    'traffic_split': t.traffic_split,
                    'target_metric': t.target_metric,
                    'started_at': t.started_at.isoformat() if t.started_at else None,
                    'results': SearchABTestService().get_results(str(t.id)),
                }
                for t in qs
            ]
        })

    def create(self, request, *args, **kwargs):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        test = SearchABTest.objects.create(
            tenant=request.user.tenant,
            name=request.data.get('name', 'Search Test'),
            description=request.data.get('description', ''),
            test_type=request.data.get('test_type', 'RANKING'),
            variant_a_config=request.data.get('variant_a_config', {}),
            variant_b_config=request.data.get('variant_b_config', {}),
            traffic_split=int(request.data.get('traffic_split', 50)),
            target_metric=request.data.get('target_metric', 'CTR'),
            status='RUNNING',
            started_at=timezone.now(),
        )
        return Response({'id': str(test.id), 'name': test.name, 'status': test.status}, status=status.HTTP_201_CREATED)


class AdminSearchReindexView(APIView):
    """
    Trigger Search Catalog Reindex & Vector Normalization.
    POST /api/v1/admin/search/reindex/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not PermissionEngine.has_permission(request.user, 'content.manage_metadata'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        tenant = request.user.tenant
        result = rebuild_search_index_task(tenant_id=str(tenant.id) if tenant else None)
        return Response({'status': 'completed', 'result': result}, status=status.HTTP_200_OK)
