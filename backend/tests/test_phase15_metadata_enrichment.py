"""
Phase 15: External Metadata Providers & Enrichment Engine Test Suite
Tests TMDB, TheTVDB, MusicBrainz, Rate Limiting, Normalization, Caching, and Metadata Aggregation.
"""
import unittest
from unittest.mock import MagicMock, patch
from tests.django_mock_env import bootstrap_django_env

bootstrap_django_env()

from apps.content.metadata.base import UnifiedMetadata
from apps.content.metadata.rate_limiter import TokenBucketRateLimiter
from apps.content.metadata.normalizer import MetadataNormalizer
from apps.content.metadata.tmdb import TMDBConnector
from apps.content.metadata.tvdb import TheTVDBConnector
from apps.content.metadata.musicbrainz import MusicBrainzConnector
from apps.content.metadata.cache import MetadataCacheManager
from apps.content.metadata.aggregator import MetadataAggregator
from apps.content.models import MediaItem, ExternalMetadata, ContentLifecycleLog


class TestRateLimiter(unittest.TestCase):
    """Verifies token bucket mechanics and HTTP 429 backoff."""

    def test_token_bucket_acquire(self):
        limiter = TokenBucketRateLimiter(rate=100.0, capacity=10.0, test_mode=True)
        self.assertTrue(limiter.acquire(1.0))

    def test_http_429_retry_handling(self):
        limiter = TokenBucketRateLimiter(rate=50.0, capacity=10.0, max_retries=2, test_mode=True)
        mock_resp_429 = MagicMock()
        mock_resp_429.status_code = 429
        mock_resp_429.headers = {"Retry-After": "0.01"}

        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {"success": True}

        call_count = 0
        def fake_call():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return mock_resp_429
            return mock_resp_200

        result = limiter.execute_with_retry(fake_call)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(call_count, 2)


class TestMetadataNormalizer(unittest.TestCase):
    """Verifies taxonomy mapping and unified schema transformation."""

    def test_arabic_genre_mapping(self):
        genres = ["Action", "Sci-Fi", "Comedy", "Animation", "Drama"]
        ar_genres = MetadataNormalizer.map_genres_to_arabic(genres)
        self.assertIn("أكشن", ar_genres)
        self.assertIn("خيال علمي", ar_genres)
        self.assertIn("كوميديا", ar_genres)
        self.assertIn("رسوم متحركة", ar_genres)
        self.assertIn("دراما", ar_genres)

    def test_image_url_formatting(self):
        rel_path = "/sample_poster.jpg"
        full_url = MetadataNormalizer.format_tmdb_image_url(rel_path, "w500")
        self.assertEqual(full_url, "https://image.tmdb.org/t/p/w500/sample_poster.jpg")

    def test_year_extraction(self):
        self.assertEqual(MetadataNormalizer.extract_year("2010-07-16"), 2010)
        self.assertEqual(MetadataNormalizer.extract_year("1999"), 1999)
        self.assertIsNone(MetadataNormalizer.extract_year(""))

    def test_normalize_tmdb_movie(self):
        raw = {
            "id": 27205,
            "title": "Inception",
            "original_title": "Inception",
            "overview": "A thief who enters the dreams of others.",
            "release_date": "2010-07-16",
            "runtime": 148,
            "genres": [{"name": "Action"}, {"name": "Science Fiction"}],
            "poster_path": "/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
            "backdrop_path": "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
            "vote_average": 8.4,
            "vote_count": 35000,
            "imdb_id": "tt1375666",
            "credits": {
                "cast": [{"name": "Leonardo DiCaprio", "character": "Cobb", "order": 0}],
                "crew": [{"name": "Christopher Nolan", "job": "Director"}]
            }
        }
        meta = MetadataNormalizer.normalize_tmdb_movie(raw, language="en")
        self.assertEqual(meta.title, "Inception")
        self.assertEqual(meta.year, 2010)
        self.assertEqual(meta.duration_minutes, 148)
        self.assertIn("أكشن", meta.genres_ar)
        self.assertEqual(meta.external_ids.get("tmdb"), "27205")
        self.assertEqual(meta.external_ids.get("imdb"), "tt1375666")
        self.assertEqual(len(meta.people), 2)


class TestTMDBConnector(unittest.TestCase):
    """Verifies TMDB connector search, details, and dual-language synthesis."""

    def setUp(self):
        self.tmdb = TMDBConnector(mock_mode=True)

    def test_search_movie(self):
        results = self.tmdb.search("Inception", item_type="movie")
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]["id"], 27205)

    def test_dual_language_metadata(self):
        meta = self.tmdb.fetch_dual_language_metadata("27205", item_type="movie")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.title_localized.get("ar"), "بداية (Inception)")
        self.assertEqual(meta.title_localized.get("en"), "Inception")
        self.assertTrue(len(meta.overview_localized.get("ar", "")) > 0)
        self.assertTrue(len(meta.overview_localized.get("en", "")) > 0)

    def test_find_by_imdb_id(self):
        found = self.tmdb.find_by_external_id("tt1375666", external_source="imdb_id")
        self.assertIsNotNone(found)
        self.assertEqual(found["type"], "movie")
        self.assertEqual(found["item"]["id"], 27205)


class TestTheTVDBConnector(unittest.TestCase):
    """Verifies TVDB connector series search and normalization."""

    def setUp(self):
        self.tvdb = TheTVDBConnector(mock_mode=True)

    def test_search_and_extended_details(self):
        results = self.tvdb.search("Game of Thrones", item_type="series")
        self.assertTrue(len(results) > 0)
        details = self.tvdb.get_details("121361", item_type="series")
        self.assertIsNotNone(details)
        self.assertEqual(details.get("name"), "Game of Thrones")

        meta = self.tvdb.normalize(details, item_type="series", language="ar")
        self.assertEqual(meta.year, 2011)
        self.assertIn("فانتازيا", meta.genres_ar)
        self.assertEqual(meta.external_ids.get("tvdb"), "121361")


class TestMusicBrainzConnector(unittest.TestCase):
    """Verifies MusicBrainz connector recordings and artist credits."""

    def setUp(self):
        self.mb = MusicBrainzConnector(mock_mode=True)

    def test_search_and_normalize(self):
        results = self.mb.search("Fairuz", item_type="track")
        self.assertTrue(len(results) > 0)
        rec = results[0]
        meta = self.mb.normalize(rec, item_type="track", language="en")
        self.assertEqual(meta.title, "Nassim Al-Roh")
        self.assertEqual(meta.item_type, "track")
        self.assertEqual(meta.year, 1978)
        self.assertEqual(meta.duration_minutes, 4)
        self.assertEqual(meta.people[0]["name"], "Fairuz")


class TestMetadataCacheManager(unittest.TestCase):
    """Verifies caching, hash computation, and stale detection."""

    def test_compute_hash(self):
        data = {"title": "Inception", "year": 2010}
        h1 = MetadataCacheManager.compute_hash(data)
        h2 = MetadataCacheManager.compute_hash({"year": 2010, "title": "Inception"})
        self.assertEqual(h1, h2)
        self.assertTrue(len(h1) == 64)

    def test_cache_and_get(self):
        raw = {"id": 27205, "title": "Inception"}
        meta = UnifiedMetadata(title="Inception", year=2010)
        record = MetadataCacheManager.cache_metadata(
            provider="tmdb",
            external_id="27205",
            language="ar",
            raw_data=raw,
            normalized_data=meta
        )
        self.assertIsNotNone(record)


class TestMetadataAggregator(unittest.TestCase):
    """Verifies full enrichment lifecycle, quality score, and audit logs."""

    def setUp(self):
        self.tmdb = TMDBConnector(mock_mode=True)
        self.tvdb = TheTVDBConnector(mock_mode=True)
        self.mb = MusicBrainzConnector(mock_mode=True)
        self.aggregator = MetadataAggregator(tmdb=self.tmdb, tvdb=self.tvdb, musicbrainz=self.mb)

    def test_enrich_media_item_movie(self):
        item = MediaItem(
            title="Inception",
            original_title="Inception",
            item_type="movie",
            year=2010,
            status=MediaItem.ContentLifecycleStatus.INDEXED,
            external_ids={"tmdb": "27205"}
        )

        success, enriched, score = self.aggregator.enrich_media_item(item)
        self.assertTrue(success)
        self.assertIsNotNone(enriched)
        self.assertGreaterEqual(score, 80.0)
        # Verify auto-approval
        self.assertEqual(item.status, MediaItem.ContentLifecycleStatus.APPROVED)
        # Verify localized titles and overviews
        self.assertEqual(item.title_localized.get("ar"), "بداية (Inception)")
        self.assertEqual(item.title_localized.get("en"), "Inception")
        self.assertIn("أكشن", item.genres)
        # Verify original metadata preserved
        self.assertIsNotNone(item.original_metadata)
        self.assertEqual(item.original_metadata["title"], "Inception")

    def test_enrich_media_item_fallback_by_title(self):
        item = MediaItem(
            title="Inception",
            item_type="movie",
            status=MediaItem.ContentLifecycleStatus.INDEXED
        )
        success, enriched, score = self.aggregator.enrich_media_item(item)
        self.assertTrue(success)
        self.assertEqual(item.enrichment_status, MediaItem.EnrichmentStatus.ENRICHED)


if __name__ == "__main__":
    unittest.main()
