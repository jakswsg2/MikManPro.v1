from django.db import models

class Channel(models.TextChoices):
    IN_APP = 'IN_APP', 'In-App Notification'
    EMAIL = 'EMAIL', 'Email'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    PUSH = 'PUSH', 'Web / Mobile Push'
    SMS = 'SMS', 'SMS'

class Category(models.TextChoices):
    SYSTEM = 'SYSTEM', 'النظام (System)'
    BILLING = 'BILLING', 'الفواتير والاشتراكات (Billing)'
    CONTENT = 'CONTENT', 'المحتوى والوسائط (Content)'
    SECURITY = 'SECURITY', 'الأمان وتسجيل الدخول (Security)'
    MARKETING = 'MARKETING', 'العروض والتسويق (Marketing)'
    ONBOARDING = 'ONBOARDING', 'التهيئة والترحيب (Onboarding)'
    SOCIAL = 'SOCIAL', 'التفاعل والمجتمع (Social)'
    SUPPORT = 'SUPPORT', 'الدعم الفني (Support)'

class Priority(models.TextChoices):
    LOW = 'LOW', 'منخفضة (Low)'
    NORMAL = 'NORMAL', 'عادية (Normal)'
    HIGH = 'HIGH', 'مرتفعة (High)'
    URGENT = 'URGENT', 'عاجلة وفورية (Urgent)'

class NotificationStatus(models.TextChoices):
    PENDING = 'PENDING', 'قيد الانتظار (Pending)'
    QUEUED = 'QUEUED', 'في طابور الإرسال (Queued)'
    SENT = 'SENT', 'تم الإرسال (Sent)'
    PARTIAL = 'PARTIAL', 'مكتمل جزئياً (Partial)'
    FAILED = 'FAILED', 'فشل الإرسال (Failed)'
    CANCELLED = 'CANCELLED', 'ملغي (Cancelled)'
    EXPIRED = 'EXPIRED', 'منتهي الصلاحية (Expired)'

class DeliveryStatus(models.TextChoices):
    PENDING = 'PENDING', 'قيد الانتظار (Pending)'
    QUEUED = 'QUEUED', 'في طابور الإرسال (Queued)'
    SENDING = 'SENDING', 'جاري الإرسال (Sending)'
    SENT = 'SENT', 'تم الإرسال (Sent)'
    DELIVERED = 'DELIVERED', 'تم التسليم (Delivered)'
    READ = 'READ', 'تمت القراءة (Read)'
    FAILED = 'FAILED', 'فشل (Failed)'
    BOUNCED = 'BOUNCED', 'مرتد (Bounced)'
    REJECTED = 'REJECTED', 'مرفوض (Rejected)'
    UNSUBSCRIBED = 'UNSUBSCRIBED', 'إلغاء الاشتراك (Unsubscribed)'

class Frequency(models.TextChoices):
    INSTANT = 'INSTANT', 'فوري (Instant)'
    HOURLY = 'HOURLY', 'كل ساعة (Hourly)'
    DAILY = 'DAILY', 'يومي (Daily)'
    WEEKLY = 'WEEKLY', 'أسبوعي (Weekly)'
    NEVER = 'NEVER', 'مطلقاً (Never)'

class DigestMode(models.TextChoices):
    NONE = 'NONE', 'بدون تجميع (None)'
    HOURLY = 'HOURLY', 'تجميع ساعي (Hourly Digest)'
    DAILY = 'DAILY', 'تجميع يومي (Daily Digest)'
    WEEKLY = 'WEEKLY', 'تجميع أسبوعي (Weekly Digest)'

class HealthStatus(models.TextChoices):
    HEALTHY = 'HEALTHY', 'سليم ومتاح (Healthy)'
    DEGRADED = 'DEGRADED', 'أداء منخفض (Degraded)'
    UNHEALTHY = 'UNHEALTHY', 'غير سليم (Unhealthy)'
    UNKNOWN = 'UNKNOWN', 'غير محدد (Unknown)'
