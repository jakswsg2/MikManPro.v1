import time
import logging
from typing import Dict, Any, Tuple, Optional
from django.utils import timezone

from .models import RadiusServer
from .client import RadiusClient
from .exceptions import RadiusAuthenticationFailed, RadiusServerUnreachable

logger = logging.getLogger(__name__)

class RadiusGateway:
    """
    بوابة RADIUS المركزية (Decision 32: Hybrid RADIUS Gateway)
    تطبق استراتيجية التجاوز عند الأعطال (Failover):
    Primary Server -> Secondary Server -> Disaster Recovery Failover Server
    مع مراقبة دقيقة لزمن الاستجابة ومعدل الخطأ.
    """

    @classmethod
    def get_server_chain(cls):
        """Returns active servers ordered by priority"""
        servers = list(RadiusServer.objects.filter(is_active=True).order_by('priority'))
        if not servers:
            # In-memory default for initial bootstrap
            primary = RadiusServer(
                name='FreeRADIUS-Core-01',
                host='192.168.1.10',
                auth_port=1812,
                acct_port=1813,
                role=RadiusServer.ServerRole.PRIMARY,
                priority=1,
                status=RadiusServer.Status.ONLINE
            )
            secondary = RadiusServer(
                name='FreeRADIUS-Secondary-02',
                host='192.168.1.11',
                auth_port=1812,
                acct_port=1813,
                role=RadiusServer.ServerRole.SECONDARY,
                priority=2,
                status=RadiusServer.Status.ONLINE
            )
            failover = RadiusServer(
                name='FreeRADIUS-Cloud-Failover',
                host='10.8.0.5',
                auth_port=1812,
                acct_port=1813,
                role=RadiusServer.ServerRole.FAILOVER,
                priority=3,
                status=RadiusServer.Status.ONLINE
            )
            return [primary, secondary, failover]
        return servers

    @classmethod
    def authenticate_card_with_failover(
        cls,
        card_number: str,
        password: str = ''
    ) -> Tuple[bool, Dict[str, Any], str]:
        """
        يفحص كارت الهوتسبوت عبر خوادم RADIUS بالتسلسل الذكي:
        Primary -> Secondary -> Failover
        يعيد: (is_valid, radius_attributes, server_used_name)
        """
        servers = cls.get_server_chain()
        last_error = None

        for server in servers:
            if server.status == RadiusServer.Status.OFFLINE and server.role != RadiusServer.ServerRole.FAILOVER:
                continue

            try:
                start = time.time()
                client = RadiusClient(
                    host=server.host,
                    auth_port=server.auth_port,
                    acct_port=server.acct_port,
                    secret=server.secret_encrypted or 'testing123'
                )

                is_success, attrs = client.authenticate_credentials(card_number, password)
                elapsed_ms = round((time.time() - start) * 1000, 2)
                if elapsed_ms <= 0:
                    elapsed_ms = 0.9

                # Update server metrics if persisted in DB
                if getattr(server, 'id', None) and RadiusServer.objects.filter(id=server.id).exists():
                    server.last_health_check = timezone.now()
                    server.latency_ms = elapsed_ms
                    server.total_requests += 1
                    server.status = RadiusServer.Status.ONLINE
                    server.save()

                if is_success:
                    logger.info(f"RADIUS Gateway: Card {card_number} verified via {server.name} in {elapsed_ms}ms")
                    return True, attrs, server.name
                else:
                    return False, attrs, server.name

            except Exception as e:
                logger.warning(f"RADIUS Gateway: Server {server.name} failed: {e}. Trying next server in failover chain...")
                last_error = e
                if getattr(server, 'id', None) and RadiusServer.objects.filter(id=server.id).exists():
                    server.failed_requests += 1
                    server.status = RadiusServer.Status.DEGRADED
                    server.save()

        raise RadiusServerUnreachable(f"All RADIUS servers failed. Last error: {last_error}")
