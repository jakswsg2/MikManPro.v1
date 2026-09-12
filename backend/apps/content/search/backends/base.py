"""
Phase 16: Search Backend Base Interface
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class SearchBackend(ABC):
    """
    Abstract Search Backend contract for database-level query execution.
    Allows transparent switching between PostgreSQL and OpenSearch.
    """

    @abstractmethod
    def search(
        self,
        base_qs,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        expanded_terms: Optional[List[str]] = None,
        understanding: Optional[Dict[str, Any]] = None,
    ):
        """
        Executes search on target engine and returns matching candidates queryset or list.
        """
        pass
