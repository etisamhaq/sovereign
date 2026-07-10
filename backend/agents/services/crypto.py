import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class TokenCipher:
    """Encrypt/decrypt connector credentials with Fernet."""

    @staticmethod
    def _build_fernet() -> Fernet:
        raw_key = getattr(settings, 'AGENT_ENCRYPTION_KEY', '') or settings.SECRET_KEY
        digest = hashlib.sha256(raw_key.encode('utf-8')).digest()
        key = base64.urlsafe_b64encode(digest)
        return Fernet(key)

    @classmethod
    def encrypt(cls, value: str) -> str:
        if not value:
            return ''
        return cls._build_fernet().encrypt(value.encode('utf-8')).decode('utf-8')

    @classmethod
    def decrypt(cls, token: str) -> str:
        if not token:
            return ''
        try:
            return cls._build_fernet().decrypt(token.encode('utf-8')).decode('utf-8')
        except InvalidToken:
            return ''
