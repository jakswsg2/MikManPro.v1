from typing import Dict, Any, Optional
from apps.permissions.engine import PermissionEngine

class SmartContentAccessEngine:
    """
    Architectural Decision 38: Smart Content Access Engine.
    Coordinates User Identity, Hierarchy Permissions, Content Metadata,
    Server Status, and Bandwidth Rules to dictate View, Stream, and Download rights.
    """

    @classmethod
    def evaluate_media_access(
        cls,
        user,
        media_item,
        tenant=None,
        site=None
    ) -> Dict[str, Any]:
        """
        Determines full accessibility matrix (Can View, Can Stream, Can Download)
        for a specific MediaItem under active lounge context.
        """
        if not user or not user.is_authenticated:
            return {
                'can_view': False,
                'can_stream': False,
                'can_download': False,
                'reasons': ['المستخدم غير مصادق عليه داخل شبكة الاستراحة'],
                'flags': {'is_premium': getattr(media_item, 'is_premium', False)},
            }

        reasons = []
        item_id = str(getattr(media_item, 'id', 'item_unknown'))
        is_premium = bool(getattr(media_item, 'is_premium', False))
        is_kids = bool(getattr(media_item, 'is_kids', False))
        resolution = str(getattr(media_item, 'resolution', '1080p'))
        item_type = str(getattr(media_item, 'item_type', 'movie'))

        # 1. Base Permissions according to type
        if item_type == 'movie':
            base_view_code = 'content.movies.view'
            base_play_code = 'content.movies.play'
            base_download_code = 'content.movies.download'
        elif item_type == 'series' or item_type == 'episode':
            base_view_code = 'content.series.view'
            base_play_code = 'content.series.play'
            base_download_code = 'content.series.download'
        else:
            base_view_code = 'content.movies.view'
            base_play_code = 'content.movies.play'
            base_download_code = 'content.download'

        # 2. Check Library Specific Restriction if present
        library = getattr(media_item, 'library', None)
        if library and getattr(library, 'required_permission', None):
            lib_perm = library.required_permission
            if not PermissionEngine.has_permission(user, lib_perm, tenant=tenant, site=site):
                return {
                    'can_view': False,
                    'can_stream': False,
                    'can_download': False,
                    'reasons': [f'المكتبة "{library.name}" تتطلب صلاحية خاصة: {lib_perm}'],
                    'flags': {'library_restricted': True},
                }

        # 3. Check View Capability
        can_view = PermissionEngine.has_permission(
            user, base_view_code, tenant=tenant, site=site,
            resource_type='MEDIA_ITEM', resource_id=item_id
        )

        # If Premium content, also verify content.premium.view
        if is_premium:
            has_prem_view = PermissionEngine.has_permission(user, 'content.premium.view', tenant=tenant, site=site)
            if not has_prem_view:
                can_view = False
                reasons.append('هذا العمل مصنف VIP حصري ويتطلب ترقية البروفايل أو اشتراك VIP')

        # 4. Check Play / Stream Capability
        can_stream = can_view and PermissionEngine.has_permission(
            user, base_play_code, tenant=tenant, site=site,
            resource_type='MEDIA_ITEM', resource_id=item_id
        )

        if is_premium and can_stream:
            has_prem_play = PermissionEngine.has_permission(user, 'content.premium.play', tenant=tenant, site=site)
            if not has_prem_play:
                can_stream = False
                reasons.append('غير مصرح لك ببث المحتوى فائق الوضوح VIP 4K')

        # Check resolution / 4K constraint
        if '4K' in resolution:
            # Requires either premium play or direct permission
            has_4k = PermissionEngine.has_permission(user, 'content.premium.play', tenant=tenant, site=site)
            if not has_4k and not user.is_superuser:
                can_stream = False
                reasons.append('يتطلب تشغيل بدقة 4K HDR بروفايل VIP مفعّل لتجنب استهلاك الباندويث')

        # 5. Check Direct Download Capability
        can_download = can_stream and (
            PermissionEngine.has_permission(user, base_download_code, tenant=tenant, site=site) or
            PermissionEngine.has_permission(user, 'content.download', tenant=tenant, site=site) or
            PermissionEngine.has_permission(user, 'features.download', tenant=tenant, site=site)
        )

        if not can_download and can_stream:
            reasons.append('التحميل المباشر للشبكة المحلية غير مفعّل في باقتك الحالية (بث مباشر فقط)')

        # Diagnostic Summary
        return {
            'item_id': item_id,
            'title': getattr(media_item, 'title', 'عنوان الوسائط'),
            'can_view': can_view,
            'can_stream': can_stream,
            'can_download': can_download,
            'is_premium': is_premium,
            'is_kids': is_kids,
            'resolution': resolution,
            'reasons': reasons,
            'quality_profile': '4K HDR High Bitrate' if ('4K' in resolution and can_stream) else '1080p FHD Standard',
            'external_player_allowed': PermissionEngine.has_permission(user, 'features.external_player', tenant=tenant, site=site),
            'casting_allowed': PermissionEngine.has_permission(user, 'features.casting', tenant=tenant, site=site),
        }

    @classmethod
    def filter_queryset(cls, user, qs, action: str = 'view'):
        """Filters media queryset based on user permissions."""
        if not user or not getattr(user, 'is_authenticated', False):
            return qs.none() if hasattr(qs, 'none') else []

        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return qs

        # If user cannot view premium content, filter out premium items
        has_prem = PermissionEngine.has_permission(user, 'content.premium.view')
        if not has_prem and hasattr(qs, 'filter'):
            qs = qs.filter(is_premium=False)

        return qs


# Backward compatibility alias
ContentAccessEngine = SmartContentAccessEngine

