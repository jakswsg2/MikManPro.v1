"""
Smart Lounge Media Catalog App
Architectural Decision 15: Hybrid - PostgreSQL Smart Catalog + API Dynamic Data
Architectural Decision 16: Unified Search Across Media Servers
Architectural Decision 18: Media Server owns files, Smart Lounge owns catalog
Architectural Decision 50: PostgreSQL FTS + Trigram + Arabic Normalization
"""
import uuid
import hashlib
import unicodedata
import re
from django.db import models
from django.contrib.postgres.indexes import GinIndex
from django.utils import timezone
from apps.core.models import TimeStampedUUIDModel
from apps.media_servers.models import MediaServer


def normalize_search_text(text: str) -> str:
    """Normalizes text for fuzzy & trigram search."""
    if not text:
        return ""
    # NFKD decomposition
    normalized = unicodedata.normalize('NFKD', text)
    # Remove accents/diacritics
    cleaned = ''.join(c for c in normalized if not unicodedata.combining(c))
    return cleaned.strip().lower()


def normalize_arabic_text(text: str) -> str:
    """Normalizes Arabic text (alefs, teh marbuta, yaa, tatweel, tashkeel)."""
    if not text:
        return ""
    # Strip tashkeel (harakat)
    tashkeel = re.compile(r'[\u0617-\u061A\u064B-\u0652]')
    text = re.sub(tashkeel, '', text)
    # Strip tatweel (kashida)
    text = re.sub(r'\u0640', '', text)
    # Normalize Alef variants
    text = re.sub(r'[إأآا]', 'ا', text)
    # Normalize Teh Marbuta to Heh or vice versa
    text = re.sub(r'ة', 'ه', text)
    # Normalize Yaa variants
    text = re.sub(r'[يى]', 'ي', text)
    return text.strip().lower()


def generate_content_hash(title: str, year: int = None, item_type: str = "movie") -> str:
    """Generates SHA-256 content hash for deduplication matching (title + year + type)."""
    norm_t = normalize_search_text(title)
    yr_str = str(year) if year else "0"
    type_str = (item_type or "movie").lower().strip()
    raw_payload = f"{norm_t}:{yr_str}:{type_str}"
    return hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()


class Library(TimeStampedUUIDModel):
    class CollectionType(models.TextChoices):
        MOVIES = 'movies', 'أفلام (Movies)'
        SERIES = 'tvshows', 'مسلسلات (Series / TV Shows)'
        KIDS = 'kids', 'أطفال وعائلة (Kids & Family)'
        DOCUMENTARY = 'documentaries', 'وثائقيات (Documentaries)'
        MIXED = 'mixed', 'محتوى منوع (Mixed Collection)'

    server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name="catalog_libraries",
        verbose_name="خادم الوسائط"
    )
    external_id = models.CharField(max_length=150, verbose_name="معرّف المكتبة على الخادم")
    name = models.CharField(max_length=150, verbose_name="اسم المكتبة")
    collection_type = models.CharField(
        max_length=50,
        choices=CollectionType.choices,
        default=CollectionType.MOVIES,
        verbose_name="نوع المجموعة"
    )
    required_permission = models.CharField(
        max_length=100,
        default='content.movies.view',
        verbose_name="كود الصلاحية المطلوبة للوصول"
    )
    is_enabled = models.BooleanField(default=True, verbose_name="مفعّلة")
    synced_items_count = models.PositiveIntegerField(default=0, verbose_name="عدد العناصر المتزامنة")

    class Meta:
        verbose_name = "مكتبة وسائط (Catalog Library)"
        verbose_name_plural = "مكتبات الوسائط"
        unique_together = ('server', 'external_id')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} [{self.server.name}]"


class LogicalContentGroup(TimeStampedUUIDModel):
    """
    Architectural Decision 18 & Decision 16:
    Deduplication & Logical Content Clustering across multiple LAN Media Servers.
    """
    class ContentType(models.TextChoices):
        MOVIE = 'MOVIE', 'فيلم'
        SERIES = 'SERIES', 'مسلسل'

    canonical_title = models.CharField(max_length=255, verbose_name="العنوان المعتمد للمجموعة")
    canonical_year = models.IntegerField(null=True, blank=True, verbose_name="سنة الإنتاج المعتمدة")
    content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        default=ContentType.MOVIE,
        verbose_name="نوع المحتوى"
    )
    primary_item = models.ForeignKey(
        'MediaItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="catalog_primary_of_groups",
        verbose_name="العنصر الرئيسي الممثل للمجموعة"
    )
    member_count = models.IntegerField(default=1, verbose_name="عدد العناصر في المجموعة")

    class Meta:
        verbose_name = "مجموعة محتوى منطقية (Catalog Deduplication Group)"
        verbose_name_plural = "مجموعات المحتوى المنطقية"
        indexes = [
            models.Index(fields=['canonical_title', 'canonical_year'], name='idx_cat_lcg_title_yr'),
            models.Index(fields=['content_type'], name='idx_cat_lcg_type'),
        ]

    def __str__(self):
        return f"{self.canonical_title} ({self.canonical_year or 'N/A'}) [{self.member_count} items]"


class MediaItem(TimeStampedUUIDModel):
    """
    Logical Catalog Item with Full-Text Search, Arabic Normalization & Deduplication.
    """
    class ItemType(models.TextChoices):
        MOVIE = 'movie', 'فيلم'
        SERIES = 'series', 'مسلسل'
        EPISODE = 'episode', 'حلقة'

    library = models.ForeignKey(
        Library,
        on_delete=models.CASCADE,
        related_name="catalog_media_items",
        verbose_name="المكتبة"
    )
    external_id = models.CharField(max_length=150, db_index=True, verbose_name="معرّف العنصر على الخادم")
    title = models.CharField(max_length=255, db_index=True, verbose_name="العنوان بالعربية / المحلي")
    original_title = models.CharField(max_length=255, blank=True, verbose_name="العنوان الأصلي")
    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
        default=ItemType.MOVIE,
        verbose_name="نوع الوسائط"
    )
    year = models.PositiveIntegerField(null=True, blank=True, verbose_name="سنة الإنتاج")
    duration_minutes = models.PositiveIntegerField(default=0, verbose_name="المدة بالدقائق")
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=8.0, verbose_name="التقييم")
    overview = models.TextField(blank=True, verbose_name="ملخص القصة / النبذة")
    genres = models.JSONField(default=list, blank=True, verbose_name="التصنيفات")
    
    poster_url = models.CharField(max_length=500, blank=True, verbose_name="رابط البوستر")
    backdrop_url = models.CharField(max_length=500, blank=True, verbose_name="رابط الخلفية")
    
    resolution = models.CharField(max_length=30, default="1080p FHD", verbose_name="دقة العرض")
    is_premium = models.BooleanField(default=False, db_index=True, verbose_name="محتوى خاص / حصري VIP")
    is_kids = models.BooleanField(default=False, db_index=True, verbose_name="محتوى مخصص للأطفال")
    
    audio_languages = models.JSONField(default=list, blank=True, verbose_name="المسارات الصوتية (دبلجة / لغات)")
    subtitle_languages = models.JSONField(default=list, blank=True, verbose_name="ملفات الترجمة")
    
    stream_url = models.CharField(max_length=500, blank=True, verbose_name="رابط البث المباشر (HLS / Direct)")
    view_count = models.PositiveIntegerField(default=0, verbose_name="مرات المشاهدة")

    # =========================================================================
    # Phase 4 Catalog Fields: Unified Search, Deduplication & Reconciliation
    # =========================================================================
    content_hash = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        verbose_name="Content Hash (SHA-256 لـ title + year + type)"
    )
    normalized_title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="العنوان المعاير للبحث الموحد (Trigram Search)"
    )
    normalized_title_ar = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="العنوان المعاير للبحث العربي"
    )
    sort_title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="عنوان الترتيب الأبجدي"
    )
    community_rating = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="تقييم المجتمع"
    )
    official_rating = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        verbose_name="التصنيف العمري الرسمي (PG-13, R, G)"
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        verbose_name="الوسوم والتصنيفات الإضافية"
    )
    studios = models.JSONField(
        default=list,
        blank=True,
        verbose_name="استوديوهات الإنتاج"
    )
    people = models.JSONField(
        default=list,
        blank=True,
        verbose_name="طاقم العمل (الممثلون والمخرجون)"
    )
    provider_ids = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="معرّفات المزودين (IMDb, TMDB, TVDB)"
    )
    media_sources = models.JSONField(
        default=list,
        blank=True,
        verbose_name="مصادر الملفات المتعددة"
    )
    premiere_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ العرض الأول"
    )
    date_added = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الإضافة على الخادم"
    )
    last_synced_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="آخر مزامنة ناجحة"
    )
    sync_version = models.IntegerField(
        default=1,
        verbose_name="إصدار المزامنة"
    )
    is_logical_primary = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="الممثل الرئيسي للعنصر المنطقي"
    )
    logical_group_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="معرّف المجموعة المنطقية"
    )

    class Meta:
        verbose_name = "عنصر وسائط (Catalog Media Item)"
        verbose_name_plural = "عناصر وسائط الدليل"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content_hash'], name='idx_cat_media_hash'),
            models.Index(fields=['logical_group_id'], name='idx_cat_media_log_grp'),
            GinIndex(fields=['normalized_title'], name='idx_cat_norm_title_gin'),
            GinIndex(fields=['normalized_title_ar'], name='idx_cat_norm_ar_gin'),
            GinIndex(fields=['tags'], name='idx_cat_tags_gin'),
        ]

    def save(self, *args, **kwargs):
        if self.title:
            if not self.normalized_title:
                self.normalized_title = normalize_search_text(self.title)
            if not self.normalized_title_ar:
                self.normalized_title_ar = normalize_arabic_text(self.title)
            if not self.sort_title:
                self.sort_title = self.normalized_title
            if not self.content_hash:
                self.content_hash = generate_content_hash(
                    self.title,
                    self.year,
                    self.item_type
                )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.year or 'N/A'}) - {self.get_item_type_display()}"


class MediaSource(TimeStampedUUIDModel):
    """
    Physical Media File Representation on a specific Media Server.
    """
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name="catalog_sources",
        verbose_name="العنصر المنطقي"
    )
    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name="catalog_sources",
        verbose_name="خادم الوسائط"
    )
    external_id = models.CharField(
        max_length=150,
        verbose_name="معرّف الملف الفيزيائي على الخادم (Jellyfin/Emby Item ID)"
    )
    external_library_id = models.CharField(
        max_length=150,
        blank=True,
        verbose_name="معرّف المكتبة على الخادم"
    )
    file_path = models.CharField(
        max_length=1000,
        null=True,
        blank=True,
        verbose_name="مسار الملف على الخادم"
    )
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="حجم الملف بالبايت"
    )
    container = models.CharField(
        max_length=32,
        default='mp4',
        verbose_name="صيغة الحاوية (mp4/mkv/avi)"
    )
    video_codec = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        verbose_name="ترميز الفيديو (h264/hevc/av1)"
    )
    audio_codec = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        verbose_name="ترميز الصوت (aac/ac3/dts)"
    )
    resolution = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        verbose_name="دقة العرض (1080p/4K/8K/720p)"
    )
    bitrate = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="معدل البت (Bitrate kbps)"
    )
    duration_seconds = models.IntegerField(
        default=0,
        verbose_name="المدة بالثواني"
    )
    has_subtitles = models.BooleanField(
        default=False,
        verbose_name="يحتوي على ترجمة"
    )
    subtitle_languages = models.JSONField(
        default=list,
        blank=True,
        verbose_name="لغات الترجمة المتاحة"
    )
    audio_languages = models.JSONField(
        default=list,
        blank=True,
        verbose_name="لغات المسارات الصوتية"
    )
    is_available = models.BooleanField(
        default=True,
        verbose_name="هل الملف متاح حالياً؟"
    )
    last_seen_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="آخر وقت تم التحقق فيه من وجود الملف"
    )

    class Meta:
        verbose_name = "مصدر وسائط فيزيائي (Catalog Media Source)"
        verbose_name_plural = "مصادر الوسائط الفيزيائية"
        unique_together = ('media_server', 'external_id')
        indexes = [
            models.Index(fields=['media_item', 'is_available'], name='idx_cat_msrc_item_av'),
            models.Index(fields=['resolution'], name='idx_cat_msrc_res'),
        ]

    def __str__(self):
        return f"{self.media_server.name}: {self.media_item.title} [{self.resolution or 'HD'}]"
