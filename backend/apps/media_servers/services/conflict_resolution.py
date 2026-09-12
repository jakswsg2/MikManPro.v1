import secrets
import string
import logging
from typing import Optional
from apps.media_servers.connectors import get_connector

logger = logging.getLogger(__name__)

class UsernameConflictError(Exception):
    """Raised when an external username conflict cannot be resolved."""
    pass

class UsernameConflictResolver:
    """
    Handles naming conflicts when provisioning a new user on a media server.
    If the candidate username is already taken, increments numerical suffixes (e.g. LU-10025-2),
    or uses random alphanumeric salt.
    """

    def resolve(self, media_server, base_username: str, connector=None) -> str:
        if not connector:
            connector = get_connector(media_server)

        # 1. Test base username
        existing = connector.get_user_by_username(base_username)
        if not existing:
            return base_username

        logger.warning(f"Username '{base_username}' already exists on {media_server.name}. Resolving conflict...")

        # 2. Try numerical suffixes -2 to -99
        for i in range(2, 100):
            candidate = f"{base_username}-{i}"
            if not connector.get_user_by_username(candidate):
                logger.info(f"Resolved username conflict: '{base_username}' -> '{candidate}'")
                return candidate

        # 3. Fallback to random salt
        salt = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
        candidate = f"{base_username}-{salt}"
        if not connector.get_user_by_username(candidate):
            return candidate

        raise UsernameConflictError(f"Could not resolve username conflict for '{base_username}' after 100 attempts.")
