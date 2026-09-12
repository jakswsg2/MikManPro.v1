"""
Phase 16: Advanced Multi-Factor Search Ranking Service
Computes dynamic relevance scores based on text matching, popularity, recency,
user affinity, data quality score, trending status, and exact title matches.
"""
from typing import List, Dict, Any, Optional
from django.utils import timezone
from django.db.models import Q
from django.core.cache import cache
from apps.content.models import SearchRankingConfig


class SearchRankingService:
    """
    Advanced ranking engine for unified search results.
    Combines IR scoring with domain-specific signals and personalized user affinity.
    """

    DEFAULT_WEIGHTS = {
        'text_match': 0.35,
        'exact_match': 0.15,
        'popularity': 0.10,
        'recency': 0.10,
        'user_affinity': 0.10,
        'quality_score': 0.10,
        'trending': 0.05,
        'external_rating': 0.05,
        'exact_match_boost': 1.5,
        'title_boost': 2.0,
        'genre_boost': 1.15,
    }

    def rank(
        self,
        items: List[Any],
        query: str,
        user: Optional[Any] = None,
        context: Optional[Dict[str, Any]] = None,
        weights: Optional[Dict[str, float]] = None,
    ) -> List[Any]:
        """
        Ranks a list of MediaItem or search candidates using multi-factor scoring.
        """
        if not items:
            return []

        effective_weights = weights or self._get_weights(user)
        scored_items = []

        for item in items:
            score = self._calculate_score(item, query, user, context, effective_weights)
            # Store calculated score on item instance for inspection/sorting
            setattr(item, '_calculated_rank_score', score)
            scored_items.append((item, score))

        scored_items.sort(key=lambda x: x[1], reverse=True)
        return [item for item, _ in scored_items]

    def _calculate_score(
        self,
        item: Any,
        query: str,
        user: Optional[Any],
        context: Optional[Dict[str, Any]],
        weights: Dict[str, float],
    ) -> float:
        """Calculates normalized composite score for a single candidate item."""
        score = 0.0

        # 1. Text Match Score (FTS / Trigram / Precomputed rank)
        text_score = getattr(item, '_search_rank', getattr(item, 'rank', 0.5))
        try:
            if text_score is not None:
                score += float(text_score) * float(weights.get('text_match', 0.35))
        except (ValueError, TypeError):
            pass

        # 2. Exact Match Boost
        if self._is_exact_match(item, query):
            score += float(weights.get('exact_match', 0.15)) * float(weights.get('exact_match_boost', 1.5))

        # 3. Popularity Score (Normalized 0.0 - 1.0)
        popularity = getattr(item, 'popularity_score', None)
        try:
            if popularity is not None:
                norm_pop = min(1.0, float(popularity) / 100.0)
                score += norm_pop * float(weights.get('popularity', 0.10))
        except (ValueError, TypeError):
            pass

        # 4. Recency (Decay within 30 days)
        date_added = getattr(item, 'date_added', getattr(item, 'created_at', None))
        if date_added and hasattr(date_added, 'year'):
            try:
                days_old = max(0, (timezone.now() - date_added).days)
                if days_old < 30:
                    recency_decay = 1.0 - (days_old / 30.0) * 0.5
                    score += recency_decay * float(weights.get('recency', 0.10))
            except Exception:
                pass

        # 5. User Affinity (Personalized genre/actor/language preference)
        if user and getattr(user, 'is_authenticated', False) is True:
            try:
                affinity = float(self._get_user_affinity(item, user))
                score += affinity * float(weights.get('user_affinity', 0.10))
            except Exception:
                pass

        # 6. Data Quality Score (From Phase 15 enrichment)
        quality = getattr(item, 'data_quality_score', 80)
        try:
            if quality is not None:
                norm_quality = min(1.0, float(quality) / 100.0)
                score += norm_quality * float(weights.get('quality_score', 0.10))
        except (ValueError, TypeError):
            pass

        # 7. Trending
        trending = getattr(item, 'trending_score', None)
        is_trending = getattr(item, 'is_trending', False)
        if is_trending is True:
            score += float(weights.get('trending', 0.05))
        elif trending is not None:
            try:
                norm_trend = min(1.0, float(trending) / 50.0)
                score += norm_trend * float(weights.get('trending', 0.05))
            except (ValueError, TypeError):
                pass

        # 8. External Rating (TMDB / IMDb / Community rating)
        tmdb_rating = getattr(item, 'tmdb_rating', None) or getattr(item, 'rating', None) or getattr(item, 'community_rating', None)
        try:
            if tmdb_rating is not None:
                norm_rating = min(1.0, float(tmdb_rating) / 10.0)
                score += norm_rating * float(weights.get('external_rating', 0.05))
        except (ValueError, TypeError):
            pass

        # Preferred genres context multiplier
        if context and context.get('preferred_genres'):
            item_genres = getattr(item, 'genres', []) or []
            if isinstance(item_genres, (list, set, tuple)):
                if any(g in item_genres for g in context['preferred_genres']):
                    score *= float(weights.get('genre_boost', 1.15))

        # Deduplication primary version boost
        if getattr(item, 'is_logical_primary', False) is True:
            score += 0.05

        return float(score)

    def _is_exact_match(self, item: Any, query: str) -> bool:
        """Checks whether the candidate title exactly matches query in English or Arabic."""
        if not query:
            return False
        q_clean = query.strip().lower()

        raw_candidates = [
            getattr(item, 'title', ''),
            getattr(item, 'original_title', ''),
            getattr(item, 'normalized_title', ''),
        ]
        localized = getattr(item, 'title_localized', {}) or {}
        if isinstance(localized, dict):
            raw_candidates.extend(localized.values())

        for c in raw_candidates:
            if isinstance(c, str) and c.strip().lower() == q_clean:
                return True
        return False

    def _get_user_affinity(self, item: Any, user: Any) -> float:
        """Computes user affinity score for media candidate with caching."""
        user_id = str(getattr(user, 'id', 'anonymous'))
        cache_key = f"search:affinity:{user_id}"
        affinity_data = cache.get(cache_key)

        if not affinity_data:
            affinity_data = self._compute_affinity(user)
            cache.set(cache_key, affinity_data, timeout=3600)

        score = 0.0
        item_genres = getattr(item, 'genres', []) or []
        for genre in item_genres:
            score += affinity_data.get('genres', {}).get(genre, 0.0) * 0.6

        item_lang = getattr(item, 'original_language', None)
        if item_lang and item_lang in affinity_data.get('languages', []):
            score += 0.4

        return min(1.0, score)

    def _compute_affinity(self, user: Any) -> Dict[str, Any]:
        """Aggregates recent user playback and favorites to build personal affinity profile."""
        genres_freq: Dict[str, int] = {}
        languages_freq: Dict[str, int] = {}
        total_records = 0

        # Try to pull watch history from playback app if available
        try:
            from apps.playback.models import PlaybackSession
            recent_sessions = PlaybackSession.objects.filter(
                user=user
            ).select_related('media_item').order_by('-updated_at')[:30]

            for s in recent_sessions:
                m = getattr(s, 'media_item', None)
                if m:
                    total_records += 1
                    for g in (getattr(m, 'genres', []) or []):
                        genres_freq[g] = genres_freq.get(g, 0) + 1
                    lang = getattr(m, 'original_language', None)
                    if lang:
                        languages_freq[lang] = languages_freq.get(lang, 0) + 1
        except Exception:
            pass

        norm_total = max(1, total_records)
        return {
            'genres': {g: count / norm_total for g, count in genres_freq.items()},
            'languages': list(languages_freq.keys()),
        }

    def _get_weights(self, user: Optional[Any]) -> Dict[str, float]:
        """Loads tenant-specific ranking weights from database or defaults."""
        tenant_id = getattr(user, 'tenant_id', None) if user else None
        cache_key = f"search:ranking_config:{tenant_id or 'global'}"
        cached_weights = cache.get(cache_key)

        if cached_weights:
            return cached_weights

        config = None
        try:
            qs = SearchRankingConfig.objects.filter(is_active=True)
            if tenant_id:
                qs = qs.filter(Q(tenant_id=tenant_id) | Q(tenant__isnull=True)).order_by('-tenant_id')
            else:
                qs = qs.filter(tenant__isnull=True)
            config = qs.first()
        except Exception:
            pass

        weights = config.weights if (config and config.weights) else self.DEFAULT_WEIGHTS
        cache.set(cache_key, weights, timeout=3600)
        return weights
