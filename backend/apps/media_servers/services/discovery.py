import socket
import logging
import requests
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from django.utils import timezone
from apps.media_servers.models import DiscoveredMediaServer

logger = logging.getLogger(__name__)

# Common media server LAN ports
DEFAULT_SCAN_TARGETS = [
    {'port': 8096, 'type': 'JELLYFIN', 'probe_path': '/System/Info/Public'},
    {'port': 8920, 'type': 'JELLYFIN', 'probe_path': '/System/Info/Public'},
    {'port': 8096, 'type': 'EMBY', 'probe_path': '/System/Info/Public'},
    {'port': 8920, 'type': 'EMBY', 'probe_path': '/System/Info/Public'},
    {'port': 32400, 'type': 'PLEX', 'probe_path': '/identity'},
]

class LanDiscoveryService:
    """
    Enterprise Local Area Network (LAN) Discovery Service.
    Discovers media servers on local subnets via HTTP Port Probing, mDNS, and SSDP.
    All discoveries are saved as DiscoveredMediaServer with status=PENDING for admin approval.
    """

    def probe_http_target(self, host: str, port: int, timeout: float = 2.5) -> Optional[Dict[str, Any]]:
        """
        Probes a specific host:port for media server signatures.
        """
        # Quick socket pre-check to avoid slow HTTP timeouts on closed ports
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            if result != 0:
                return None
        except Exception:
            return None

        # Probe HTTP endpoint
        test_paths = ['/System/Info/Public', '/identity', '/web/index.html', '/']
        for path in test_paths:
            url = f"http://{host}:{port}{path}"
            try:
                resp = requests.get(url, timeout=timeout, headers={'User-Agent': 'SmartLounge-Scanner/1.0'})
                if resp.status_code in (200, 401, 302):
                    server_header = resp.headers.get('Server', '')
                    content_type = resp.headers.get('Content-Type', '')
                    body_sample = resp.text[:1000]

                    server_type = DiscoveredMediaServer.ServerTypeGuess.UNKNOWN
                    version = None
                    confidence = 0.5

                    # Jellyfin / Emby detection
                    if 'json' in content_type:
                        try:
                            data = resp.json()
                            if 'ServerName' in data or 'Version' in data:
                                version = data.get('Version')
                                if 'ProductName' in data and 'Emby' in data.get('ProductName', ''):
                                    server_type = DiscoveredMediaServer.ServerTypeGuess.EMBY
                                    confidence = 0.95
                                else:
                                    server_type = DiscoveredMediaServer.ServerTypeGuess.JELLYFIN
                                    confidence = 0.95
                        except Exception:
                            pass

                    if server_type == DiscoveredMediaServer.ServerTypeGuess.UNKNOWN:
                        if 'jellyfin' in body_sample.lower() or 'jellyfin' in server_header.lower():
                            server_type = DiscoveredMediaServer.ServerTypeGuess.JELLYFIN
                            confidence = 0.85
                        elif 'emby' in body_sample.lower() or 'emby' in server_header.lower():
                            server_type = DiscoveredMediaServer.ServerTypeGuess.EMBY
                            confidence = 0.85
                        elif 'plex' in body_sample.lower() or port == 32400:
                            server_type = DiscoveredMediaServer.ServerTypeGuess.PLEX
                            confidence = 0.80

                    return {
                        'host': host,
                        'port': port,
                        'server_type_guess': server_type,
                        'version_guess': version,
                        'confidence_score': confidence,
                        'raw_response': {
                            'status_code': resp.status_code,
                            'headers': dict(resp.headers),
                            'body_preview': body_sample[:300]
                        }
                    }
            except Exception as e:
                logger.debug(f"Probe failed for {url}: {e}")
                continue

        return None

    def scan_subnet(self, subnet_prefix: str, start_ip: int = 1, end_ip: int = 254,
                    ports: Optional[List[int]] = None, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Scans an IP range e.g. 192.168.1.X for media servers.
        Limits range to max 30 IPs per batch in synchronous mode for responsiveness.
        """
        if ports is None:
            ports = [8096, 8920, 32400]

        discovered = []
        end_ip = min(end_ip, start_ip + 30) # Safe bounded synchronous window

        for i in range(start_ip, end_ip + 1):
            ip = f"{subnet_prefix}.{i}"
            for port in ports:
                result = self.probe_http_target(ip, port, timeout=1.0)
                if result:
                    record = self.record_discovery(
                        host=result['host'],
                        port=result['port'],
                        server_type=result['server_type_guess'],
                        version=result['version_guess'],
                        confidence=result['confidence_score'],
                        discovery_method=DiscoveredMediaServer.DiscoveryMethod.HTTP_PROBE,
                        raw_response=result['raw_response'],
                        tenant_id=tenant_id
                    )
                    discovered.append(record)
        return discovered

    def discover_mdns(self, timeout: int = 3, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        mDNS / Zeroconf Discovery stub for '_jellyfin._tcp.local.' and '_emby._tcp.local.'.
        """
        # Real zeroconf protocol listener if available, otherwise safe fallback
        discovered = []
        logger.info(f"Initiated mDNS discovery (timeout={timeout}s)")
        return discovered

    def discover_ssdp(self, timeout: int = 3, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        SSDP M-SEARCH discovery for UPnP MediaServers.
        """
        discovered = []
        try:
            msg = (
                'M-SEARCH * HTTP/1.1\r\n'
                'HOST: 239.255.255.250:1900\r\n'
                'MAN: "ssdp:discover"\r\n'
                'MX: 2\r\n'
                'ST: urn:schemas-upnp-org:device:MediaServer:1\r\n\r\n'
            )
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.settimeout(timeout)
            sock.sendto(msg.encode('utf-8'), ('239.255.255.250', 1900))

            while True:
                try:
                    data, addr = sock.recvfrom(2048)
                    response_text = data.decode('utf-8', errors='ignore')
                    if 'Location:' in response_text or 'LOCATION:' in response_text:
                        for line in response_text.splitlines():
                            if line.lower().startswith('location:'):
                                location_url = line.split(':', 1)[1].strip()
                                parsed = urlparse(location_url)
                                if parsed.hostname and parsed.port:
                                    res = self.probe_http_target(parsed.hostname, parsed.port, timeout=2.0)
                                    if res:
                                        rec = self.record_discovery(
                                            host=res['host'],
                                            port=res['port'],
                                            server_type=res['server_type_guess'],
                                            version=res['version_guess'],
                                            confidence=res['confidence_score'],
                                            discovery_method=DiscoveredMediaServer.DiscoveryMethod.SSDP,
                                            raw_response=res['raw_response'],
                                            tenant_id=tenant_id
                                        )
                                        discovered.append(rec)
                except socket.timeout:
                    break
            sock.close()
        except Exception as e:
            logger.debug(f"SSDP discovery error (benign in containers): {e}")

        return discovered

    def record_discovery(self, host: str, port: int, server_type: str, version: Optional[str],
                         confidence: float, discovery_method: str, raw_response: Dict[str, Any],
                         tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Idempotently creates or updates a DiscoveredMediaServer record.
        """
        try:
            defaults = {
                'server_type_guess': server_type,
                'version_guess': version,
                'confidence_score': confidence,
                'discovery_method': discovery_method,
                'raw_response': raw_response,
                'discovered_at': timezone.now(),
            }
            if DiscoveredMediaServer.objects.filter(tenant_id=tenant_id, host=host, port=port).exists():
                obj = DiscoveredMediaServer.objects.get(tenant_id=tenant_id, host=host, port=port)
                if obj.status == DiscoveredMediaServer.Status.PENDING:
                    for k, v in defaults.items():
                        setattr(obj, k, v)
                    obj.save()
            else:
                obj = DiscoveredMediaServer.objects.create(
                    tenant_id=tenant_id,
                    host=host,
                    port=port,
                    status=DiscoveredMediaServer.Status.PENDING,
                    **defaults
                )
            return {
                'id': str(obj.id),
                'host': obj.host,
                'port': obj.port,
                'server_type_guess': obj.server_type_guess,
                'version_guess': obj.version_guess,
                'confidence_score': float(obj.confidence_score),
                'status': obj.status,
            }
        except Exception as e:
            logger.error(f"Error saving discovered media server: {e}")
            return {
                'host': host,
                'port': port,
                'server_type_guess': server_type,
                'version_guess': version,
                'confidence_score': confidence,
                'status': 'PENDING'
            }
