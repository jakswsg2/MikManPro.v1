import logging
from apps.content.models import MediaItem

logger = logging.getLogger(__name__)

class NextEpisodeService:
    """
    خدمة استدعاء الحلقة التالية تلقائياً (Auto Next Episode Service).
    - استرجاع الحلقة التالية في نفس الموسم، أو أول حلقة من الموسم التالي.
    """

    def get_next_episode(self, current_item: MediaItem) -> dict | None:
        """
        استرجاع بيانات الحلقة التالية استناداً إلى الموسم ورقم الحلقة.
        """
        item_type = getattr(current_item, 'item_type', None)
        if item_type != 'episode':
            return None

        # استخراج بيانات الموسم والحلقة
        parent_id = getattr(current_item, 'logical_group_id', None)
        provider_ids = getattr(current_item, 'provider_ids', {}) or {}
        season_num = provider_ids.get('season_number', 1)
        episode_num = provider_ids.get('episode_number', 1)

        # البحث عن الحلقة التالية في نفس المسلسل
        next_ep = None
        if parent_id:
            # نفس الموسم، الحلقة التالية
            candidates = MediaItem.objects.filter(
                logical_group_id=parent_id,
                item_type='episode'
            )
            for item in candidates:
                p_ids = getattr(item, 'provider_ids', {}) or {}
                s = p_ids.get('season_number', 1)
                e = p_ids.get('episode_number', 1)
                if s == season_num and e == episode_num + 1:
                    next_ep = item
                    break

            # إذا لم توجد في نفس الموسم، نبحث عن أول حلقة في الموسم التالي
            if not next_ep:
                for item in candidates:
                    p_ids = getattr(item, 'provider_ids', {}) or {}
                    s = p_ids.get('season_number', 1)
                    e = p_ids.get('episode_number', 1)
                    if s == season_num + 1 and e == 1:
                        next_ep = item
                        break

        if next_ep:
            p_ids = getattr(next_ep, 'provider_ids', {}) or {}
            return {
                'id': str(next_ep.id),
                'title': next_ep.title,
                'season_number': p_ids.get('season_number', 1),
                'episode_number': p_ids.get('episode_number', 1),
                'duration_minutes': next_ep.duration_minutes,
                'poster_url': getattr(next_ep, 'poster_url', '') or '',
            }

        return None
