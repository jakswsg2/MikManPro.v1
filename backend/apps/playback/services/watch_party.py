import secrets
import logging
from decimal import Decimal
from django.utils import timezone
from apps.playback.models import WatchPartySession, WatchPartyParticipant
from apps.playback.constants import WatchPartyStatus, WatchPartyRole

logger = logging.getLogger(__name__)

class WatchPartyService:
    """
    خدمة جلسات المشاهدة الجماعية المتزامنة (Watch Party Basics).
    
    القواعد:
    - التحقق من المستأجر (منع Cross-Tenant Watch Party).
    - توليد كود دعوة فريد (8 أحرف).
    - المضيف (HOST) فقط من يمتلك صلاحية التحكم في الإيقاف/التشغيل/التخطي (Play/Pause/Seek).
    - المشاركون يقومون بمزامنة الموضع عبر استطلاع الحالة (HTTP Polling كل ثانيتين).
    - مغادرة المضيف للجلسة تنهي الجلسة تلقائياً.
    """

    def create_party(
        self,
        host,
        media_item,
        media_source=None,
        is_public: bool = False,
        max_participants: int = 10
    ) -> WatchPartySession:
        """إنشاء جلسة مشاهدة جماعية جديدة بواسطة المضيف."""
        invite_code = self._generate_unique_code()

        tenant = getattr(host, 'tenant', None)

        party = WatchPartySession.objects.create(
            tenant=tenant,
            host=host,
            media_item=media_item,
            media_source=media_source,
            status=WatchPartyStatus.WAITING,
            invite_code=invite_code,
            is_public=is_public,
            max_participants=max(2, min(max_participants, 50)),
        )

        # إضافة المضيف كمشارك برتبة HOST
        WatchPartyParticipant.objects.create(
            party=party,
            user=host,
            role=WatchPartyRole.HOST,
            is_active=True
        )

        return party

    def join_party(self, user, invite_code: str, device_id: str = None) -> WatchPartyParticipant:
        """انضمام مستخدم إلى جلسة المشاهدة الجماعية عبر كود الدعوة."""
        clean_code = invite_code.strip().upper()
        party = WatchPartySession.objects.filter(
            invite_code=clean_code,
            status__in=[WatchPartyStatus.WAITING, WatchPartyStatus.PLAYING, WatchPartyStatus.PAUSED]
        ).first()

        if not party:
            raise ValueError("جلسة المشاهدة غير موجودة أو انتهت بالفعل")

        # التحقق من عزل المستأجر (Tenant Boundary)
        if party.tenant and getattr(user, 'tenant', None) and party.tenant != user.tenant:
            raise PermissionError("لا يمكن الانضمام لجلسة تتبع استراحة مختلفة")

        # فحص سعة الجلسة القصوى
        active_count = party.participants.filter(is_active=True).count()
        if active_count >= party.max_participants:
            raise ValueError(f"الجلسة ممتلئة بالكامل ({party.max_participants} مشاركين)")

        participant, created = WatchPartyParticipant.objects.get_or_create(
            party=party,
            user=user,
            defaults={
                'role': WatchPartyRole.VIEWER,
                'device_id': device_id,
                'is_active': True,
                'joined_at': timezone.now()
            }
        )

        if not created and not participant.is_active:
            participant.is_active = True
            participant.left_at = None
            participant.save()

        return participant

    def sync_playback(
        self,
        party_id: str,
        actor,
        position_seconds: int,
        status: str,
        playback_rate: float = 1.0
    ) -> dict:
        """
        تحديث حالة المشاهدة وموضع التشغيل (محصورة حصرياً بالمضيف HOST).
        """
        party = WatchPartySession.objects.filter(id=party_id).first()
        if not party:
            raise ValueError("جلسة المشاهدة غير موجودة")

        if party.host_id != actor.id:
            raise PermissionError("فقط مضيف الجلسة (Host) يمتلك صلاحية التحكم في التشغيل والإيقاف")

        party.current_position_seconds = max(0, position_seconds)
        if status in WatchPartyStatus.values:
            party.status = status
        party.playback_rate = Decimal(str(round(playback_rate, 2)))

        if status == WatchPartyStatus.PLAYING and not party.started_at:
            party.started_at = timezone.now()

        party.save()

        return {
            'party_id': str(party.id),
            'status': party.status,
            'current_position': party.current_position_seconds,
            'playback_rate': float(party.playback_rate),
            'timestamp': timezone.now().isoformat(),
        }

    def get_state(self, party_id: str, user=None) -> dict:
        """استرجاع الحالة اللحظية للجلسة الجماعية للمشاركين."""
        party = WatchPartySession.objects.filter(id=party_id).select_related('media_item', 'host').first()
        if not party:
            raise ValueError("جلسة المشاهدة غير موجودة")

        participants_qs = party.participants.filter(is_active=True).select_related('user')
        participants_data = []
        for p in participants_qs:
            participants_data.append({
                'id': str(p.id),
                'user_id': str(p.user_id),
                'username': p.user.username,
                'full_name': getattr(p.user, 'full_name', p.user.username),
                'role': p.role,
                'joined_at': p.joined_at.isoformat(),
            })

        return {
            'party_id': str(party.id),
            'invite_code': party.invite_code,
            'status': party.status,
            'current_position': party.current_position_seconds,
            'playback_rate': float(party.playback_rate),
            'is_host': (user and user.is_authenticated and party.host_id == user.id),
            'host_name': getattr(party.host, 'full_name', party.host.username),
            'media_item': {
                'id': str(party.media_item_id),
                'title': party.media_item.title,
                'poster_url': getattr(party.media_item, 'poster_url', ''),
            },
            'participants_count': len(participants_data),
            'participants': participants_data,
            'updated_at': party.updated_at.isoformat(),
        }

    def leave_party(self, user, party_id: str) -> None:
        """مغادرة الجلسة، وإنهاء الجلسة كلياً إذا كان المغادر هو المضيف."""
        party = WatchPartySession.objects.filter(id=party_id).first()
        if not party:
            return

        participant = party.participants.filter(user=user, is_active=True).first()
        if participant:
            participant.is_active = False
            participant.left_at = timezone.now()
            participant.save()

        # إذا غادر المضيف الرئيسي
        if party.host_id == user.id:
            party.status = WatchPartyStatus.ENDED
            party.ended_at = timezone.now()
            party.save()

    def _generate_unique_code(self) -> str:
        for _ in range(10):
            candidate = secrets.token_hex(4).upper()  # 8 أحرف فريدة
            if not WatchPartySession.objects.filter(invite_code=candidate).exists():
                return candidate
        return secrets.token_urlsafe(6).upper()[:8]
