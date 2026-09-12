"""
Phase 16: Natural Language Search Service (Pattern-based)
Translates conversational natural queries in Arabic and English into structured parameters.
"""
import re
from typing import Dict, Any, Optional
from django.utils import timezone
from apps.content.models import MediaItem, normalize_search_text


class NaturalLanguageSearchService:
    """
    Pattern-based Natural Language Query parser and runner.
    """

    PATTERNS = {
        'discover_by_genre': {
            'ar': [
                r'أريد\s+(?:فيلم|أفلام|مسلسل|مسلسلات)\s+(.+?)(?:\s|$)',
                r'اريد\s+(?:فيلم|أفلام|مسلسل|مسلسلات)\s+(.+?)(?:\s|$)',
                r'اعطني\s+(.+?)\s+(?:فيلم|أفلام|مسلسل|مسلسلات)',
                r'وريني\s+(.+?)\s+(?:فيلم|أفلام|مسلسل|مسلسلات)',
            ],
            'en': [
                r'(?:i want|show me|give me|find me)\s+(.+?)\s+(?:movie|movies|series|show|shows)',
                r'(?:movie|movies|series|show|shows)\s+(?:about|in)\s+(.+)',
            ],
        },
        'discover_by_actor': {
            'ar': [
                r'(?:فيلم|أفلام|مسلسل|مسلسلات)\s+(?:بطولة|مع|تمثيل)\s+(.+)',
                r'(?:أعمال|افلام|أفلام)\s+(?:الممثل|الممثلة|الفنان)\s+(.+)',
            ],
            'en': [
                r'(?:movie|movies|series|show|shows)\s+with\s+(.+)',
                r'starring\s+(.+)',
                r'acted by\s+(.+)',
            ],
        },
        'recent_by_genre': {
            'ar': [
                r'(?:أحدث|احدث|جديد|آخر|اخر)\s+(?:فيلم|أفلام|مسلسل|مسلسلات)\s+(.+)',
            ],
            'en': [
                r'(?:recent|new|latest|newest)\s+(?:movie|movies|series|show|shows)\s+(.+)',
            ],
        },
        'similar_to': {
            'ar': [
                r'(?:مشابه|يشبه|مثل|شبيه)\s+(?:بـ|لـ|فيلم|مسلسل)?\s*(.+)',
            ],
            'en': [
                r'(?:similar to|like|same as|movies like)\s+(.+)',
            ],
        },
    }

    def parse(self, query: str, language: str = 'auto') -> Dict[str, Any]:
        """
        Parses NL phrase and extracts structured intent, entities, and filter dict.
        """
        clean_q = query.strip() if query else ""
        if language == 'auto':
            has_arabic = bool(re.search(r'[\u0600-\u06FF]', clean_q))
            lang = 'ar' if has_arabic else 'en'
        else:
            lang = language

        result = {
            'intent': 'SEARCH',
            'entities': {},
            'filters': {},
            'cleaned_query': clean_q,
            'language': lang,
        }

        # Check media type hints
        q_lower = clean_q.lower()
        if any(w in q_lower for w in ['فيلم', 'أفلام', 'افلام', 'movie', 'film']):
            result['filters']['item_type'] = 'MOVIE'
        elif any(w in q_lower for w in ['مسلسل', 'مسلسلات', 'series', 'show']):
            result['filters']['item_type'] = 'SERIES'

        # Match regex patterns
        matched = False
        for intent_name, patterns_by_lang in self.PATTERNS.items():
            lang_patterns = patterns_by_lang.get(lang, [])
            for pattern in lang_patterns:
                match = re.search(pattern, clean_q, re.IGNORECASE)
                if match:
                    extracted = match.group(1).strip()
                    result['intent'] = intent_name.upper()
                    result['entities']['extracted'] = extracted
                    result['cleaned_query'] = extracted

                    if 'recent' in intent_name:
                        result['filters']['year_from'] = timezone.now().year - 2

                    matched = True
                    break
            if matched:
                break

        return result

    def search_nl(
        self,
        user: Any,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """
        Executes NL search using the unified search engine.
        """
        parsed = self.parse(query)
        from apps.content.search.engine import UnifiedSearchEngine

        search_result = UnifiedSearchEngine().search(
            user=user,
            query=parsed['cleaned_query'],
            filters=parsed['filters'],
            page=page,
            page_size=page_size,
            search_type='NL',
        )

        search_result['nl_parse'] = parsed

        # If similarity intent was requested, enrich with reference item if found
        if parsed['intent'] == 'SIMILAR_TO':
            ref_name = parsed['entities'].get('extracted', '')
            ref_item = self._find_reference_item(ref_name, user)
            if ref_item:
                search_result['reference_item'] = {
                    'id': str(ref_item.id),
                    'title': ref_item.title,
                    'original_title': ref_item.original_title,
                    'year': ref_item.year,
                    'genres': ref_item.genres,
                }

        return search_result

    def _find_reference_item(self, name: str, user: Any) -> Optional[MediaItem]:
        """Finds candidate reference media item by title."""
        if not name:
            return None
        norm_name = normalize_search_text(name).lower()

        qs = MediaItem.objects.all()
        if user and getattr(user, 'tenant', None):
            qs = qs.filter(library__server__tenant=user.tenant)

        item = qs.filter(
            title__iexact=name
        ).first() or qs.filter(
            normalized_title__icontains=norm_name
        ).first()

        return item
