import time
import math
import random
import logging
import requests
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

class ConnectionPoolManager:
    """
    Connection Pooling and Session Reuse Manager.
    Maintains persistent HTTP sessions per media server to eliminate TCP handshake
    and TLS renegotiation latency overhead across requests.
    Supports Exponential Backoff with Jitter for retries.
    """
    _sessions: Dict[str, requests.Session] = {}

    @classmethod
    def get_session(cls, media_server_id: str, pool_connections: int = 10, pool_maxsize: int = 25) -> requests.Session:
        """
        Retrieves or initializes a pooled requests.Session for the server.
        """
        if media_server_id not in cls._sessions:
            session = requests.Session()
            adapter = requests.adapters.HTTPAdapter(
                pool_connections=pool_connections,
                pool_maxsize=pool_maxsize,
                max_retries=1
            )
            session.mount('http://', adapter)
            session.mount('https://', adapter)
            cls._sessions[media_server_id] = session
            logger.info(f"Initialized connection pool for media server {media_server_id} (maxsize={pool_maxsize})")
        return cls._sessions[media_server_id]

    @classmethod
    def close_session(cls, media_server_id: str):
        if media_server_id in cls._sessions:
            try:
                cls._sessions[media_server_id].close()
            except Exception:
                pass
            del cls._sessions[media_server_id]

    @classmethod
    def execute_with_retry(cls, operation: Callable[[], Any],
                           max_retries: int = 3,
                           base_delay: float = 0.5,
                           max_delay: float = 5.0) -> Any:
        """
        Executes a callable with Exponential Backoff and Full Jitter.
        Delay formula: min(max_delay, base_delay * (2 ** attempt)) * random(0.5, 1.0)
        """
        last_exception = None
        for attempt in range(max_retries):
            try:
                return operation()
            except (requests.RequestException, ConnectionError, TimeoutError) as e:
                last_exception = e
                if attempt == max_retries - 1:
                    break
                # Calculate backoff
                calculated = min(max_delay, base_delay * (2 ** attempt))
                jittered_delay = calculated * random.uniform(0.5, 1.0)
                logger.warning(f"Retry attempt {attempt + 1}/{max_retries} failed: {e}. Backing off {jittered_delay:.2f}s...")
                time.sleep(jittered_delay)

        if last_exception:
            raise last_exception
