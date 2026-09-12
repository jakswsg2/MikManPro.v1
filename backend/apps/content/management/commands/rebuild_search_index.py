"""
Phase 16 Management Command: Rebuild Search Index
Normalizes titles, recalculates vectors and clears stale search caches.
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache
from apps.content.tasks import rebuild_search_index_task


class Command(BaseCommand):
    help = "Rebuilds Search Indexes and normalizes Arabic and English media titles."

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='Filter rebuild to a specific Tenant UUID',
            default=None
        )
        parser.add_argument(
            '--clear-cache',
            action='store_true',
            help='Clear search affinity and ranking config caches',
            default=False
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant')
        clear_cache = options.get('clear_cache')

        self.stdout.write(self.style.NOTICE(f"Rebuilding search indexes (tenant={tenant_id})..."))

        if clear_cache:
            cache.clear()
            self.stdout.write(self.style.SUCCESS("Cleared application cache successfully."))

        result = rebuild_search_index_task(tenant_id=tenant_id)
        self.stdout.write(self.style.SUCCESS(
            f"Successfully updated {result.get('updated')}/{result.get('total')} items."
        ))
