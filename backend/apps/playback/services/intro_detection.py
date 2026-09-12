import logging

logger = logging.getLogger(__name__)

class IntroDetectionService:
    """
    خدمة تحديد وتخطي شارة البداية والنهاية (Skip Intro & Outro Service).
    Phase 13: Manual / Metadata-driven Marking.
    """

    def get_intro_range(self, media_item) -> dict | None:
        """
        استرجاع نطاق شارة البداية (start_seconds, end_seconds).
        يتم استرجاعها من الحقول الوصفية أو التحديد اليدوي في قاعدة البيانات.
        """
        # فحص وجود بيانات محددة في metadata
        meta = getattr(media_item, 'provider_ids', {}) or {}
        intro_data = meta.get('intro_marker')

        if intro_data and isinstance(intro_data, dict):
            start = intro_data.get('start_seconds', 0)
            end = intro_data.get('end_seconds', 0)
            if end > start:
                return {
                    'start_seconds': start,
                    'end_seconds': end,
                    'duration_seconds': end - start,
                }

        item_type = getattr(media_item, 'item_type', 'movie')
        # فحص وجود وسوم المقدمة في tags
        tags = getattr(media_item, 'tags', []) or []
        for tag in tags:
            if str(tag).startswith('intro:'):
                parts = str(tag).split(':')
                if len(parts) == 3:
                    try:
                        return {
                            'start_seconds': int(parts[1]),
                            'end_seconds': int(parts[2]),
                            'duration_seconds': int(parts[2]) - int(parts[1]),
                        }
                    except ValueError:
                        pass

        return None

    def mark_intro(self, media_item, start_seconds: int, end_seconds: int) -> dict:
        """تحديد توقيت شارة البداية يدوياً بواسطة الإدارة."""
        if end_seconds <= start_seconds:
            raise ValueError("توقيت نهاية المقدمة يجب أن يكون أكبر من توقيت البداية")

        if not hasattr(media_item, 'provider_ids') or media_item.provider_ids is None:
            media_item.provider_ids = {}

        media_item.provider_ids['intro_marker'] = {
            'start_seconds': start_seconds,
            'end_seconds': end_seconds,
        }
        media_item.save(update_fields=['provider_ids'])

        return {
            'start_seconds': start_seconds,
            'end_seconds': end_seconds,
        }
