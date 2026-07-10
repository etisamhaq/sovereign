import json
from datetime import timedelta
from datetime import datetime
from typing import Any, Dict

from django.conf import settings
from django.utils import timezone

from agents.models import AgentConnectorAccount
from agents.services.crypto import TokenCipher
from agents.services.oauth_refresh import OAuthRefreshError, OAuthRefreshService


def parse_expiry(expires_at: str | None):
    if not expires_at:
        return None
    try:
        expiry_dt = datetime.fromisoformat(expires_at)
        if timezone.is_naive(expiry_dt):
            expiry_dt = timezone.make_aware(expiry_dt)
        return expiry_dt
    except Exception:
        return None


def ensure_connector_token_health(
    connector: AgentConnectorAccount,
    token_bundle: Dict[str, Any],
    *,
    raise_on_error: bool = True,
) -> Dict[str, Any]:
    metadata = connector.metadata_json or {}
    now = timezone.now()
    refresh_buffer_seconds = int(getattr(settings, 'AGENT_CONNECTOR_REFRESH_BUFFER_SECONDS', 300))

    expires_at = metadata.get('access_token_expires_at')
    expiry_dt = parse_expiry(expires_at)
    refresh_token = token_bundle.get('refresh_token')
    refresh_token_present = bool(refresh_token or metadata.get('refresh_token_present'))

    if not expiry_dt:
        connector.last_sync_at = now
        connector.save(update_fields=['last_sync_at', 'updated_at'])
        return token_bundle

    if expiry_dt > (now + timedelta(seconds=max(refresh_buffer_seconds, 0))):
        connector.last_sync_at = now
        connector.save(update_fields=['last_sync_at', 'updated_at'])
        return token_bundle

    if not refresh_token_present:
        connector.status = 'expired'
        metadata['refresh_token_present'] = False
        metadata['requires_reauth'] = True
        metadata['last_refresh_status'] = 'expired_without_refresh_token'
        metadata['last_refresh_error'] = 'Missing refresh token'
        metadata['last_refresh_attempt_at'] = now.isoformat()
        connector.metadata_json = metadata
        connector.save(update_fields=['status', 'metadata_json', 'updated_at'])
        if raise_on_error:
            raise OAuthRefreshError(f'Connector token expired without refresh token: {connector.provider}')
        return token_bundle

    metadata['last_refresh_attempt_at'] = now.isoformat()

    try:
        next_bundle, next_expiry = OAuthRefreshService.refresh(connector.provider, metadata, token_bundle)
        metadata['access_token_expires_at'] = next_expiry
        metadata['refresh_token_present'] = bool(next_bundle.get('refresh_token'))
        metadata['last_refresh_status'] = 'ok'
        metadata['last_refresh_error'] = ''
        metadata['last_refreshed_at'] = now.isoformat()

        connector.metadata_json = metadata
        connector.status = 'connected'
        connector.last_sync_at = now
        connector.encrypted_tokens_json = TokenCipher.encrypt(json.dumps(next_bundle))
        connector.save(update_fields=[
            'metadata_json', 'status', 'last_sync_at', 'encrypted_tokens_json', 'updated_at'
        ])
        return next_bundle
    except Exception as exc:
        metadata['last_refresh_status'] = 'error'
        metadata['last_refresh_error'] = str(exc)[:500]
        metadata['requires_reauth'] = True
        connector.metadata_json = metadata
        connector.status = 'error'
        connector.save(update_fields=['metadata_json', 'status', 'updated_at'])
        if raise_on_error:
            raise
        return token_bundle
