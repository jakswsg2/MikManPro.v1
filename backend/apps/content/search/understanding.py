"""
Phase 16: Query Understanding Service
Understands user search intent, detects language, extracts entities (genres, years, actors),
and infers implicit filters from natural search phrases.
"""
import re
from typing import Dict, Any, Optional
from django.utils import timezone


class QueryUnderstandingService:
    """
    Analyzes raw user queries to extract language, intent, structured entities,
    and convert conversational terms into executable database filters.
    """

    GENRE_MAP_AR = {
        'أكشن': 'Action',
        'اكشن': 'Action',
        'رعب': 'Horror',
        'كوميدي': 'Comedy',
        'كوميديا': 'Comedy',
        'دراما': 'Drama',
        'خيال': 'Sci-Fi',
        'خيال علمي': 'Sci-Fi',
        'رومانسي': 'Romance',
        'رومانسية': 'Romance',
        'وثائقي': 'Documentary',
        'أنمي': 'Animation',
        'انمي': 'Animation',
        'رسوم متحركة': 'Animation',
        'إثارة': 'Thriller',
        'اثارة': 'Thriller',
        'مغامرة': 'Adventure',
        'جريمة': 'Crime',
        'عائلي': 'Family',
        'غموض': 'Mystery',
        'تاريخي': 'History',
        'موسيقى': 'Music',
        'حرب': 'War',
        'غرب أمريكي': 'Western',
    }

    GENRE_MAP_EN = {
        'action': 'Action',
        'horror': 'Horror',
        'comedy': 'Comedy',
        'drama': 'Drama',
        'sci-fi': 'Sci-Fi',
        'scifi': 'Sci-Fi',
        'science fiction': 'Sci-Fi',
        'romance': 'Romance',
        'documentary': 'Documentary',
        'animation': 'Animation',
        'anime': 'Animation',
        'thriller': 'Thriller',
        'adventure': 'Adventure',
        'crime': 'Crime',
        'family': 'Family',
        'mystery': 'Mystery',
        'history': 'History',
        'music': 'Music',
        'war': 'War',
        'western': 'Western',
    }

    DISCOVERY_KEYWORDS_AR = [
        'جديد', 'حديث', 'رائج', 'الأفضل', 'الافضل', 'أفضل', 'افضل',
        'أحدث', 'احدث', 'توب', 'مقترح', 'احسن', 'أحسن', 'اقوى', 'أقوى', 'افلام', 'أفلام'
    ]
    DISCOVERY_KEYWORDS_EN = ['new', 'latest', 'trending', 'best', 'top', 'popular', 'recommended', 'recent']

    def analyze(self, query: str, user: Optional[Any] = None) -> Dict[str, Any]:
        """
        Processes query through intent, entity extraction, and implicit filtering pipeline.
        """
        raw_query = query.strip() if query else ""
        query_lower = raw_query.lower()

        # 1. Language Detection
        language = self._detect_language(raw_query)

        # 2. Intent Detection
        intent = self._detect_intent(query_lower, language)

        # 3. Entity Extraction
        entities = self._extract_entities(raw_query, language)

        # 4. Implicit Filters
        implicit_filters = self._detect_implicit_filters(raw_query, language, entities)

        # 5. Cleaned Search Term
        cleaned_query = self._clean_query(raw_query, implicit_filters, entities)

        return {
            'language': language,
            'intent': intent,
            'entities': entities,
            'implicit_filters': implicit_filters,
            'cleaned_query': cleaned_query,
            'original_query': raw_query,
        }

    def _detect_language(self, query: str) -> str:
        """Detects whether query contains Arabic, Latin, or mixed characters."""
        has_arabic = bool(re.search(r'[\u0600-\u06FF]', query))
        has_latin = bool(re.search(r'[a-zA-Z]', query))

        if has_arabic and has_latin:
            return 'mixed'
        elif has_arabic:
            return 'ar'
        elif has_latin:
            return 'en'
        return 'mixed'

    def _detect_intent(self, query_lower: str, language: str) -> str:
        """
        Determines user intent:
        - NAVIGATIONAL: direct title search.
        - INFORMATIONAL: actor/director/theme questions.
        - DISCOVERY: broad genre/discovery queries (e.g. "top action movies").
        - SPECIFIC: exact item queries with year (e.g. "The Batman 2022").
        """
        # Specific match with exact year
        if re.search(r'\b(19|20)\d{2}\b', query_lower):
            return 'SPECIFIC'

        # Discovery match for English
        for kw in self.DISCOVERY_KEYWORDS_EN:
            if re.search(r'\b' + re.escape(kw) + r'\b', query_lower, re.IGNORECASE):
                return 'DISCOVERY'

        # Discovery match for Arabic (direct token / substring match)
        for kw in self.DISCOVERY_KEYWORDS_AR:
            if kw in query_lower:
                return 'DISCOVERY'

        # Informational match
        info_markers = ['من هو', 'بطولة', 'إخراج', 'طاقم', 'about', 'starring', 'directed by', 'cast']
        for marker in info_markers:
            if marker in query_lower:
                return 'INFORMATIONAL'

        return 'NAVIGATIONAL'

    def _extract_entities(self, query: str, language: str) -> Dict[str, Any]:
        """Extracts recognized years, genres, media types, and quality references."""
        entities = {}
        query_lower = query.lower()

        # Year
        year_match = re.search(r'\b(19\d{2}|20\d{2})\b', query)
        if year_match:
            entities['year'] = int(year_match.group(1))

        # Resolution / Quality
        quality_markers = {'4k': '4K', '2160p': '4K', '1080p': '1080p', 'fhd': '1080p', '720p': '720p', 'hd': '720p'}
        for qm, norm_q in quality_markers.items():
            if re.search(r'\b' + re.escape(qm) + r'\b', query_lower):
                entities['quality'] = norm_q
                break

        # Genres
        detected_genres = []
        for ar_name, en_genre in self.GENRE_MAP_AR.items():
            if ar_name in query:
                if en_genre not in detected_genres:
                    detected_genres.append(en_genre)

        for en_key, en_genre in self.GENRE_MAP_EN.items():
            if re.search(r'\b' + re.escape(en_key) + r'\b', query_lower):
                if en_genre not in detected_genres:
                    detected_genres.append(en_genre)

        if detected_genres:
            entities['genres'] = detected_genres

        return entities

    def _detect_implicit_filters(self, query: str, language: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Maps query tokens to database filter criteria."""
        filters = {}
        q_lower = query.lower()

        # Item Type
        movie_words = ['فيلم', 'أفلام', 'افلام', 'movie', 'movies', 'film', 'films']
        series_words = ['مسلسل', 'مسلسلات', 'series', 'tv show', 'tv shows', 'show', 'shows']
        audio_words = ['أغنية', 'اغنية', 'أغاني', 'اغاني', 'موسيقى', 'music', 'track', 'song', 'songs', 'album']

        if any(w in q_lower for w in movie_words):
            filters['item_type'] = 'MOVIE'
        elif any(w in q_lower for w in series_words):
            filters['item_type'] = 'SERIES'
        elif any(w in q_lower for w in audio_words):
            filters['item_type'] = 'TRACK'

        # Year filter from entities
        if 'year' in entities:
            filters['year'] = entities['year']

        # Genres from entities
        if 'genres' in entities and entities['genres']:
            filters['genres'] = entities['genres']

        # Quality from entities
        if 'quality' in entities:
            filters['resolution'] = entities['quality']

        # Discovery recent filter
        recent_words = ['جديد', 'حديث', 'أحدث', 'احدث', 'new', 'recent', 'latest']
        if any(w in q_lower for w in recent_words) and 'year' not in filters:
            current_year = timezone.now().year
            filters['year_from'] = current_year - 2

        return filters

    def _clean_query(self, query: str, filters: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Strips generic noise words and recognized filter stopwords from search query."""
        stop_words = [
            'فيلم', 'افلام', 'أفلام', 'movie', 'film', 'movies', 'films',
            'مسلسل', 'مسلسلات', 'series', 'show', 'shows', 'tv',
            'جديد', 'حديث', 'أحدث', 'احدث', 'new', 'recent', 'latest',
            'أريد', 'اريد', 'اعطني', 'أعطني', 'وريني', 'شاهد', 'ابحث عن',
            'i want', 'show me', 'give me', 'find me', 'watch', 'search for'
        ]

        # Also remove recognized genre names if query has other content
        words = query.split()
        cleaned_words = []
        for w in words:
            w_strip = w.strip('،,.!?:;')
            if w_strip.lower() not in stop_words:
                cleaned_words.append(w)

        cleaned = ' '.join(cleaned_words).strip()
        return cleaned or query
