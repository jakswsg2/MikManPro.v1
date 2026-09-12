"""
Phase 16: Search Synonym Expansion Service
Expands search tokens using Tenant-specific and Global synonyms database.
"""
from typing import List, Optional, Any
from django.db.models import Q
from apps.content.models import SearchSynonym


class SynonymService:
    """
    Service for expanding user search terms with language and localized synonyms.
    Supports bi-directional mapping (e.g. 'batman' <-> 'الرجل الوطواط').
    """

    def expand(self, terms: List[str], language: str = 'ar', tenant: Optional[Any] = None) -> List[str]:
        """
        Expands a list of tokens into their recognized synonyms from the database.
        """
        if not terms:
            return []

        # Query active synonyms matching language or cross-language
        filter_kwargs = {'is_active': True}
        q_obj = Q()
        if language and language != 'mixed':
            q_obj &= (Q(language=language) | Q(language='mixed'))

        if tenant:
            q_obj &= (Q(tenant=tenant) | Q(tenant__isnull=True))
        else:
            filter_kwargs['tenant__isnull'] = True

        synonyms_qs = SearchSynonym.objects.filter(q_obj, **filter_kwargs)
        synonym_records = list(synonyms_qs)
        expanded = list(terms)

        for term in terms:
            t_lower = term.lower().strip()
            for syn in synonym_records:
                # 1. Forward match: term matches primary term
                if syn.term.lower().strip() == t_lower:
                    expanded.extend(syn.synonyms)
                # 2. Reverse match: term exists in synonyms list
                elif any(s.lower().strip() == t_lower for s in syn.synonyms):
                    expanded.append(syn.term)
                    expanded.extend(s for s in syn.synonyms if s.lower().strip() != t_lower)

        # Deduplicate while preserving order
        seen = set()
        unique_expanded = []
        for item in expanded:
            item_clean = item.strip()
            if item_clean and item_clean.lower() not in seen:
                seen.add(item_clean.lower())
                unique_expanded.append(item_clean)

        return unique_expanded
