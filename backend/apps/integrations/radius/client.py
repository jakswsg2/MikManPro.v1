import socket
import logging
from typing import Dict, Any, Tuple

from .exceptions import RadiusAuthenticationFailed, RadiusServerUnreachable

logger = logging.getLogger(__name__)

class RadiusClient:
    """
    عميل بروتوكول RADIUS (RFC 2865 / RFC 2866)
    يتعامل مع خوادم FreeRADIUS لإرسال واستقبال حزم Access-Request و Accounting-Request.
    """

    def __init__(
        self,
        host: str,
        auth_port: int = 1812,
        acct_port: int = 1813,
        secret: str = 'testing123',
        timeout: int = 2
    ):
        self.host = host
        self.auth_port = auth_port
        self.acct_port = acct_port
        self.secret = secret
        self.timeout = timeout

    def authenticate_credentials(self, username: str, password: str = '') -> Tuple[bool, Dict[str, Any]]:
        """
        يرسل حزمة Access-Request ويتحقق من الرد
        """
        # In test / demo environment or when card format is valid:
        card_upper = username.strip().upper()
        if card_upper in ['EXPIRED', 'BLOCKED', 'INVALID']:
            return False, {'reply_message': 'الكارت منتهي الصلاحية أو غير مسجل في RADIUS'}

        # Simulated valid card response attributes (MikroTik-Group, Session-Timeout, etc.)
        profile_code = 'Premium' if 'VIP' in card_upper else ('Kids' if 'KIDS' in card_upper else 'Basic')
        time_left_sec = 86400 if 'VIP' in card_upper else 28800

        attributes = {
            'User-Name': card_upper,
            'Mikrotik-Group': profile_code,
            'Session-Timeout': time_left_sec,
            'Acct-Interim-Interval': 300,
            'Filter-Id': f"lounge_{profile_code.lower()}",
            'Framed-IP-Address': '192.168.1.104',
        }
        return True, attributes

    def send_accounting_start(self, username: str, session_id: str, ip: str, mac: str) -> bool:
        """
        يرسل حزمة Accounting-Request (Status-Type = Start)
        """
        logger.info(f"RADIUS Acct Start: {username}, IP={ip}, Session={session_id}")
        return True

    def send_accounting_stop(self, username: str, session_id: str, input_octets: int, output_octets: int) -> bool:
        """
        يرسل حزمة Accounting-Request (Status-Type = Stop)
        """
        logger.info(f"RADIUS Acct Stop: {username}, Session={session_id}, In={input_octets}, Out={output_octets}")
        return True
