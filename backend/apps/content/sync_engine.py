"""
Phase 4: Media Library Synchronization Engine
Decision 18 (Media Server owns files, Smart Lounge owns catalog)
Decision 19 (Hybrid Sync: Incremental + Full + Reconciliation)
"""
import logging
import uuid
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.db import transaction
from apps.media_servers.models import MediaServer, SyncJob
from apps.content.models import (
    Library, MediaItem, MediaSource, LogicalContentGroup,
    generate_content_hash, normalize_search_text, normalize_arabic_text
)
from apps.media_servers.connectors.jellyfin import JellyfinConnector
from apps.media_servers.connectors.emby import EmbyConnector

logger = logging.getLogger(__name__)


class MediaSyncEngine:
    """
    Enterprise Sync Engine supporting:
    1. Full Catalog Scan
    2. Incremental Sync (changes since last_synced_at)
    3. Reconciliation (detect removed or renamed files without deleting user data)
    4. Multi-server Logical Content Grouping & Deduplication
    """

    @classmethod
    def get_connector(cls, server: MediaServer):
        """Factory for server API connectors."""
        if server.server_type == MediaServer.ServerType.JELLYFIN:
            return JellyfinConnector(server.local_url, server.api_key)
        elif server.server_type == MediaServer.ServerType.EMBY:
            return EmbyConnector(server.local_url, server.api_key)
        else:
            return JellyfinConnector(server.local_url, server.api_key)

    @classmethod
    def run_sync(
        cls,
        server: MediaServer,
        sync_type: str = SyncJob.SyncType.INCREMENTAL,
        library_id: Optional[str] = None
    ) -> SyncJob:
        """
        Executes a synchronization job for a MediaServer.
        """
        job = SyncJob.objects.create(
            media_server=server,
            sync_type=sync_type,
            status=SyncJob.Status.RUNNING,
            started_at=timezone.now()
        )

        try:
            connector = cls.get_connector(server)
            ping_ok, ping_data = connector.test_connection()
            if not ping_ok:
                raise ConnectionError(f"Cannot reach media server at {server.local_url}: {ping_data.get('error')}")

            # Update server status & ping info
            server.status = MediaServer.Status.ONLINE
            server.last_ping_at = timezone.now()
            if ping_data:
                server.server_info = ping_data
            server.save(update_fields=['status', 'last_ping_at', 'server_info', 'updated_at'])

            # 1. Discover & Synchronize Libraries
            libraries = cls._sync_libraries(server, connector)

            # Filter single library if specified
            if library_id:
                libraries = [lib for lib in libraries if str(lib.id) == library_id or lib.external_id == library_id]

            total_scanned = 0
            total_created = 0
            total_updated = 0
            total_unavail = 0
            total_dedup = 0

            # 2. Synchronize Items per Library
            for lib in libraries:
                lib_res = cls._sync_library_items(server, lib, connector, sync_type)
                total_scanned += lib_res['scanned']
                total_created += lib_res['created']
                total_updated += lib_res['updated']
                total_unavail += lib_res['marked_unavailable']
                total_dedup += lib_res['deduplicated']

            # 3. Update SyncJob status
            job.status = SyncJob.Status.COMPLETED
            job.finished_at = timezone.now()
            job.items_scanned = total_scanned
            job.items_created = total_created
            job.items_updated = total_updated
            job.items_marked_unavailable = total_unavail
            job.items_deduplicated = total_dedup
            job.save()

            # Update server last_sync_at
            server.last_sync_at = timezone.now()
            server.save(update_fields=['last_sync_at'])

            logger.info(f"SyncJob {job.id} completed successfully for {server.name}. Scanned: {total_scanned}")
            return job

        except Exception as e:
            logger.error(f"SyncJob {job.id} failed: {str(e)}", exc_info=True)
            job.status = SyncJob.Status.FAILED
            job.finished_at = timezone.now()
            job.error_message = str(e)
            job.save()
            return job

    @classmethod
    def _sync_libraries(cls, server: MediaServer, connector) -> List[Library]:
        """Discovers and persists media libraries for the server."""
        raw_libs = connector.get_libraries()
        persisted_libs = []

        for r_lib in raw_libs:
            ext_id = r_lib.get('Id')
            name = r_lib.get('Name', 'Unnamed Library')
            c_type = (r_lib.get('CollectionType') or 'movies').lower()

            col_type = Library.CollectionType.MOVIES
            req_perm = 'content.movies.view'
            if 'tvshows' in c_type or 'series' in c_type:
                col_type = Library.CollectionType.SERIES
                req_perm = 'content.series.view'
            elif 'kids' in c_type:
                col_type = Library.CollectionType.KIDS
                req_perm = 'content.kids.view'
            elif 'documentar' in c_type:
                col_type = Library.CollectionType.DOCUMENTARY
                req_perm = 'content.movies.view'

            lib_obj, _ = Library.objects.update_or_create(
                server=server,
                external_id=ext_id,
                defaults={
                    'name': name,
                    'collection_type': col_type,
                    'required_permission': req_perm,
                    'is_enabled': True
                }
            )
            persisted_libs.append(lib_obj)

        return persisted_libs

    @classmethod
    def _sync_library_items(
        cls,
        server: MediaServer,
        library: Library,
        connector,
        sync_type: str
    ) -> Dict[str, int]:
        """Synchronizes items for a single library."""
        stats = {
            'scanned': 0,
            'created': 0,
            'updated': 0,
            'marked_unavailable': 0,
            'deduplicated': 0
        }

        raw_items = connector.get_library_items(library.external_id)
        stats['scanned'] = len(raw_items)
        seen_ext_ids = set()

        for r in raw_items:
            ext_id = r.get('Id')
            if not ext_id:
                continue
            seen_ext_ids.add(ext_id)

            title = r.get('Name') or 'Untitled'
            orig_title = r.get('OriginalTitle') or ''
            raw_type = (r.get('Type') or '').lower()
            item_type = MediaItem.ItemType.MOVIE
            if raw_type in ['series', 'tvshow']:
                item_type = MediaItem.ItemType.SERIES
            elif raw_type == 'episode':
                item_type = MediaItem.ItemType.EPISODE

            year = r.get('ProductionYear')
            overview = r.get('Overview') or ''
            genres = r.get('Genres') or []
            tags = r.get('Tags') or []
            studios = [s.get('Name') for s in r.get('Studios', []) if isinstance(s, dict)]
            
            # Duration & Ratings
            run_time_ticks = r.get('RunTimeTicks') or 0
            dur_mins = int(run_time_ticks / (10000000 * 60)) if run_time_ticks else 0
            community_rating = r.get('CommunityRating')
            official_rating = r.get('OfficialRating') or ''

            # Resolution & Media Streams
            media_sources_raw = r.get('MediaSources') or []
            resolution = "1080p FHD"
            file_size = None
            container = 'mp4'
            video_codec = None
            audio_codec = None
            bitrate = None
            file_path = None

            if media_sources_raw:
                primary_ms = media_sources_raw[0]
                container = primary_ms.get('Container') or 'mp4'
                file_size = primary_ms.get('Size')
                bitrate = primary_ms.get('Bitrate')
                file_path = primary_ms.get('Path')
                
                # Check video stream dimensions
                streams = primary_ms.get('MediaStreams') or []
                for s in streams:
                    if s.get('Type') == 'Video':
                        video_codec = s.get('Codec')
                        width = s.get('Width') or 0
                        if width >= 3800:
                            resolution = "4K UHD"
                        elif width >= 1900:
                            resolution = "1080p FHD"
                        elif width >= 1200:
                            resolution = "720p HD"
                    elif s.get('Type') == 'Audio' and not audio_codec:
                        audio_codec = s.get('Codec')

            # Poster & Backdrop
            poster_url = f"{server.local_url}/Items/{ext_id}/Images/Primary?api_key={server.api_key}"
            backdrop_url = f"{server.local_url}/Items/{ext_id}/Images/Backdrop?api_key={server.api_key}"

            # Stream URL
            stream_url = f"{server.local_url}/Videos/{ext_id}/stream.mp4?api_key={server.api_key}&Static=true"

            # Compute Hash
            c_hash = generate_content_hash(title, year, item_type)
            norm_t = normalize_search_text(title)
            norm_ar_t = normalize_arabic_text(title)

            # Persist / Update MediaItem
            media_item, created = MediaItem.objects.update_or_create(
                library=library,
                external_id=ext_id,
                defaults={
                    'title': title,
                    'original_title': orig_title,
                    'item_type': item_type,
                    'year': year,
                    'duration_minutes': dur_mins,
                    'overview': overview,
                    'genres': genres,
                    'tags': tags,
                    'studios': studios,
                    'community_rating': community_rating,
                    'official_rating': official_rating,
                    'poster_url': poster_url,
                    'backdrop_url': backdrop_url,
                    'resolution': resolution,
                    'stream_url': stream_url,
                    'content_hash': c_hash,
                    'normalized_title': norm_t,
                    'normalized_title_ar': norm_ar_t,
                    'sort_title': norm_t,
                    'last_synced_at': timezone.now(),
                    'sync_version': 1
                }
            )

            if created:
                stats['created'] += 1
            else:
                stats['updated'] += 1

            # Persist / Update MediaSource
            MediaSource.objects.update_or_create(
                media_server=server,
                external_id=ext_id,
                defaults={
                    'media_item': media_item,
                    'external_library_id': library.external_id,
                    'file_path': file_path,
                    'file_size': file_size,
                    'container': container,
                    'video_codec': video_codec,
                    'audio_codec': audio_codec,
                    'resolution': resolution,
                    'bitrate': bitrate,
                    'duration_seconds': dur_mins * 60,
                    'is_available': True,
                    'last_seen_at': timezone.now()
                }
            )

            # Deduplication & Logical Content Grouping
            dedup_res = cls._reconcile_logical_group(media_item)
            if dedup_res:
                stats['deduplicated'] += 1

        # Reconciliation: detect removed items
        if sync_type in [SyncJob.SyncType.FULL, SyncJob.SyncType.RECONCILIATION]:
            missing_sources = MediaSource.objects.filter(
                media_server=server,
                external_library_id=library.external_id
            ).exclude(external_id__in=seen_ext_ids)

            stats['marked_unavailable'] = missing_sources.count()
            missing_sources.update(is_available=False)

        # Update library count
        library.synced_items_count = library.media_items.count()
        library.save(update_fields=['synced_items_count'])

        return stats

    @classmethod
    def _reconcile_logical_group(cls, item: MediaItem) -> bool:
        """
        Groups identical media items across servers into a LogicalContentGroup.
        Chooses the highest resolution item as primary (4K > 1080p > 720p).
        """
        if not item.content_hash:
            return False

        # Find matching items with same content_hash
        matching_items = list(MediaItem.objects.filter(content_hash=item.content_hash))
        if len(matching_items) <= 1:
            item.is_logical_primary = True
            item.save(update_fields=['is_logical_primary'])
            return False

        # Resolve or create LogicalContentGroup
        group = None
        for m in matching_items:
            if m.logical_group_id:
                try:
                    group = LogicalContentGroup.objects.get(id=m.logical_group_id)
                    break
                except LogicalContentGroup.DoesNotExist:
                    pass

        if not group:
            group = LogicalContentGroup.objects.create(
                canonical_title=item.title,
                canonical_year=item.year,
                content_type=LogicalContentGroup.ContentType.MOVIE if item.item_type == MediaItem.ItemType.MOVIE else LogicalContentGroup.ContentType.SERIES,
                primary_item=item,
                member_count=len(matching_items)
            )

        # Choose best quality item as primary
        best_item = matching_items[0]
        for m in matching_items:
            if '4K' in (m.resolution or '') or '2160' in (m.resolution or ''):
                best_item = m
                break
            elif '1080' in (m.resolution or '') and '4K' not in (best_item.resolution or ''):
                best_item = m

        group.primary_item = best_item
        group.member_count = len(matching_items)
        group.save(update_fields=['primary_item', 'member_count', 'updated_at'])

        # Update all members
        for m in matching_items:
            m.logical_group_id = group.id
            m.is_logical_primary = (m.id == best_item.id)
            m.save(update_fields=['logical_group_id', 'is_logical_primary'])

        return True
