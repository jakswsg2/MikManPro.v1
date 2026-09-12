"""
Phase 16: Saved Searches Service
Handles user-saved search queries, automated alert schedules, and checks for new arrivals.
"""
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.content.models import SavedSearch, MediaItem


class MaxSavedSearchesReached(ValidationError):
    pass


class SavedSearchService:
    """
    Manages custom saved searches and automated content update triggers.
    """

    MAX_SAVED = 20

    def save_search(
        self,
        user: Any,
        name: str,
        query: str = "",
        filters: Optional[Dict[str, Any]] = None,
        notification_enabled: bool = False,
        notification_frequency: str = 'WEEKLY',
    ) -> SavedSearch:
        """Saves a new user search query with maximum quota validation."""
        if not user or not getattr(user, 'is_authenticated', False):
            raise ValidationError("Authentication required to save searches")

        current_count = SavedSearch.objects.filter(user=user).count()
        if current_count >= self.MAX_SAVED:
            raise MaxSavedSearchesReached(f"Maximum limit of {self.MAX_SAVED} saved searches reached.")

        saved = SavedSearch.objects.create(
            user=user,
            tenant=user.tenant,
            name=name.strip() or query.strip() or "Saved Search",
            query=query.strip(),
            filters=filters or {},
            notification_enabled=notification_enabled,
            notification_frequency=notification_frequency,
            last_notified_at=timezone.now(),
        )
        return saved

    def update_saved_search(
        self,
        user: Any,
        saved_id: str,
        name: Optional[str] = None,
        query: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        notification_enabled: Optional[bool] = None,
        notification_frequency: Optional[str] = None,
    ) -> SavedSearch:
        """Updates properties of an existing saved search."""
        saved = SavedSearch.objects.get(user=user, id=saved_id)

        if name is not None:
            saved.name = name.strip()
        if query is not None:
            saved.query = query.strip()
        if filters is not None:
            saved.filters = filters
        if notification_enabled is not None:
            saved.notification_enabled = notification_enabled
        if notification_frequency is not None:
            saved.notification_frequency = notification_frequency

        saved.save()
        return saved

    def delete_saved_search(self, user: Any, saved_id: str) -> bool:
        """Deletes a saved search owned by the user."""
        deleted_count = SavedSearch.objects.filter(user=user, id=saved_id).delete()[0]
        return deleted_count > 0

    def list_saved_searches(self, user: Any) -> List[Dict[str, Any]]:
        """Returns all saved searches belonging to the user."""
        if not user or not getattr(user, 'is_authenticated', False):
            return []

        qs = SavedSearch.objects.filter(user=user).order_by('-created_at')
        return [
            {
                'id': str(s.id),
                'name': s.name,
                'query': s.query,
                'filters': s.filters,
                'notification_enabled': s.notification_enabled,
                'notification_frequency': s.notification_frequency,
                'last_notified_at': s.last_notified_at.isoformat() if s.last_notified_at else None,
                'created_at': s.created_at.isoformat() if s.created_at else None,
            }
            for s in qs
        ]

    def run_saved_search(self, saved: SavedSearch, user: Any, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Executes the search query and filters stored in the saved search."""
        from apps.content.search.engine import UnifiedSearchEngine
        return UnifiedSearchEngine().search(
            user=user,
            query=saved.query,
            filters=saved.filters,
            page=page,
            page_size=page_size,
        )

    def check_for_new_results(self, saved: SavedSearch) -> int:
        """Checks if new items have arrived since last notification date."""
        since = saved.last_notified_at or saved.created_at
        qs = MediaItem.objects.filter(
            library__server__tenant=saved.tenant,
            status='PUBLISHED',
            created_at__gt=since
        )
        # Apply genre/item_type filters if specified in saved filters
        filters = saved.filters or {}
        if 'item_type' in filters:
            qs = qs.filter(item_type=filters['item_type'])
        if 'genres' in filters and filters['genres']:
            qs = qs.filter(genres__overlap=filters['genres'])
        return qs.count()
