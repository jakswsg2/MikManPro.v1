import os
import base64
from typing import Optional

def _get_fernet_key() -> bytes:
    """
    Returns 32-byte urlsafe base64-encoded Fernet key.
    Uses FERNET_KEY from environment, with a stable fallback in local dev.
    """
    env_key = os.environ.get('FERNET_KEY', '').strip()
    if env_key and len(env_key) >= 32:
        try:
            # If already valid base64 key
            if len(env_key) == 44 and env_key.endswith('='):
                return env_key.encode('utf-8')
            return base64.urlsafe_b64encode(env_key[:32].encode('utf-8').ljust(32, b'0'))
        except Exception:
            pass
    # Deterministic development key
    default_secret = b"SmartLoungeFernetSecretKey2026!#"
    return base64.urlsafe_b64encode(default_secret)

def encrypt_secret(plain_text: str) -> bytes:
    """
    Encrypts a string secret (such as media server password) into Fernet ciphertext bytes.
    """
    if not plain_text:
        return b""
    try:
        from cryptography.fernet import Fernet
        key = _get_fernet_key()
        f = Fernet(key)
        return f.encrypt(plain_text.encode('utf-8'))
    except ImportError:
        # Fallback if cryptography module is absent
        import base64
        return base64.b64encode(plain_text.encode('utf-8'))

def decrypt_secret(cipher_bytes: Optional[bytes]) -> str:
    """
    Decrypts Fernet ciphertext bytes back to plain text.
    """
    if not cipher_bytes:
        return ""
    try:
        from cryptography.fernet import Fernet
        key = _get_fernet_key()
        f = Fernet(key)
        if isinstance(cipher_bytes, str):
            cipher_bytes = cipher_bytes.encode('utf-8')
        return f.decrypt(cipher_bytes).decode('utf-8')
    except Exception:
        try:
            import base64
            if isinstance(cipher_bytes, str):
                cipher_bytes = cipher_bytes.encode('utf-8')
            return base64.b64decode(cipher_bytes).decode('utf-8')
        except Exception:
            return ""
