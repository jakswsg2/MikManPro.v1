from django.db import models

class PlaybackMethod(models.TextChoices):
    DIRECT_PLAY = 'DIRECT_PLAY', 'تشغيل مباشر (Direct Play)'
    DIRECT_STREAM = 'DIRECT_STREAM', 'بث مباشر (Direct Stream)'
    TRANSCODE = 'TRANSCODE', 'تحويل ترميز (Transcode)'

class PlaybackQuality(models.TextChoices):
    AUTO = 'AUTO', 'تلقائي (Auto)'
    Q_480P = '480p', '480p SD'
    Q_720P = '720p', '720p HD'
    Q_1080P = '1080p', '1080p FHD'
    Q_4K = '4K', '4K Ultra HD'

class SubtitleSize(models.TextChoices):
    SMALL = 'SMALL', 'صغير (Small)'
    MEDIUM = 'MEDIUM', 'متوسط (Medium)'
    LARGE = 'LARGE', 'كبير (Large)'
    XLARGE = 'XLARGE', 'كبير جداً (X-Large)'

class SubtitlePosition(models.TextChoices):
    BOTTOM = 'BOTTOM', 'أسفل الشاشة (Bottom)'
    TOP = 'TOP', 'أعلى الشاشة (Top)'

class SubtitleFormat(models.TextChoices):
    SRT = 'SRT', 'SubRip (.srt)'
    VTT = 'VTT', 'WebVTT (.vtt)'
    ASS = 'ASS', 'Advanced SubStation Alpha (.ass)'

class QualityEventType(models.TextChoices):
    START = 'START', 'بدء التشغيل (Start)'
    SWITCH = 'SWITCH', 'تبديل الجودة (Switch)'
    BUFFER_START = 'BUFFER_START', 'بدء التخزين المؤقت (Buffer Start)'
    BUFFER_END = 'BUFFER_END', 'انتهاء التخزين المؤقت (Buffer End)'
    QUALITY_DOWN = 'QUALITY_DOWN', 'خفض الجودة (Quality Down)'
    QUALITY_UP = 'QUALITY_UP', 'رفع الجودة (Quality Up)'
    ERROR = 'ERROR', 'خطأ في التشغيل (Playback Error)'

class WatchPartyStatus(models.TextChoices):
    WAITING = 'WAITING', 'بانتظار البدء (Waiting)'
    PLAYING = 'PLAYING', 'جاري المشاهدة (Playing)'
    PAUSED = 'PAUSED', 'موقوف مؤقتاً (Paused)'
    ENDED = 'ENDED', 'منتهية (Ended)'

class WatchPartyRole(models.TextChoices):
    HOST = 'HOST', 'المضيف الرئيسي (Host)'
    VIEWER = 'VIEWER', 'مشاهد ومشارك (Viewer)'

class PlaybackScope(models.TextChoices):
    BROWSER = 'BROWSER', 'متصفح النظام (Browser Player)'
    EXTERNAL = 'EXTERNAL', 'مشغل خارجي (External Player)'
    CAST = 'CAST', 'بث عبر أجهزة كاست (Casting)'
