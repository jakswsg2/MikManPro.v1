"""
Phase 16: Search Backend Adapters
"""
from apps.content.search.backends.base import SearchBackend
from apps.content.search.backends.postgresql import PostgreSQLSearchBackend
from apps.content.search.backends.opensearch import OpenSearchBackend, SearchBackendFactory

__all__ = ['SearchBackend', 'PostgreSQLSearchBackend', 'OpenSearchBackend', 'SearchBackendFactory']
