import uuid
import hashlib
import unicodedata
import re
from django.db import models
from django.contrib.postgres.indexes import GinIndex
from django.utils import timezone
from django.conf import settings
from apps.core.models import TimeStampedUUIDModel
from apps.media_servers.models import MediaServer
from apps.tenancy.models import Tenant


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
        related_name="libraries",
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
        verbose_name = "مكتبة وسائط"
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
        related_name="primary_of_groups",
        verbose_name="العنصر الرئيسي الممثل للمجموعة"
    )
    member_count = models.IntegerField(default=1, verbose_name="عدد العناصر في المجموعة")

    class Meta:
        verbose_name = "مجموعة محتوى منطقية (Deduplication Group)"
        verbose_name_plural = "مجموعات المحتوى المنطقية"
        indexes = [
            models.Index(fields=['canonical_title', 'canonical_year'], name='idx_lcg_title_year'),
            models.Index(fields=['content_type'], name='idx_lcg_type'),
        ]

    def __str__(self):
        return f"{self.canonical_title} ({self.canonical_year or 'N/A'}) [{self.member_count} items]"


class MediaItem(TimeStampedUUIDModel):
    class ItemType(models.TextChoices):
        MOVIE = 'movie', 'فيلم'
        SERIES = 'series', 'مسلسل'
        EPISODE = 'episode', 'حلقة'

    class ContentLifecycleStatus(models.TextChoices):
        DISCOVERED = 'discovered', 'مكتشف (Discovered)'
        INDEXED = 'indexed', 'مفهرس (Indexed)'
        PENDING = 'pending', 'قيد المراجعة (Pending Review)'
        APPROVED = 'approved', 'معتمد (Approved)'
        PUBLISHED = 'published', 'منشور (Published)'
        HIDDEN = 'hidden', 'مخفي (Hidden)'
        ARCHIVED = 'archived', 'مؤرشف (Archived)'
        BLOCKED = 'blocked', 'محظور (Blocked)'

    class EnrichmentStatus(models.TextChoices):
        PENDING = 'pending', 'قيد الانتظار (Pending)'
        IN_PROGRESS = 'in_progress', 'جار الإثراء (In Progress)'
        ENRICHED = 'enriched', 'تم الإثراء (Enriched)'
        FAILED = 'failed', 'فشل الإثراء (Failed)'
        SKIPPED = 'skipped', 'تم التخطي (Skipped)'
        PARTIAL = 'partial', 'إثراء جزئي (Partial)'

    library = models.ForeignKey(
        Library,
        on_delete=models.CASCADE,
        related_name="media_items",
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
    # Phase 4 New Fields: Unified Search, Deduplication & Reconciliation
    # =========================================================================
    content_hash = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        verbose_name="Content Hash (SHA-256)"
    )
    normalized_title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="العنوان المعاير للبحث الموحد"
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
        verbose_name="مصادر الملفات المتعددة (JSON snapshot)"
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

    # =========================================================================
    # Phase 15 New Fields: Multi-Language, Lifecycle, Quality & Metadata Enrichment
    # =========================================================================
    status = models.CharField(
        max_length=20,
        choices=ContentLifecycleStatus.choices,
        default=ContentLifecycleStatus.INDEXED,
        db_index=True,
        verbose_name="حالة دورة حياة المحتوى"
    )
    enrichment_status = models.CharField(
        max_length=20,
        choices=EnrichmentStatus.choices,
        default=EnrichmentStatus.PENDING,
        db_index=True,
        verbose_name="حالة إثراء البيانات"
    )
    enrichment_attempts = models.PositiveIntegerField(
        default=0,
        verbose_name="عدد محاولات الإثراء"
    )
    last_enriched_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ آخر إثراء"
    )
    enrichment_error = models.TextField(
        blank=True,
        verbose_name="تفاصيل خطأ الإثراء"
    )
    data_quality_score = models.FloatField(
        default=0.0,
        db_index=True,
        verbose_name="مؤشر جودة البيانات (0-100)"
    )
    title_localized = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="العناوين بلغات متعددة {'ar': '...', 'en': '...'}"
    )
    overview_localized = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="الملخصات بلغات متعددة {'ar': '...', 'en': '...'}"
    )
    tagline_localized = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="الجمل الترويجية بلغات متعددة"
    )
    external_ids = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="معرّفات المزودين الخارجيين {'tmdb': '...', 'tvdb': '...', 'imdb': '...'}"
    )
    original_metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="البيانات الأصلية الخام من خادم الوسائط"
    )
    content_classification = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="التصنيف التلقائي للمحتوى"
    )

    class Meta:
        verbose_name = "عنصر وسائط"
        verbose_name_plural = "عناصر الوسائط"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content_hash'], name='idx_media_content_hash'),
            models.Index(fields=['logical_group_id'], name='idx_media_logical_grp'),
            models.Index(fields=['status'], name='idx_media_status'),
            models.Index(fields=['enrichment_status'], name='idx_media_enrich_status'),
            models.Index(fields=['data_quality_score'], name='idx_media_quality_score'),
            models.Index(fields=['normalized_title'], name='idx_media_norm_title'),
            models.Index(fields=['normalized_title_ar'], name='idx_media_norm_ar'),
            GinIndex(fields=['tags'], name='idx_media_tags_gin'),
        ]

    def get_localized_title(self, lang: str = "ar") -> str:
        """
        Multi-language fallback: Requested Language (AR) -> English -> original_title -> title
        """
        if self.title_localized and isinstance(self.title_localized, dict):
            val = self.title_localized.get(lang)
            if val and str(val).strip():
                return str(val).strip()
            if lang != "en":
                en_val = self.title_localized.get("en")
                if en_val and str(en_val).strip():
                    return str(en_val).strip()
        return self.original_title or self.title or ""

    def get_localized_overview(self, lang: str = "ar") -> str:
        """
        Multi-language fallback: Requested Language (AR) -> English -> default overview
        """
        if self.overview_localized and isinstance(self.overview_localized, dict):
            val = self.overview_localized.get(lang)
            if val and str(val).strip():
                return str(val).strip()
            if lang != "en":
                en_val = self.overview_localized.get("en")
                if en_val and str(en_val).strip():
                    return str(en_val).strip()
        return self.overview or ""

    def calculate_data_quality_score(self) -> float:
        """
        Calculates Data Quality Score (0.0 to 100.0) based on metadata completeness:
        - Titles (Arabic + English): 20 pts (10 each)
        - Overview (Arabic + English): 15 pts (8 AR, 7 EN/default)
        - Artwork (Poster: 15 pts, Backdrop: 10 pts): 25 pts
        - Core Specs (Year: 5 pts, Duration: 5 pts): 10 pts
        - Taxonomy (Genres: 10 pts): 10 pts
        - Cast/Credits (People: 10 pts): 10 pts
        - Cross-referencing External IDs (TMDB/IMDb/TVDB: 10 pts): 10 pts
        Total max = 100.0
        """
        score = 0.0

        # Titles
        has_ar_title = bool((self.title_localized and self.title_localized.get('ar')) or self.normalized_title_ar)
        has_en_title = bool((self.title_localized and self.title_localized.get('en')) or self.original_title or self.title)
        if has_ar_title and has_en_title:
            score += 20.0
        elif has_ar_title or has_en_title:
            score += 12.0

        # Overview
        has_ar_overview = bool(self.overview_localized and self.overview_localized.get('ar'))
        has_en_overview = bool(self.overview_localized and self.overview_localized.get('en')) or bool(self.overview)
        if has_ar_overview and has_en_overview:
            score += 15.0
        elif has_ar_overview or has_en_overview:
            score += 8.0

        # Artwork
        if self.poster_url:
            score += 15.0
        if self.backdrop_url:
            score += 10.0

        # Specs
        if self.year and int(self.year) > 1900:
            score += 5.0
        if self.duration_minutes and int(self.duration_minutes) > 0:
            score += 5.0

        # Genres
        if self.genres and len(self.genres) > 0:
            score += 10.0

        # People / Cast
        if self.people and len(self.people) > 0:
            score += 10.0

        # External IDs
        ext_ids = self.external_ids or self.provider_ids or {}
        if ext_ids and any(ext_ids.get(k) for k in ['tmdb', 'imdb', 'tvdb', 'musicbrainz']):
            score += 10.0

        return round(min(100.0, score), 1)

    def save(self, *args, **kwargs):
        # Auto-compute normalizations and hash if not explicitly provided
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

        # Sync external_ids and provider_ids for backward compatibility
        if self.external_ids and not self.provider_ids:
            self.provider_ids = dict(self.external_ids)
        elif self.provider_ids and not self.external_ids:
            self.external_ids = dict(self.provider_ids)

        # Sync localized title defaults if not explicitly populated
        if not self.title_localized:
            self.title_localized = {}
        if self.title and 'ar' not in self.title_localized and self.normalized_title_ar:
            self.title_localized['ar'] = self.title
        if self.original_title and 'en' not in self.title_localized:
            self.title_localized['en'] = self.original_title

        # Auto-calculate data quality score
        if self.data_quality_score == 0.0:
            self.data_quality_score = self.calculate_data_quality_score()

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.year or 'N/A'}) - {self.get_item_type_display()}"


class MediaSource(TimeStampedUUIDModel):
    """
    Physical Media File Representation on a specific Media Server.
    Relationship: MediaItem = Logical entity; MediaSource = Physical files.
    """
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name="sources",
        verbose_name="العنصر المنطقي"
    )
    media_server = models.ForeignKey(
        MediaServer,
        on_delete=models.CASCADE,
        related_name="sources",
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
        verbose_name = "مصدر وسائط فيزيائي (Media Source)"
        verbose_name_plural = "مصادر الوسائط الفيزيائية"
        unique_together = ('media_server', 'external_id')
        indexes = [
            models.Index(fields=['media_item', 'is_available'], name='idx_msrc_item_avail'),
            models.Index(fields=['resolution'], name='idx_msrc_resolution'),
        ]

    def __str__(self):
        return f"{self.media_server.name}: {self.media_item.title} [{self.resolution or 'HD'}]"


class Season(TimeStampedUUIDModel):
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name="seasons",
        verbose_name="المسلسل"
    )
    season_number = models.PositiveIntegerField(default=1, verbose_name="رقم الموسم")
    title = models.CharField(max_length=150, verbose_name="عنوان الموسم")

    class Meta:
        verbose_name = "موسم مسلسل"
        verbose_name_plural = "مواسم المسلسلات"
        unique_together = ('media_item', 'season_number')
        ordering = ['season_number']

    def __str__(self):
        return f"{self.media_item.title} - الموسم {self.season_number}"


class Episode(TimeStampedUUIDModel):
    season = models.ForeignKey(
        Season,
        on_delete=models.CASCADE,
        related_name="episodes",
        verbose_name="الموسم"
    )
    episode_number = models.PositiveIntegerField(verbose_name="رقم الحلقة")
    title = models.CharField(max_length=200, verbose_name="عنوان الحلقة")
    duration_minutes = models.PositiveIntegerField(default=45, verbose_name="المدة بالدقائق")
    stream_url = models.CharField(max_length=500, blank=True, verbose_name="رابط البث")

    class Meta:
        verbose_name = "حلقة"
        verbose_name_plural = "حلقات المسلسلات"
        unique_together = ('season', 'episode_number')
        ordering = ['episode_number']

    def __str__(self):
        return f"{self.season.media_item.title} S{self.season.season_number}E{self.episode_number}: {self.title}"


# =============================================================================
# Phase 15 Models: Metadata Enrichment, Lifecycle, Versions & Collections
# =============================================================================

class ExternalMetadata(TimeStampedUUIDModel):
    """
    Phase 15: Cached & Normalized External Metadata Layer
    Stores raw & normalized responses from external providers (TMDB, TVDB, IMDb, MusicBrainz)
    with a 30-day cache expiration, multi-language support (AR/EN), and rate-limiting resilience.
    """
    class Provider(models.TextChoices):
        TMDB = 'tmdb', 'The Movie Database (TMDB)'
        TVDB = 'tvdb', 'TheTVDB'
        IMDB = 'imdb', 'IMDb'
        MUSICBRAINZ = 'musicbrainz', 'MusicBrainz'
        OMDB = 'omdb', 'Open Movie Database (OMDb)'
        CUSTOM = 'custom', 'مخصص (Custom Provider)'

    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name="external_metadata_records",
        null=True,
        blank=True,
        verbose_name="عنصر الوسائط المرتبط"
    )
    provider = models.CharField(
        max_length=30,
        choices=Provider.choices,
        db_index=True,
        verbose_name="مزود البيانات"
    )
    external_id = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="معرّف العنصر لدى المزود"
    )
    item_type = models.CharField(
        max_length=20,
        default='movie',
        verbose_name="نوع المحتوى لدى المزود"
    )
    language = models.CharField(
        max_length=10,
        default='en',
        db_index=True,
        verbose_name="اللغة (ar / en)"
    )
    raw_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="البيانات الخام من المزود"
    )
    normalized_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="البيانات المعايرة والمنسقة"
    )
    fetched_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="تاريخ ووقت الجلب"
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="تاريخ انتهاء صلاحية الكاش (30 يوم)"
    )
    is_valid = models.BooleanField(
        default=True,
        verbose_name="صالح للاستخدام"
    )
    data_hash = models.CharField(
        max_length=64,
        blank=True,
        verbose_name="بصمة البيانات للتحقق من التغييرات"
    )

    class Meta:
        verbose_name = "بيانات وصفية خارجية (External Metadata)"
        verbose_name_plural = "بيانات وصفية خارجية"
        unique_together = ('provider', 'external_id', 'language')
        indexes = [
            models.Index(fields=['provider', 'external_id'], name='idx_extmeta_prov_extid'),
            models.Index(fields=['media_item', 'provider'], name='idx_extmeta_item_prov'),
            models.Index(fields=['expires_at'], name='idx_extmeta_expires'),
        ]

    def is_stale(self) -> bool:
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"{self.get_provider_display()} ({self.external_id}) [{self.language}]"


class ContentLifecycleLog(TimeStampedUUIDModel):
    """
    Phase 15: Content Lifecycle Audit Trail
    Logs all status transitions (DISCOVERED -> INDEXED -> PENDING -> APPROVED -> PUBLISHED -> HIDDEN -> ARCHIVED -> BLOCKED)
    with reason, acting user, and metadata snapshot.
    """
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name="lifecycle_logs",
        verbose_name="عنصر الوسائط"
    )
    from_status = models.CharField(
        max_length=30,
        verbose_name="الحالة السابقة"
    )
    to_status = models.CharField(
        max_length=30,
        verbose_name="الحالة الجديدة"
    )
    reason = models.TextField(
        blank=True,
        verbose_name="سبب تغيير الحالة"
    )
    changed_by = models.CharField(
        max_length=150,
        default="system",
        verbose_name="تم التغيير بواسطة"
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="تفاصيل إضافية / لقطة للبيانات"
    )

    class Meta:
        verbose_name = "سجل دورة حياة المحتوى (Content Lifecycle Log)"
        verbose_name_plural = "سجلات دورة حياة المحتوى"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.media_item.title}: {self.from_status} -> {self.to_status} ({self.changed_by})"


class MediaVersion(TimeStampedUUIDModel):
    """
    Phase 15: Media Versions & Quality Selection
    Architectural Mandate: "One item, multiple files."
    Decouples file-level quality, codec, and resolution options from the conceptual MediaItem.
    """
    media_item = models.ForeignKey(
        MediaItem,
        on_delete=models.CASCADE,
        related_name="versions",
        verbose_name="العنصر المنطقي"
    )
    media_source = models.ForeignKey(
        MediaSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_versions",
        verbose_name="مصدر الملف الفيزيائي"
    )
    version_name = models.CharField(
        max_length=150,
        verbose_name="اسم النسخة (مثل: 4K HDR Remux / 1080p WEB-DL)"
    )
    quality_label = models.CharField(
        max_length=50,
        default="1080p FHD",
        verbose_name="وسم الجودة (4K UHD, 1080p, 720p, SD)"
    )
    resolution = models.CharField(
        max_length=32,
        blank=True,
        verbose_name="الدقة (3840x2160, 1920x1080...)"
    )
    video_codec = models.CharField(
        max_length=32,
        blank=True,
        verbose_name="ترميز الفيديو (HEVC, H.264, AV1)"
    )
    audio_codec = models.CharField(
        max_length=32,
        blank=True,
        verbose_name="ترميز الصوت (DTS-HD, TrueHD, AC3, AAC)"
    )
    container = models.CharField(
        max_length=32,
        default="mp4",
        verbose_name="صيغة الملف (mkv, mp4)"
    )
    bitrate = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="معدل البت (kbps)"
    )
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="حجم الملف بالبايت"
    )
    file_path = models.CharField(
        max_length=1000,
        blank=True,
        verbose_name="مسار الملف"
    )
    stream_url = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="رابط البث للنسخة"
    )
    audio_tracks = models.JSONField(
        default=list,
        blank=True,
        verbose_name="مسارات الصوت المتاحة (لغات ودبلجة)"
    )
    subtitle_tracks = models.JSONField(
        default=list,
        blank=True,
        verbose_name="مسارات الترجمة المتاحة"
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name="النسخة الافتراضية"
    )
    is_hdr = models.BooleanField(
        default=False,
        verbose_name="دعم تقنية HDR / Dolby Vision"
    )
    is_3d = models.BooleanField(
        default=False,
        verbose_name="تقنية ثلاثية الأبعاد 3D"
    )

    class Meta:
        verbose_name = "نسخة وسائط (Media Version)"
        verbose_name_plural = "نسخ الوسائط المتعددة"
        ordering = ['-bitrate', '-file_size']
        indexes = [
            models.Index(fields=['media_item', 'quality_label'], name='idx_mver_item_quality'),
            models.Index(fields=['media_item', 'is_default'], name='idx_mver_item_def'),
        ]

    def __str__(self):
        return f"{self.media_item.title} - {self.version_name} ({self.quality_label})"


class ContentCollection(TimeStampedUUIDModel):
    """
    Phase 15: Content Collections (Manual, Dynamic, Smart)
    Architectural Mandate: "Collections = Manual + Dynamic + Smart"
    - Manual: Curated set of items.
    - Dynamic: Rule-evaluated query conditions.
    - Smart: Auto-updating criteria (by rating, genre, year, trending).
    """
    class CollectionType(models.TextChoices):
        MANUAL = 'manual', 'يدوية (Manual Collection)'
        DYNAMIC = 'dynamic', 'ديناميكية (Dynamic Rule-Based)'
        SMART = 'smart', 'ذكية (Smart Auto-Updating)'

    class RuleLogic(models.TextChoices):
        AND = 'AND', 'تطابق جميع الشروط (AND)'
        OR = 'OR', 'تطابق أي شرط (OR)'

    name = models.CharField(
        max_length=200,
        verbose_name="اسم المجموعة"
    )
    slug = models.SlugField(
        max_length=200,
        unique=True,
        verbose_name="المعرف اللطيف (Slug)"
    )
    description = models.TextField(
        blank=True,
        verbose_name="وصف المجموعة"
    )
    collection_type = models.CharField(
        max_length=20,
        choices=CollectionType.choices,
        default=CollectionType.MANUAL,
        verbose_name="نوع المجموعة"
    )
    rules = models.JSONField(
        default=list,
        blank=True,
        verbose_name="شروط وقواعد المجموعة الديناميكية/الذكية"
    )
    rule_logic = models.CharField(
        max_length=10,
        choices=RuleLogic.choices,
        default=RuleLogic.AND,
        verbose_name="منطق الشروط (AND/OR)"
    )
    items = models.ManyToManyField(
        MediaItem,
        blank=True,
        related_name="collections",
        verbose_name="عناصر المجموعة"
    )
    is_published = models.BooleanField(
        default=True,
        verbose_name="منشورة ومتاحة للعرض"
    )
    is_featured = models.BooleanField(
        default=False,
        verbose_name="مميزة في الصفحة الرئيسية"
    )
    poster_url = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="بوستر المجموعة"
    )
    backdrop_url = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="خلفية المجموعة"
    )
    sort_order = models.IntegerField(
        default=0,
        verbose_name="ترتيب العرض"
    )

    class Meta:
        verbose_name = "مجموعة محتوى (Content Collection)"
        verbose_name_plural = "مجموعات المحتوى"
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.name} [{self.get_collection_type_display()}]"


# =============================================================================
# Phase 16 Models: Unified Search Advanced, Suggestions & Synonyms
# =============================================================================

class SearchQuery(TimeStampedUUIDModel):
    """
    Phase 16: Search Query Analytics, History & Intent Tracking
    Records each search interaction, language detection, intent classification,
    execution latency, CTR tracking, and user privacy compliance.
    """
    class QueryIntent(models.TextChoices):
        NAVIGATIONAL = 'NAVIGATIONAL', 'تنقلي (Navigational)'
        INFORMATIONAL = 'INFORMATIONAL', 'استعلامي (Informational)'
        DISCOVERY = 'DISCOVERY', 'استكشافي (Discovery)'
        SPECIFIC = 'SPECIFIC', 'محدد بدقة (Specific)'

    class SearchType(models.TextChoices):
        FULL_TEXT = 'FULL_TEXT', 'بحث نصي كامل (Full-Text)'
        FUZZY = 'FUZZY', 'بحث ضبابي (Fuzzy/Trigram)'
        AUTOCOMPLETE = 'AUTOCOMPLETE', 'إكمال تلقائي (Autocomplete)'
        NL = 'NL', 'لغة طبيعية (Natural Language)'
        VOICE = 'VOICE', 'بحث صوتي (Voice Search)'

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="search_queries",
        verbose_name="المستأجر"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="search_queries",
        verbose_name="المستخدم (فارغ للزوار)"
    )
    session_id = models.CharField(
        max_length=128,
        null=True,
        blank=True,
        verbose_name="معرّف الجلسة"
    )
    query_text = models.CharField(
        max_length=500,
        verbose_name="نص الاستعلام الأصلي"
    )
    query_normalized = models.CharField(
        max_length=500,
        db_index=True,
        verbose_name="الاستعلام المعاير"
    )
    query_language = models.CharField(
        max_length=20,
        default='mixed',
        verbose_name="لغة الاستعلام (ar, en, mixed)"
    )
    query_intent = models.CharField(
        max_length=50,
        choices=QueryIntent.choices,
        default=QueryIntent.NAVIGATIONAL,
        verbose_name="نية الاستعلام"
    )
    filters_applied = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="الفلاتر المطبقة"
    )
    page = models.IntegerField(
        default=1,
        verbose_name="رقم الصفحة"
    )
    results_count = models.IntegerField(
        default=0,
        verbose_name="عدد النتائج"
    )
    results_clicked = models.JSONField(
        default=list,
        blank=True,
        verbose_name="قائمة معرّفات النتائج المنقورة"
    )
    clicked_position = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="موقع النقر للـ CTR"
    )
    execution_time_ms = models.IntegerField(
        default=0,
        verbose_name="وقت التنفيذ بالمللي ثانية"
    )
    search_type = models.CharField(
        max_length=50,
        choices=SearchType.choices,
        default=SearchType.FULL_TEXT,
        verbose_name="نوع البحث"
    )
    device_name = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        verbose_name="اسم/نوع الجهاز"
    )
    client_info = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات العميل والمتصفح"
    )

    class Meta:
        verbose_name = "سجل استعلام بحث (Search Query)"
        verbose_name_plural = "سجلات استعلامات البحث"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', '-created_at'], name='idx_srch_ten_created'),
            models.Index(fields=['user', '-created_at'], name='idx_srch_usr_created'),
            models.Index(fields=['query_normalized'], name='idx_srch_query_norm'),
            models.Index(fields=['tenant', 'query_normalized'], name='idx_srch_ten_qnorm'),
        ]

    def __str__(self):
        return f"[{self.tenant_id}] '{self.query_text}' ({self.results_count} results, {self.execution_time_ms}ms)"


class SearchSuggestion(TimeStampedUUIDModel):
    """
    Phase 16: Curated & Trending Search Suggestions
    Admin-curated and dynamic suggestions for search autocompletion,
    editorial recommendations, and seasonal promotions.
    """
    class SuggestionType(models.TextChoices):
        TRENDING = 'TRENDING', 'شائع ورائج (Trending)'
        FEATURED = 'FEATURED', 'مميز (Featured)'
        EDITORIAL = 'EDITORIAL', 'اختيار المحررين (Editorial)'
        PROMOTIONAL = 'PROMOTIONAL', 'ترويجي (Promotional)'
        AUTO = 'AUTO', 'تلقائي (Auto Generated)'

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="search_suggestions",
        verbose_name="المستأجر"
    )
    text = models.CharField(
        max_length=255,
        verbose_name="نص الاقتراح"
    )
    text_localized = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="النص المترجم {'ar': '...', 'en': '...'}"
    )
    suggestion_type = models.CharField(
        max_length=50,
        choices=SuggestionType.choices,
        default=SuggestionType.TRENDING,
        verbose_name="نوع الاقتراح"
    )
    priority = models.IntegerField(
        default=100,
        verbose_name="الأولوية (الأقل = يظهر أولاً)"
    )
    icon = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="اسم الأيقونة (Lucide icon)"
    )
    action_url = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="رابط الإجراء عند النقر"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="بيانات وصفية إضافية"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشط"
    )
    valid_from = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="صالح من تاريخ"
    )
    valid_until = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="صالح حتى تاريخ"
    )

    class Meta:
        verbose_name = "اقتراح بحث (Search Suggestion)"
        verbose_name_plural = "اقتراحات البحث"
        ordering = ['priority', '-created_at']
        indexes = [
            models.Index(fields=['tenant', 'is_active', 'priority'], name='idx_sugg_ten_act_prio'),
        ]

    def is_currently_valid(self) -> bool:
        now = timezone.now()
        if not self.is_active:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return True

    def __str__(self):
        return f"{self.text} [{self.get_suggestion_type_display()}] (Priority: {self.priority})"


class SearchSynonym(TimeStampedUUIDModel):
    """
    Phase 16: Search Synonyms & Language Cross-Mapping
    Maps query keywords to synonyms across English and Arabic (e.g., 'batman' <-> 'الرجل الوطواط').
    Can be Tenant-specific or Global (tenant is NULL).
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="search_synonyms",
        verbose_name="المستأجر (فارغ = عام لكافة المستأجرين)"
    )
    term = models.CharField(
        max_length=150,
        db_index=True,
        verbose_name="المصطلح الأساسي"
    )
    synonyms = models.JSONField(
        default=list,
        verbose_name="قائمة المرادفات ['الرجل الوطواط', 'batman', 'bats']"
    )
    language = models.CharField(
        max_length=10,
        default='ar',
        verbose_name="اللغة (ar, en, mixed)"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشط"
    )

    class Meta:
        verbose_name = "مرادف بحث (Search Synonym)"
        verbose_name_plural = "مرادفات البحث"
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'term', 'language'],
                name='unique_tenant_synonym_term_lang'
            )
        ]
        indexes = [
            models.Index(fields=['term', 'language'], name='idx_syn_term_lang'),
            models.Index(fields=['is_active', 'language'], name='idx_syn_active_lang'),
        ]

    def __str__(self):
        scope = f"Tenant: {self.tenant_id}" if self.tenant else "Global"
        return f"[{scope}] {self.term} ({self.language}) -> {len(self.synonyms)} synonyms"


class SearchRankingConfig(TimeStampedUUIDModel):
    """
    Phase 16: Search Ranking Configuration & Multi-Factor Weights
    Configures the dynamic weights for text matching, popularity, recency,
    user affinity, data quality score, trending, and exact match boosts.
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="search_ranking_configs",
        verbose_name="المستأجر (فارغ = الإعدادات الافتراضية العامة)"
    )
    config_key = models.CharField(
        max_length=100,
        default="default",
        verbose_name="مفتاح التكوين"
    )
    weights = models.JSONField(
        default=dict,
        verbose_name="أوزان عوامل الترتيب (Ranking Weights)"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="نشط"
    )

    class Meta:
        verbose_name = "تكوين أوزان الترتيب (Search Ranking Config)"
        verbose_name_plural = "تكوينات أوزان الترتيب"
        indexes = [
            models.Index(fields=['tenant', 'is_active'], name='idx_rnk_ten_active'),
        ]

    @classmethod
    def get_default_weights(cls) -> dict:
        return {
            'text_match': 0.35,
            'exact_match': 0.15,
            'popularity': 0.10,
            'recency': 0.10,
            'user_affinity': 0.10,
            'quality_score': 0.10,
            'trending': 0.05,
            'external_rating': 0.05,
            'exact_match_boost': 1.5,
            'title_boost': 2.0,
            'genre_boost': 1.15,
        }

    def __str__(self):
        scope = f"Tenant: {self.tenant_id}" if self.tenant else "Global"
        return f"[{scope}] RankingConfig ({self.config_key})"


class SavedSearch(TimeStampedUUIDModel):
    """
    Phase 16: User Saved Searches & Notifications
    Stores user saved search filters with optional notification triggers
    when new matching content arrives. Max 20 per user.
    """
    class NotificationFrequency(models.TextChoices):
        INSTANT = 'INSTANT', 'فوري (Instant)'
        DAILY = 'DAILY', 'يومي (Daily)'
        WEEKLY = 'WEEKLY', 'أسبوعي (Weekly)'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_searches",
        verbose_name="المستخدم"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="saved_searches",
        verbose_name="المستأجر"
    )
    name = models.CharField(
        max_length=150,
        verbose_name="اسم البحث المحفوظ"
    )
    query = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="نص الاستعلام"
    )
    filters = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="فلاتر البحث المحفوظة"
    )
    notification_enabled = models.BooleanField(
        default=False,
        verbose_name="تفعيل الإشعارات عند توفر محتوى جديد"
    )
    notification_frequency = models.CharField(
        max_length=20,
        choices=NotificationFrequency.choices,
        default=NotificationFrequency.WEEKLY,
        verbose_name="تكرار الإشعارات"
    )
    last_notified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ آخر إشعار مرسل"
    )

    class Meta:
        verbose_name = "بحث محفوظ (Saved Search)"
        verbose_name_plural = "عمليات البحث المحفوظة"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_saved_usr_created'),
            models.Index(fields=['tenant', 'notification_enabled'], name='idx_saved_ten_notif'),
        ]

    def __str__(self):
        return f"{self.user_id} - {self.name} ('{self.query}')"


class SearchABTest(TimeStampedUUIDModel):
    """
    Phase 16: Search A/B Testing Framework
    Manages traffic splitting, variant evaluation (Ranking, Suggestions, Facets, NL Search),
    and KPI metrics measurement (CTR, Zero Results Rate, Latency, Conversion).
    """
    class TestType(models.TextChoices):
        RANKING = 'RANKING', 'خوارزمية الترتيب (Ranking Algorithm)'
        SUGGESTIONS = 'SUGGESTIONS', 'محرك الاقتراحات (Suggestions)'
        FACETS = 'FACETS', 'توزيع الفئات (Facets)'
        NL_SEARCH = 'NL_SEARCH', 'البحث الطبيعي (Natural Language)'

    class TestStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'مسودة (Draft)'
        RUNNING = 'RUNNING', 'قيد التشغيل (Running)'
        PAUSED = 'PAUSED', 'متوقف مؤقتاً (Paused)'
        COMPLETED = 'COMPLETED', 'مكتمل (Completed)'
        CANCELLED = 'CANCELLED', 'ملغى (Cancelled)'

    class TargetMetric(models.TextChoices):
        CTR = 'CTR', 'معدل النقر (Click-Through Rate)'
        ZERO_RESULTS_RATE = 'ZERO_RESULTS_RATE', 'نسبة النتائج الصفرية (Zero Results Rate)'
        EXECUTION_TIME = 'EXECUTION_TIME', 'زمن الاستجابة (Execution Time)'
        CONVERSION = 'CONVERSION', 'معدل التحويل والمشاهدة (Conversion)'

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="search_ab_tests",
        verbose_name="المستأجر"
    )
    name = models.CharField(
        max_length=200,
        verbose_name="اسم الاختبار"
    )
    description = models.TextField(
        blank=True,
        default="",
        verbose_name="وصف الهدف والفرضية"
    )
    test_type = models.CharField(
        max_length=50,
        choices=TestType.choices,
        default=TestType.RANKING,
        verbose_name="نوع الاختبار"
    )
    variant_a_config = models.JSONField(
        default=dict,
        verbose_name="تكوين المجموعة الأساسية A"
    )
    variant_b_config = models.JSONField(
        default=dict,
        verbose_name="تكوين المجموعة التجريبية B"
    )
    traffic_split = models.IntegerField(
        default=50,
        verbose_name="نسبة التحويل إلى المتغير B (0-100%)"
    )
    status = models.CharField(
        max_length=50,
        choices=TestStatus.choices,
        default=TestStatus.DRAFT,
        verbose_name="حالة الاختبار"
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ البدء"
    )
    ended_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاريخ الانتهاء"
    )
    target_metric = models.CharField(
        max_length=50,
        choices=TargetMetric.choices,
        default=TargetMetric.CTR,
        verbose_name="المقياس المستهدف"
    )
    results = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="نتائج ومقاييس الاختبار التراكمية"
    )

    class Meta:
        verbose_name = "اختبار A/B للبحث (Search A/B Test)"
        verbose_name_plural = "اختبارات A/B للبحث"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status'], name='idx_ab_ten_status'),
        ]

    def __str__(self):
        return f"{self.name} [{self.get_test_type_display()}] - {self.get_status_display()}"


