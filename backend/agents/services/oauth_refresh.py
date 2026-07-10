import os
from datetime import timedelta
from typing import Any, Dict, Tuple

import httpx
from django.conf import settings
from django.utils import timezone


class OAuthRefreshError(ValueError):
    pass


class OAuthRefreshService:
    """Provider-specific OAuth refresh handlers for agent connectors."""

    GOOGLE_PROVIDERS = {'gmail', 'google_calendar'}

    @classmethod
    def refresh(cls, provider: str, metadata: Dict[str, Any], token_bundle: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
        refresh_token = token_bundle.get('refresh_token') or metadata.get('refresh_token')
        if not refresh_token:
            raise OAuthRefreshError(f'Missing refresh_token for provider: {provider}')

        if provider in cls.GOOGLE_PROVIDERS:
            return cls._refresh_google(metadata, token_bundle, refresh_token)
        if provider == 'hubspot':
            return cls._refresh_hubspot(metadata, token_bundle, refresh_token)
        if provider == 'pipedrive':
            return cls._refresh_pipedrive(metadata, token_bundle, refresh_token)
        if provider == 'outlook':
            return cls._refresh_outlook(metadata, token_bundle, refresh_token)

        raise OAuthRefreshError(f'Provider does not support OAuth refresh: {provider}')

    @staticmethod
    def _resolve_client_credentials(metadata: Dict[str, Any], env_prefix: str) -> Tuple[str, str]:
        client_id = metadata.get('client_id') or os.getenv(f'{env_prefix}_OAUTH_CLIENT_ID', '')
        client_secret = metadata.get('client_secret') or os.getenv(f'{env_prefix}_OAUTH_CLIENT_SECRET', '')
        if not client_id and env_prefix == 'GOOGLE':
            client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
        if not client_id or not client_secret:
            raise OAuthRefreshError(
                f'Missing OAuth client credentials for {env_prefix.lower()} refresh. '
                f'Set metadata.client_id/client_secret or {env_prefix}_OAUTH_CLIENT_ID/{env_prefix}_OAUTH_CLIENT_SECRET.'
            )
        return client_id, client_secret

    @classmethod
    def _post_token_refresh(cls, token_url: str, data: Dict[str, Any], timeout_seconds: int = 20) -> Dict[str, Any]:
        try:
            response = httpx.post(token_url, data=data, timeout=timeout_seconds)
        except Exception as exc:
            raise OAuthRefreshError(f'Failed OAuth token refresh request: {exc}') from exc

        if response.status_code >= 400:
            body = response.text[:300]
            raise OAuthRefreshError(f'OAuth token refresh failed ({response.status_code}): {body}')

        try:
            payload = response.json()
        except Exception as exc:
            raise OAuthRefreshError(f'Invalid OAuth token response JSON: {exc}') from exc

        if not payload.get('access_token'):
            raise OAuthRefreshError('OAuth token refresh response missing access_token.')
        return payload

    @staticmethod
    def _response_to_tokens(payload: Dict[str, Any], old_bundle: Dict[str, Any], refresh_token: str) -> Tuple[Dict[str, Any], str]:
        expires_in = int(payload.get('expires_in') or 3600)
        expires_at = (timezone.now() + timedelta(seconds=max(expires_in, 60))).isoformat()

        next_bundle = {
            **old_bundle,
            'access_token': payload.get('access_token', ''),
            'refresh_token': payload.get('refresh_token') or old_bundle.get('refresh_token') or refresh_token,
            'token_type': payload.get('token_type') or old_bundle.get('token_type') or 'Bearer',
            'scope': payload.get('scope') or old_bundle.get('scope', ''),
        }
        return next_bundle, expires_at

    @classmethod
    def _refresh_google(cls, metadata: Dict[str, Any], token_bundle: Dict[str, Any], refresh_token: str):
        client_id, client_secret = cls._resolve_client_credentials(metadata, 'GOOGLE')
        token_url = metadata.get('token_url') or 'https://oauth2.googleapis.com/token'
        payload = cls._post_token_refresh(
            token_url=token_url,
            data={
                'grant_type': 'refresh_token',
                'client_id': client_id,
                'client_secret': client_secret,
                'refresh_token': refresh_token,
            },
        )
        return cls._response_to_tokens(payload, token_bundle, refresh_token)

    @classmethod
    def _refresh_hubspot(cls, metadata: Dict[str, Any], token_bundle: Dict[str, Any], refresh_token: str):
        client_id, client_secret = cls._resolve_client_credentials(metadata, 'HUBSPOT')
        token_url = metadata.get('token_url') or 'https://api.hubapi.com/oauth/v1/token'
        payload = cls._post_token_refresh(
            token_url=token_url,
            data={
                'grant_type': 'refresh_token',
                'client_id': client_id,
                'client_secret': client_secret,
                'refresh_token': refresh_token,
            },
        )
        return cls._response_to_tokens(payload, token_bundle, refresh_token)

    @classmethod
    def _refresh_pipedrive(cls, metadata: Dict[str, Any], token_bundle: Dict[str, Any], refresh_token: str):
        client_id, client_secret = cls._resolve_client_credentials(metadata, 'PIPEDRIVE')
        token_url = metadata.get('token_url') or 'https://oauth.pipedrive.com/oauth/token'
        payload = cls._post_token_refresh(
            token_url=token_url,
            data={
                'grant_type': 'refresh_token',
                'client_id': client_id,
                'client_secret': client_secret,
                'refresh_token': refresh_token,
            },
        )
        return cls._response_to_tokens(payload, token_bundle, refresh_token)

    @classmethod
    def _refresh_outlook(cls, metadata: Dict[str, Any], token_bundle: Dict[str, Any], refresh_token: str):
        client_id, client_secret = cls._resolve_client_credentials(metadata, 'MICROSOFT')
        tenant = metadata.get('tenant') or os.getenv('MICROSOFT_OAUTH_TENANT', 'common')
        token_url = metadata.get('token_url') or f'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token'
        scope = metadata.get('scope') or 'offline_access https://graph.microsoft.com/.default'
        payload = cls._post_token_refresh(
            token_url=token_url,
            data={
                'grant_type': 'refresh_token',
                'client_id': client_id,
                'client_secret': client_secret,
                'refresh_token': refresh_token,
                'scope': scope,
            },
        )
        return cls._response_to_tokens(payload, token_bundle, refresh_token)
