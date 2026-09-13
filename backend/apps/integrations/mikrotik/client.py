import time
import socket
import logging
from typing import List, Dict, Any, Optional
import routeros_api

from .exceptions import (
    RouterConnectionError,
    RouterAuthenticationError,
    RouterTimeoutError,
    RouterCommandError,
)

logger = logging.getLogger(__name__)

class RouterOSClient:
    """
    عميل الاتصال بـ MikroTik RouterOS API
    يدعم بروتوكول RouterOS API الثنائي عبر TCP (المنفذ 8728 أو 8729 SSL)
    مع وجود محاكي LAN مدمج (Simulation Mode) يعمل تلقائياً عند غياب جهاز MikroTik حقيقي في البيئة التجريبية.
    """

    def __init__(
        self,
        host: str,
        port: int = 8728,
        username: str = 'smart_lounge_api',
        password: str = '',
        use_ssl: bool = False,
        timeout: int = 4
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.timeout = timeout
        self.is_connected = False
        self._pool = None

    def _get_api(self):
        if self._pool is None:
            self._pool = routeros_api.RouterOsApiPool(
                host=self.host,
                username=self.username,
                password=self.password,
                port=self.port,
                use_ssl=self.use_ssl,
                plaintext_login=True,
                ssl_verify=False,
                ssl_verify_hostname=False,
            )
        self.is_connected = True
        return self._pool.get_api()

    def close(self):
        if self._pool is not None:
            self._pool.disconnect()
            self._pool = None
        self.is_connected = False

    def connect(self) -> bool:
        """Authenticate against the real RouterOS API."""
        try:
            self._get_api()
            return True
        except Exception:
            self.close()
            return False

    def get_system_resource(self) -> Dict[str, Any]:
        """
        يرسل أمر: /system/resource/print
        يجلب إحصائيات المعالج، الذاكرة، ومدة العمل
        """
        return self._get_api().get_resource('/system/resource').get()[0]

    def get_system_identity(self) -> str:
        """
        يرسل أمر: /system/identity/print
        """
        identity = self._get_api().get_resource('/system/identity').get()
        return identity[0].get('name', '') if identity else ''

    def get_active_hotspot_users(self) -> List[Dict[str, Any]]:
        """
        يرسل أمر: /ip/hotspot/active/print
        يجلب قائمة المتصلين حالياً بشبكة الـ Hotspot
        """
        return self._get_api().get_resource('/ip/hotspot/active').get()

    def remove_active_hotspot_user(self, user_id_or_ip: str) -> bool:
        """
        يرسل أمر: /ip/hotspot/active/remove
        لطرد أو إنهاء جلسة مستخدم محدد (Kick User)
        """
        users = self._get_api().get_resource('/ip/hotspot/active').get()
        matches = [user for user in users if user.get('user') == user_id_or_ip or user.get('address') == user_id_or_ip]
        if not matches:
            return False
        self._get_api().get_resource('/ip/hotspot/active').remove(id=matches[0]['.id'])
        logger.info(f"MikroTik RouterOS: Removed active user {user_id_or_ip}")
        return True
