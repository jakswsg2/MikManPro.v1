"""
Phase 4: Celery Background Tasks for Scheduled, Incremental & Reconciliation Media Sync
Decision 56: Smart Job Orchestration Engine (Celery + Redis)
"""
import logging
from celery import shared_task
from apps.media_servers.models import MediaServer, SyncJob
from apps.content.sync_engine import MediaSyncEngine

logger = logging.getLogger(__name__)


@shared_task(name="apps.content.tasks.sync_media_server_task")
def sync_media_server_task(server_id: str, sync_type: str = SyncJob.SyncType.INCREMENTAL, library_id: str = None):
    """Executes synchronization for a specific MediaServer in the background."""
    logger.info(f"Starting Celery sync job for MediaServer {server_id}, type={sync_type}")
    try:
        server = MediaServer.objects.get(id=server_id)
        job = MediaSyncEngine.run_sync(server, sync_type=sync_type, library_id=library_id)
        return {
            "status": job.status,
            "job_id": str(job.id),
            "scanned": job.items_scanned,
            "created": job.items_created,
            "updated": job.items_updated
        }
    except MediaServer.DoesNotExist:
        logger.error(f"MediaServer {server_id} not found for sync task")
        return {"error": "Server not found"}
    except Exception as e:
        logger.error(f"Failed sync task for server {server_id}: {str(e)}", exc_info=True)
        return {"error": str(e)}


@shared_task(name="apps.content.tasks.sync_all_active_servers_task")
def sync_all_active_servers_task(sync_type: str = SyncJob.SyncType.INCREMENTAL):
    """Dispatches background sync tasks for all active MediaServers."""
    active_servers = MediaServer.objects.filter(is_active=True)
    logger.info(f"Dispatching sync for {active_servers.count()} active servers (type={sync_type})")
    dispatched = []
    for server in active_servers:
        task_res = sync_media_server_task.delay(str(server.id), sync_type=sync_type)
        dispatched.append({"server_id": str(server.id), "task_id": task_res.id})
    return {"dispatched_count": len(dispatched), "servers": dispatched}


@shared_task(name="apps.content.tasks.reconcile_all_catalogs_task")
def reconcile_all_catalogs_task():
    """Runs scheduled periodic catalog reconciliation across all servers."""
    return sync_all_active_servers_task(sync_type=SyncJob.SyncType.RECONCILIATION)


# =============================================================================
# Phase 16: Search Background & Scheduled Tasks
# =============================================================================

@shared_task(name="apps.content.tasks.rebuild_search_index_task")
def rebuild_search_index_task(tenant_id: str = None):
    """
    Rebuilds and re-normalizes search vectors and normalized titles for MediaItems.
    """
    from apps.content.models import MediaItem, normalize_search_text, normalize_arabic_text
    logger.info(f"Starting rebuild_search_index_task (tenant_id={tenant_id})")

    qs = MediaItem.objects.all()
    if tenant_id:
        qs = qs.filter(library__server__tenant_id=tenant_id)

    total = qs.count()
    updated = 0

    for item in qs.iterator(chunk_size=500):
        norm_title = normalize_search_text(item.title)
        norm_ar_title = normalize_arabic_text(item.title)
        item.normalized_title = norm_title
        item.normalized_title_ar = norm_ar_title
        item.save(update_fields=['normalized_title', 'normalized_title_ar'])
        updated += 1

    logger.info(f"Completed rebuild_search_index_task: {updated}/{total} items indexed")
    return {"total": total, "updated": updated}


@shared_task(name="apps.content.tasks.cleanup_old_search_history_task")
def cleanup_old_search_history_task(days: int = 90):
    """
    Cleans up old search history records beyond retention window (GDPR compliance).
    """
    from datetime import timedelta
    from django.utils import timezone
    from apps.content.models import SearchQuery

    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = SearchQuery.objects.filter(created_at__lt=cutoff).delete()
    logger.info(f"Cleaned up {deleted} old search query records older than {days} days")
    return {"deleted": deleted, "cutoff": cutoff.isoformat()}


@shared_task(name="apps.content.tasks.notify_saved_searches_task")
def notify_saved_searches_task():
    """
    Evaluates active Saved Searches and creates notifications when new matching items exist.
    """
    from django.utils import timezone
    from apps.content.models import SavedSearch
    from apps.content.search.saved_searches import SavedSearchService

    service = SavedSearchService()
    active_saved = SavedSearch.objects.filter(notification_enabled=True)
    notified_count = 0

    for saved in active_saved:
        new_count = service.check_for_new_results(saved)
        if new_count > 0:
            saved.last_notified_at = timezone.now()
            saved.save(update_fields=['last_notified_at'])
            notified_count += 1
            logger.info(f"Triggered notification for saved search '{saved.name}' (user={saved.user_id}, new_items={new_count})")

    return {"evaluated": active_saved.count(), "notified": notified_count}


@shared_task(name="apps.content.tasks.refresh_search_suggestions_task")
def refresh_search_suggestions_task():
    """
    Calculates high-frequency queries and refreshes automated search suggestions.
    """
    from datetime import timedelta
    from django.utils import timezone
    from django.db.models import Count
    from apps.content.models import SearchQuery, SearchSuggestion

    cutoff = timezone.now() - timedelta(days=7)
    top_queries = SearchQuery.objects.filter(
        created_at__gte=cutoff,
        results_count__gt=0
    ).exclude(query_text='').values('tenant', 'query_text').annotate(
        freq=Count('id')
    ).filter(freq__gte=5).order_by('-freq')[:50]

    created = 0
    for row in top_queries:
        tenant_id = row['tenant']
        text = row['query_text']
        obj, was_created = SearchSuggestion.objects.get_or_create(
            tenant_id=tenant_id,
            text=text,
            defaults={
                'suggestion_type': SearchSuggestion.SuggestionType.TRENDING,
                'priority': 50,
                'icon': 'Flame'
            }
        )
        if was_created:
            created += 1

    return {"auto_suggestions_created": created}

