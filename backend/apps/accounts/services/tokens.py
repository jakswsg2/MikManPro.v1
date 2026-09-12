import os
import time
import uuid
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any

import jwt
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache

from apps.accounts.models import User, ExternalIdentity, LoungeSession, AuditLog
from apps.profiles.models import Profile, UserProfileAssignment

# Dedicated JWT signing key (Decision 57 / Architectural standard)
JWT_SIGNING_KEY = getattr(settings, 'JWT_SIGNING_KEY', None) or getattr(settings, 'SECRET_KEY', 'smart-lounge-jwt-lan-key-2026')
JWT_ALGORITHM = 'HS256'

class TokenPair:
    def __init__(self, access_token: str, refresh_token: str, session_id: str, expires_at: datetime, access_expires_in_sec: int = 900):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.session_id = session_id
        self.expires_at = expires_at
        self.access_expires_in_sec = access_expires_in_sec

    def to_dict(self) -> Dict[str, Any]:
        return {
            'access_token': self.access_token,
            'refresh_token': self.refresh_token,
            'session_id': self.session_id,
            'token_type': 'Bearer',
            'expires_in': self.access_expires_in_sec,
            'session_expires_at': self.expires_at.isoformat(),
        }


class SecureTokenService:
    """
    خدمة التوكنات الآمنة (Decision 4, Decision 10)
    - إصدار Access Token (JWT قصير الصلاحية: 15 دقيقة)
    - إصدار Refresh Token (عشوائي 64 bytes، لا يُخزن إلا الـ SHA-256 Hash)
    - دعم One-Time Token (OTT) لربط الـ Captive Portal مع صلاحية 60 ثانية واستخدام لمرة واحدة
    - دعم تدوير التوكنات الإلزامي (Refresh Token Rotation) وإلغاء الجلسات الفردية والجماعية
    """

    @staticmethod
    def hash_token(token_str: str) -> str:
        """Computes SHA-256 hash of a plain token string"""
        return hashlib.sha256(token_str.encode('utf-8')).hexdigest()

    @classmethod
    def issue_token(
        cls,
        user: User,
        external_identity: Optional[ExternalIdentity] = None,
        source: str = 'SSO',
        ttl_minutes: int = 480,  # 8 hours session TTL
        context: Optional[Dict[str, Any]] = None
    ) -> TokenPair:
        """
        يُصدر زوج tokens آمن:
        1. ينشئ جلسة LoungeSession جديدة في قاعدة البيانات
        2. يحفظ SHA-256 hash للتوكنات فقط
        3. يوقّع JWT بمفتاح مستقل
        """
        context = context or {}
        now = timezone.now()
        session_expires_at = now + timedelta(minutes=ttl_minutes)
        access_expires_at = now + timedelta(minutes=15)  # 15 minutes JWT

        # Generate cryptographic random refresh token (64 bytes hex)
        plain_refresh_token = secrets.token_hex(64)
        refresh_token_hash = cls.hash_token(plain_refresh_token)

        # Pre-create session id
        session_id = str(uuid.uuid4())

        # Build JWT Payload (RFC 7519)
        jti = str(uuid.uuid4())
        jwt_payload = {
            'sub': str(user.id),
            'lounge_id': user.lounge_id,
            'username': user.username,
            'session_id': session_id,
            'source': source,
            'iat': int(now.timestamp()),
            'exp': int(access_expires_at.timestamp()),
            'jti': jti,
        }

        # Sign JWT access token
        access_token = jwt.encode(jwt_payload, JWT_SIGNING_KEY, algorithm=JWT_ALGORITHM)
        session_token_hash = cls.hash_token(access_token)

        # Create LoungeSession record (no plain tokens stored!)
        session = LoungeSession.objects.create(
            id=session_id,
            user=user,
            external_identity=external_identity,
            session_token_hash=session_token_hash,
            refresh_token_hash=refresh_token_hash,
            ip_address=context.get('ip_address'),
            user_agent=context.get('user_agent', ''),
            device_fingerprint=context.get('device_fingerprint'),
            mikrotik_session_id=context.get('mikrotik_session_id'),
            radius_session_id=context.get('radius_session_id'),
            source=source,
            status=LoungeSession.Status.ACTIVE,
            issued_at=now,
            expires_at=session_expires_at,
            last_activity_at=now,
        )

        return TokenPair(
            access_token=access_token,
            refresh_token=plain_refresh_token,
            session_id=session_id,
            expires_at=session_expires_at,
            access_expires_in_sec=900
        )

    @classmethod
    def verify_access_token(cls, access_token: str) -> Dict[str, Any]:
        """
        يفكك ويتحقق من صحة الـ Access Token
        ويتحقق من أن الجلسة المرتبطة غير ملغاة (Revoked/Blacklisted)
        """
        try:
            payload = jwt.decode(access_token, JWT_SIGNING_KEY, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise ValueError("انتهت صلاحية رمز الوصول (Access token expired)")
        except jwt.InvalidTokenError:
            raise ValueError("رمز الوصول غير صالح (Invalid access token)")

        session_id = payload.get('session_id')
        if not session_id:
            raise ValueError("معرّف الجلسة مفقود من الرمز")

        # Check blacklist in cache (fast path)
        if cache.get(f"blacklist:session:{session_id}"):
            raise ValueError("تم إلغاء الجلسة مسبقاً (Session revoked)")

        # Verify session in DB
        try:
            session = LoungeSession.objects.get(id=session_id)
            if not session.is_valid:
                raise ValueError("الجلسة منتهية الصلاحية أو تم إبطالها")
            # Update last activity
            session.last_activity_at = timezone.now()
            session.save(update_fields=['last_activity_at'])
        except LoungeSession.DoesNotExist:
            raise ValueError("الجلسة غير موجودة")

        return payload

    @classmethod
    def refresh_tokens(cls, plain_refresh_token: str, context: Optional[Dict[str, Any]] = None) -> TokenPair:
        """
        تدوير التوكنات الإلزامي (Refresh Token Rotation):
        يتحقق من الـ refresh token القديم، ويلغي الجلسة القديمة أو يحدثها،
        ثم يصدر زوجاً جديداً بالكامل ويلغي التوكن السابق فوراً لمنع هجمات إعادة التشغيل.
        """
        context = context or {}
        token_hash = cls.hash_token(plain_refresh_token)

        try:
            session = LoungeSession.objects.select_related('user', 'external_identity').get(
                refresh_token_hash=token_hash
            )
        except LoungeSession.DoesNotExist:
            raise ValueError("رمز التجديد غير صالح أو تم استخدامه مسبقاً")

        if session.status != LoungeSession.Status.ACTIVE:
            raise ValueError(f"الجلسة ليست نشطة (حالتها: {session.status})")

        now = timezone.now()
        if now >= session.expires_at:
            session.status = LoungeSession.Status.EXPIRED
            session.save(update_fields=['status'])
            raise ValueError("انتهت صلاحية جلسة الاستراحة بالكامل. يرجى إعادة تسجيل الدخول.")

        user = session.user
        if not user.is_active or user.status != User.Status.ACTIVE:
            raise ValueError("حساب المستخدم معطل أو غير نشط")

        # Invalidate old session
        session.status = LoungeSession.Status.REVOKED
        session.revoked_at = now
        session.revoked_reason = "تم تدوير التوكن تلقائياً (Automatic Token Rotation)"
        session.save(update_fields=['status', 'revoked_at', 'revoked_reason'])

        # Add old session to blacklist cache
        cache.set(f"blacklist:session:{session.id}", True, timeout=86400)

        # Issue fresh token pair & new session
        new_token_pair = cls.issue_token(
            user=user,
            external_identity=session.external_identity,
            source=session.source,
            ttl_minutes=480,
            context={
                'ip_address': context.get('ip_address') or session.ip_address,
                'user_agent': context.get('user_agent') or session.user_agent,
                'device_fingerprint': session.device_fingerprint,
                'mikrotik_session_id': session.mikrotik_session_id,
                'radius_session_id': session.radius_session_id,
            }
        )

        AuditLog.objects.create(
            event_type=AuditLog.EventType.TOKEN_REFRESH,
            user=user,
            external_identity_ref=str(session.external_identity) if session.external_identity else '',
            ip_address=context.get('ip_address') or session.ip_address,
            user_agent=context.get('user_agent') or session.user_agent,
            details={'old_session_id': str(session.id), 'new_session_id': new_token_pair.session_id}
        )

        return new_token_pair

    @classmethod
    def generate_one_time_token(
        cls,
        user_id: Optional[str] = None,
        external_id: Optional[str] = None,
        identity_type: str = 'RADIUS',
        metadata: Optional[Dict[str, Any]] = None,
        ttl_seconds: int = 60
    ) -> str:
        """
        يُنشئ One-Time Token (OTT) للاستخدام في Captive Portal -> Smart Lounge redirect.
        صالح لمرة واحدة فقط وبمدة TTL = 60 ثانية مخزن في Redis/Cache.
        """
        ott = f"ott_{secrets.token_urlsafe(32)}"
        cache_key = f"ott:{ott}"
        payload = {
            'user_id': user_id,
            'external_id': external_id,
            'identity_type': identity_type,
            'metadata': metadata or {},
            'created_at': time.time(),
        }
        cache.set(cache_key, payload, timeout=ttl_seconds)
        return ott

    @classmethod
    def validate_one_time_token(cls, token: str) -> Dict[str, Any]:
        """
        يفحص الـ One-Time Token ويحذفه فوراً من الـ Cache (Single-use enforcement)
        """
        cache_key = f"ott:{token}"
        data = cache.get(cache_key)
        if not data:
            raise ValueError("رمز التحقق لمرة واحدة غير صالح أو انتهت صلاحيته (OTT Expired or Invalid)")

        # Single-use: delete immediately
        cache.delete(cache_key)
        return data

    @classmethod
    def revoke_session(cls, session_id: str, reason: str = 'User logged out') -> bool:
        """
        يُبطل جلسة محددة فورياً ويضيفها إلى الـ Blacklist
        """
        try:
            session = LoungeSession.objects.get(id=session_id)
            session.status = LoungeSession.Status.REVOKED
            session.revoked_at = timezone.now()
            session.revoked_reason = reason
            session.save(update_fields=['status', 'revoked_at', 'revoked_reason'])

            # Set blacklist in Redis/cache
            cache.set(f"blacklist:session:{session_id}", True, timeout=86400 * 7)

            AuditLog.objects.create(
                event_type=AuditLog.EventType.SESSION_REVOKED,
                user=session.user,
                external_identity_ref=str(session.external_identity) if session.external_identity else '',
                ip_address=session.ip_address,
                user_agent=session.user_agent,
                details={'session_id': session_id, 'reason': reason}
            )
            return True
        except LoungeSession.DoesNotExist:
            return False

    @classmethod
    def revoke_all_user_sessions(cls, user_id: str, reason: str = 'Revoke all sessions') -> int:
        """
        يُبطل كافة جلسات المستخدم النشطة (مثل عند تغيير كلمة المرور أو فقدان الجهاز)
        """
        sessions = LoungeSession.objects.filter(
            user_id=user_id,
            status=LoungeSession.Status.ACTIVE
        )
        now = timezone.now()
        count = 0
        for session in sessions:
            session.status = LoungeSession.Status.REVOKED
            session.revoked_at = now
            session.revoked_reason = reason
            session.save(update_fields=['status', 'revoked_at', 'revoked_reason'])
            cache.set(f"blacklist:session:{session.id}", True, timeout=86400 * 7)
            count += 1

        AuditLog.objects.create(
            event_type=AuditLog.EventType.SESSIONS_REVOKE_ALL,
            user_id=user_id,
            details={'revoked_count': count, 'reason': reason}
        )
        return count


class SSORegistrationService:
    """
    معالجة تسجيل الدخول التلقائي والربط الذكي للهويات الخارجية
    (Decision 23, Decision 25, Decision 26)
    """

    @classmethod
    def authenticate_or_register(
        cls,
        identity_type: str,
        external_id: str,
        source: str = 'SSO',
        metadata: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[User, ExternalIdentity, TokenPair, bool]:
        """
        العملية المركزية للتعرف على المستخدم:
        1. البحث عن ExternalIdentity المسجلة بـ (identity_type, external_id)
        2. إذا لم تكن موجودة، أو غير مربوطة بـ User:
           -> Decision 26: إنشاء Lounge User مستقل فورياً وتوليد Lounge ID فريد
           -> إسناد البروفايل الافتراضي (Basic Profile)
           -> ربط ExternalIdentity بهذا المستخدم
        3. إصدار جلسة LoungeSession جديدة وتوليد TokenPair
        4. تسجيل AuditLog آمن
        """
        metadata = metadata or {}
        context = context or {}
        now = timezone.now()
        external_id_clean = external_id.strip().upper()

        # Find or create ExternalIdentity record
        identity, created_identity = ExternalIdentity.objects.get_or_create(
            identity_type=identity_type,
            external_id=external_id_clean,
            defaults={
                'external_metadata': metadata,
                'is_primary': True,
                'is_verified': True,
                'first_seen_at': now,
                'last_seen_at': now,
            }
        )

        is_first_time = False
        user = identity.user

        if not user:
            # Decision 26: First-time entrance -> Automatic Lounge User creation
            is_first_time = True
            # Unique username based on external identity
            generated_username = f"lounge_{identity_type.lower()}_{external_id_clean.lower()}"
            full_name = metadata.get('full_name') or f"مستخدم كارت {external_id_clean}"

            user = User.objects.create_user(
                username=generated_username,
                full_name=full_name,
                language='ar',
                timezone='Asia/Aden',
                status=User.Status.ACTIVE
            )

            # Link identity to user
            identity.user = user
            identity.is_primary = True
            identity.last_seen_at = now
            identity.external_metadata.update(metadata)
            identity.save()

            # Assign Basic / Default Profile
            default_profile = Profile.objects.filter(is_system=True, code='Basic').first()
            if not default_profile:
                default_profile = Profile.objects.first()

            if default_profile:
                UserProfileAssignment.objects.create(
                    user=user,
                    profile=default_profile,
                    is_active=True
                )

            # Audit first time registration
            AuditLog.objects.create(
                event_type=AuditLog.EventType.FIRST_TIME_REGISTER,
                user=user,
                external_identity_ref=f"{identity_type}:{external_id_clean}",
                ip_address=context.get('ip_address'),
                user_agent=context.get('user_agent', ''),
                details={
                    'lounge_id': user.lounge_id,
                    'identity_type': identity_type,
                    'external_id': external_id_clean,
                    'assigned_profile': default_profile.name if default_profile else None
                }
            )
        else:
            # Existing User Returning
            identity.last_seen_at = now
            if metadata:
                identity.external_metadata.update(metadata)
            identity.save(update_fields=['last_seen_at', 'external_metadata', 'updated_at'])

            AuditLog.objects.create(
                event_type=AuditLog.EventType.LOGIN_SUCCESS,
                user=user,
                external_identity_ref=f"{identity_type}:{external_id_clean}",
                ip_address=context.get('ip_address'),
                user_agent=context.get('user_agent', ''),
                details={
                    'lounge_id': user.lounge_id,
                    'identity_type': identity_type,
                    'external_id': external_id_clean,
                }
            )

        # Issue new session and token pair
        token_pair = SecureTokenService.issue_token(
            user=user,
            external_identity=identity,
            source=source,
            ttl_minutes=480,
            context=context
        )

        return user, identity, token_pair, is_first_time

    @classmethod
    def link_card_to_user(
        cls,
        user: User,
        external_id: str,
        identity_type: str = 'RADIUS',
        metadata: Optional[Dict[str, Any]] = None
    ) -> ExternalIdentity:
        """
        Decision 25: ربط كارت جديد أو هوية إضافية بحساب Lounge User قائم
        دون فقدان بيانات المشاهدة أو الصلاحيات المسندة إليه.
        """
        external_id_clean = external_id.strip().upper()
        now = timezone.now()

        existing = ExternalIdentity.objects.filter(
            identity_type=identity_type,
            external_id=external_id_clean
        ).first()

        if existing and existing.user and existing.user.id != user.id:
            raise ValueError(f"هذا الكارت ({external_id_clean}) مربوط مسبقاً بمستخدم استراحة آخر ({existing.user.lounge_id})")

        identity, _ = ExternalIdentity.objects.update_or_create(
            identity_type=identity_type,
            external_id=external_id_clean,
            defaults={
                'user': user,
                'is_primary': not user.external_identities.filter(is_primary=True).exists(),
                'is_verified': True,
                'last_seen_at': now,
                'external_metadata': metadata or {}
            }
        )

        AuditLog.objects.create(
            event_type=AuditLog.EventType.CARD_LINKED,
            user=user,
            external_identity_ref=f"{identity_type}:{external_id_clean}",
            details={
                'lounge_id': user.lounge_id,
                'external_id': external_id_clean,
                'identity_type': identity_type,
            }
        )

        return identity
