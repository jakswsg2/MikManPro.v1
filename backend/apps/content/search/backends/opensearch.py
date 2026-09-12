"""
Phase 16: OpenSearch Search Backend (Migration Path Placeholder)
"""
from typing import Dict, Any, List, Optional
from django.conf import settings
from apps.content.search.backends.base import SearchBackend
from apps.content.search.backends.postgresql import PostgreSQLSearchBackend


class OpenSearchBackend(SearchBackend):
    """
    OpenSearch / Elasticsearch Backend Adapter.
    Phase 16: Readiness placeholder for Phase 50 migration path.
    """

    def __init__(self):
        self.endpoint = getattr(settings, 'OPENSEARCH_URL', None)

    def search(
        self,
        base_qs,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        expanded_terms: Optional[List[str]] = None,
        understanding: Optional[Dict[str, Any]] = None,
    ):
        raise NotImplementedError("OpenSearch backend is scheduled for activation in Phase 50.")


class SearchBackendFactory:
    """
    Factory to select the active Search Backend based on Django settings.
    """

    @staticmethod
    def get_backend() -> SearchBackend:
        backend_type = getattr(settings, 'SEARCH_BACKEND', 'postgresql').lower()
        if backend_type == 'opensearch':
            return OpenSearchBackend()
        return PostgreSQLSearchBackend()
