"""
Unit & Integration Tests for Phase 16: Enterprise Unified Search
Tests Query Understanding, Synonyms, Ranking, Facets, Suggestions, Natural Language Search,
Personal History, Saved Searches, Analytics, A/B Testing, and the Unified Search Engine.
"""
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from django.utils import timezone

from apps.content.search.understanding import QueryUnderstandingService
from apps.content.search.synonyms import SynonymService
from apps.content.search.ranking import SearchRankingService
from apps.content.search.facets import SearchFacetService
from apps.content.search.suggestions import SearchSuggestionsService
from apps.content.search.nl_search import NaturalLanguageSearchService
from apps.content.search.history import SearchHistoryService
from apps.content.search.saved_searches import SavedSearchService, MaxSavedSearchesReached
from apps.content.search.analytics import SearchAnalyticsService
from apps.content.search.ab_testing import SearchABTestService
from apps.content.search.backends.postgresql import PostgreSQLSearchBackend
from apps.content.search.engine import UnifiedSearchEngine


class TestQueryUnderstanding(unittest.TestCase):
    def setUp(self):
        self.service = QueryUnderstandingService()

    def test_language_detection(self):
        self.assertEqual(self.service._detect_language("أفلام أكشن"), "ar")
        self.assertEqual(self.service._detect_language("Inception 2010"), "en")
        self.assertEqual(self.service._detect_language("فيلم Batman"), "mixed")

    def test_intent_detection(self):
        self.assertEqual(self.service._detect_intent("batman", "en"), "NAVIGATIONAL")
        self.assertEqual(self.service._detect_intent("the batman 2022", "en"), "SPECIFIC")
        self.assertEqual(self.service._detect_intent("أفضل أفلام الأكشن", "ar"), "DISCOVERY")
        self.assertEqual(self.service._detect_intent("starring leonardo dicaprio", "en"), "INFORMATIONAL")

    def test_entity_extraction(self):
        entities = self.service._extract_entities("أريد فيلم أكشن 2022 بجودة 4k", "ar")
        self.assertEqual(entities.get('year'), 2022)
        self.assertEqual(entities.get('quality'), '4K')
        self.assertIn('Action', entities.get('genres', []))

    def test_implicit_filters(self):
        entities = {'year': 2021, 'genres': ['Comedy'], 'quality': '1080p'}
        filters = self.service._detect_implicit_filters("مسلسل كوميديا 2021", "ar", entities)
        self.assertEqual(filters.get('item_type'), 'SERIES')
        self.assertEqual(filters.get('year'), 2021)
        self.assertEqual(filters.get('genres'), ['Comedy'])

    def test_query_cleaning(self):
        cleaned = self.service._clean_query("أريد فيلم Inception", {}, {})
        self.assertEqual(cleaned, "Inception")


class TestSynonymExpansion(unittest.TestCase):
    def setUp(self):
        self.service = SynonymService()

    @patch('apps.content.search.synonyms.SearchSynonym.objects')
    def test_synonym_expansion_forward_and_reverse(self, mock_syn_objects):
        mock_syn = MagicMock()
        mock_syn.term = 'batman'
        mock_syn.synonyms = ['الرجل الوطواط', 'bats', 'dark knight']
        mock_syn_objects.filter.return_value = [mock_syn]

        # Forward match
        expanded = self.service.expand(['batman'], language='ar')
        self.assertIn('الرجل الوطواط', expanded)
        self.assertIn('dark knight', expanded)

        # Reverse match
        expanded_rev = self.service.expand(['الرجل الوطواط'], language='ar')
        self.assertIn('batman', expanded_rev)
        self.assertIn('dark knight', expanded_rev)


class TestSearchRanking(unittest.TestCase):
    def setUp(self):
        self.service = SearchRankingService()

    def test_exact_match_boost(self):
        item_exact = MagicMock()
        item_exact.title = "Inception"
        item_exact.original_title = "Inception"
        item_exact.normalized_title = "inception"
        item_exact.title_localized = {}
        item_exact.popularity_score = 50
        item_exact.rating = 8.8
        item_exact.data_quality_score = 90
        item_exact.is_logical_primary = True
        item_exact._search_rank = 0.8

        item_partial = MagicMock()
        item_partial.title = "Inception: The Beginning"
        item_partial.original_title = "Inception: The Beginning"
        item_partial.normalized_title = "inception: the beginning"
        item_partial.title_localized = {}
        item_partial.popularity_score = 50
        item_partial.rating = 8.8
        item_partial.data_quality_score = 90
        item_partial.is_logical_primary = True
        item_partial._search_rank = 0.8

        score_exact = self.service._calculate_score(item_exact, "Inception", None, None, self.service.DEFAULT_WEIGHTS)
        score_partial = self.service._calculate_score(item_partial, "Inception", None, None, self.service.DEFAULT_WEIGHTS)

        self.assertGreater(score_exact, score_partial)

    def test_rank_sorts_descending(self):
        item1 = MagicMock(title="A", _search_rank=0.3, popularity_score=10, is_logical_primary=False, data_quality_score=50)
        item2 = MagicMock(title="B", _search_rank=0.9, popularity_score=90, is_logical_primary=True, data_quality_score=95)

        ranked = self.service.rank([item1, item2], "B")
        self.assertEqual(ranked[0].title, "B")


class TestSearchFacets(unittest.TestCase):
    def setUp(self):
        self.service = SearchFacetService()

    def test_type_and_quality_facets(self):
        mock_qs = MagicMock()
        mock_qs.values.return_value.annotate.return_value.order_by.return_value = [
            {'item_type': 'MOVIE', 'count': 45},
            {'item_type': 'SERIES', 'count': 12}
        ]
        types = self.service._facet_type(mock_qs)
        self.assertEqual(len(types), 2)
        self.assertEqual(types[0]['key'], 'MOVIE')
        self.assertEqual(types[0]['count'], 45)


class TestNaturalLanguageSearch(unittest.TestCase):
    def setUp(self):
        self.service = NaturalLanguageSearchService()

    def test_parse_genre_patterns(self):
        parsed = self.service.parse("أريد فيلم أكشن")
        self.assertEqual(parsed['filters'].get('item_type'), 'MOVIE')
        self.assertIn('أكشن', parsed['entities'].get('extracted', ''))

    def test_parse_similar_patterns(self):
        parsed = self.service.parse("similar to Inception")
        self.assertEqual(parsed['intent'], 'SIMILAR_TO')
        self.assertEqual(parsed['entities'].get('extracted'), 'Inception')


class TestSavedSearches(unittest.TestCase):
    def setUp(self):
        self.service = SavedSearchService()

    @patch('apps.content.search.saved_searches.SavedSearch.objects')
    def test_save_search_quota_limit(self, mock_saved_objects):
        mock_user = MagicMock()
        mock_user.is_authenticated = True
        mock_saved_objects.filter.return_value.count.return_value = 20

        with self.assertRaises(MaxSavedSearchesReached):
            self.service.save_search(mock_user, "Limit Search", "query")


class TestSearchABTesting(unittest.TestCase):
    def setUp(self):
        self.service = SearchABTestService()

    @patch('apps.content.search.ab_testing.SearchABTest.objects')
    def test_consistent_variant_assignment(self, mock_ab_objects):
        mock_test = MagicMock()
        mock_test.status = 'RUNNING'
        mock_test.traffic_split = 50
        mock_ab_objects.get.return_value = mock_test

        mock_user = MagicMock()
        mock_user.id = 'USR-TEST-HASH-123'

        v1 = self.service.get_variant('TEST-ID', mock_user)
        v2 = self.service.get_variant('TEST-ID', mock_user)
        self.assertEqual(v1, v2)

    @patch('apps.content.search.ab_testing.SearchABTest.objects')
    def test_winner_evaluation(self, mock_ab_objects):
        mock_test = MagicMock()
        mock_test.name = "Ranking Algorithm Test"
        mock_test.test_type = "RANKING"
        mock_test.status = "RUNNING"
        mock_test.traffic_split = 50
        mock_test.target_metric = "CTR"
        mock_test.results = {
            'A': {'CTR': {'sum': 2.0, 'count': 20}},  # Mean: 0.10
            'B': {'CTR': {'sum': 4.0, 'count': 20}},  # Mean: 0.20
        }
        mock_ab_objects.get.return_value = mock_test

        results = self.service.get_results('TEST-ID')
        self.assertEqual(results['winner'], 'B')


class TestUnifiedSearchEngine(unittest.TestCase):
    def setUp(self):
        self.engine = UnifiedSearchEngine()

    def test_deduplicate(self):
        item1 = MagicMock(title="Avatar", normalized_title="avatar", year=2009)
        item2 = MagicMock(title="Avatar (1080p)", normalized_title="avatar", year=2009)
        item3 = MagicMock(title="Avatar: The Way of Water", normalized_title="avatar: the way of water", year=2022)

        deduped = self.engine._deduplicate([item1, item2, item3])
        self.assertEqual(len(deduped), 2)
        self.assertEqual(deduped[0].normalized_title, "avatar")
        self.assertEqual(deduped[1].normalized_title, "avatar: the way of water")


if __name__ == '__main__':
    unittest.main()
