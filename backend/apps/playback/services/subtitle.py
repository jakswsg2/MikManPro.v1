import os
import re
import uuid
import logging
from decimal import Decimal
from django.utils import timezone
from apps.playback.models import CustomSubtitle
from apps.playback.constants import SubtitleFormat

logger = logging.getLogger(__name__)

class SubtitleService:
    """
    خدمة الترجمات المتقدمة (Advanced Subtitle Service).
    - استرجاع الترجمات المتاحة من خادم الوسائط + الترجمات المخصصة المرفوعة.
    - رفع الترجمات المخصصة وتحويل SRT إلى WebVTT القياسي للبث في المتصفح.
    - ضبط إزاحة التزامن الزمني بالمللي ثانية (Subtitle Sync Offset).
    - الحذف وإدارة الأذونات الخاصة والعامة.
    """

    def list_subtitles(self, media_item, user=None) -> list:
        """
        استرجاع قائمة الترجمات المتاحة لعنصر الوسائط:
        1. المسارات الأصلية المدمجة في العنصر (من MediaItem.subtitle_languages).
        2. الترجمات المخصصة العامة المعتمدة في الاستراحة.
        3. الترجمات المخصصة الخاصة بالمستخدم الحالي.
        """
        results = []

        # 1. الترجمات المدمجة من كائن MediaItem
        builtin_subs = getattr(media_item, 'subtitle_languages', []) or []
        for idx, sub in enumerate(builtin_subs):
            lang = sub if isinstance(sub, str) else sub.get('language', 'ar')
            title = sub if isinstance(sub, str) else sub.get('title', f"ترجمة {lang}")
            results.append({
                'id': f"builtin-{idx}",
                'type': 'BUILTIN',
                'language': lang,
                'label': title,
                'url': getattr(media_item, 'stream_url', '') or '',
                'offset_seconds': 0.0,
                'is_custom': False,
            })

        # 2. الترجمات المخصصة المسجلة في قاعدة البيانات
        custom_qs = CustomSubtitle.objects.filter(media_item=media_item)
        if user and user.is_authenticated:
            # الترجمات الخاصة بالمستخدم أو الترجمات العامة المعتمدة
            custom_qs = custom_qs.filter(models_q(user=user) | models_q(is_public=True, approved=True))
        else:
            custom_qs = custom_qs.filter(is_public=True, approved=True)

        for sub in custom_qs:
            results.append({
                'id': str(sub.id),
                'type': 'CUSTOM',
                'language': sub.language,
                'label': sub.label,
                'file_format': sub.file_format,
                'file_path': sub.file_path,
                'offset_seconds': float(sub.offset_seconds),
                'is_custom': True,
                'is_owner': (user and user.is_authenticated and sub.user_id == user.id),
                'is_public': sub.is_public,
                'approved': sub.approved,
            })

        return results

    def upload_custom_subtitle(
        self,
        user,
        media_item,
        file_content: bytes,
        filename: str,
        language: str = 'ar',
        label: str = None,
        is_public: bool = False
    ) -> CustomSubtitle:
        """
        رفع ملف ترجمة مخصص وحفظه كـ WebVTT:
        - فحص الصيغة (.srt أو .vtt أو .ass).
        - تحويل SRT إلى VTT تلقائياً لدعم المشغل والمتصفح بدون إضافات.
        """
        ext = filename.split('.')[-1].lower() if '.' in filename else 'vtt'
        fmt = SubtitleFormat.VTT

        if ext == 'srt':
            vtt_content = self.convert_srt_to_vtt(file_content.decode('utf-8', errors='replace'))
            saved_content = vtt_content.encode('utf-8')
            fmt = SubtitleFormat.VTT
            final_ext = 'vtt'
        elif ext == 'ass':
            fmt = SubtitleFormat.ASS
            saved_content = file_content
            final_ext = 'ass'
        else:
            fmt = SubtitleFormat.VTT
            saved_content = file_content
            final_ext = 'vtt'

        # حفظ الملف في مجلد التخزين
        storage_dir = '/tmp/smart_lounge/subtitles'
        os.makedirs(storage_dir, exist_ok=True)
        sub_id = uuid.uuid4()
        storage_path = os.path.join(storage_dir, f"{sub_id}.{final_ext}")

        with open(storage_path, 'wb') as f:
            f.write(saved_content)

        display_label = label or f"ترجمة {language.upper()} مخصصة"

        custom_sub = CustomSubtitle.objects.create(
            id=sub_id,
            user=user,
            media_item=media_item,
            language=language,
            label=display_label,
            file_path=storage_path,
            file_format=fmt,
            is_public=is_public,
            approved=False  # تتطلب تدقيقاً للإتاحة العامة
        )

        return custom_sub

    def convert_srt_to_vtt(self, srt_text: str) -> str:
        """
        تحويل صريح وخفيف من صيغة SubRip (SRT) إلى WebVTT (RFC 8216).
        - استبدال فواصل الفواصل العشرية ',' بنقاط '.' في التواقيت.
        - إضافة ترويسة WEBVTT في البداية.
        """
        lines = srt_text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        vtt_lines = ['WEBVTT', '']

        timestamp_pattern = re.compile(
            r'(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})'
        )

        for line in lines:
            match = timestamp_pattern.search(line)
            if match:
                # تحويل التوقيت من 00:01:23,456 إلى 00:01:23.456
                converted = f"{match.group(1)}.{match.group(2)} --> {match.group(3)}.{match.group(4)}"
                vtt_lines.append(converted)
            else:
                vtt_lines.append(line)

        return '\n'.join(vtt_lines)

    def sync_subtitle_offset(self, subtitle_id: str, offset_seconds: float, user=None) -> CustomSubtitle:
        """
        تعديل إزاحة التزامن الزمني للترجمة (تقديم أو تأخير بالثواني).
        """
        qs = CustomSubtitle.objects.filter(id=subtitle_id)
        if user and not user.is_staff:
            qs = qs.filter(user=user)

        sub = qs.first()
        if not sub:
            raise ValueError("ملف الترجمة غير موجود أو لا تملك صلاحية تعديله")

        sub.offset_seconds = Decimal(str(round(offset_seconds, 3)))
        sub.save()
        return sub

    def delete_subtitle(self, subtitle_id: str, user=None) -> bool:
        """
        حذف ملف ترجمة مخصص.
        """
        qs = CustomSubtitle.objects.filter(id=subtitle_id)
        if user and not user.is_staff:
            qs = qs.filter(user=user)

        sub = qs.first()
        if not sub:
            return False

        if os.path.exists(sub.file_path):
            try:
                os.remove(sub.file_path)
            except OSError:
                pass

        sub.delete()
        return True


def models_q(**kwargs):
    from django.db.models import Q
    return Q(**kwargs)
