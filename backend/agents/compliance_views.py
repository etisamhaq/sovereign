"""REST API for the Sovereign compliance-audit capability.

Two endpoints, mounted under ``/api/agents/compliance/``:

- ``GET  frameworks/`` — list the available regulatory frameworks.
- ``POST audit/``      — audit a document and return structured findings + a
  Markdown risk report. The ``provider`` field is the demo centerpiece: send
  ``"amd"`` to run inference privately on AMD Instinct GPUs, or ``"fireworks"``
  for the fast managed path.
"""

from __future__ import annotations

import logging

from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .compliance import list_frameworks, render_report, run_audit
from .llm import LLMError

logger = logging.getLogger(__name__)

# Providers a client is allowed to request. Empty string = configured default
# chain (fireworks -> groq -> amd).
ALLOWED_PROVIDERS = {'', 'amd', 'fireworks', 'groq', 'openai', 'anthropic', 'ollama'}

MAX_DOCUMENT_CHARS = 100_000


class ComplianceFrameworksView(APIView):
    """List the regulatory frameworks available for an audit."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'frameworks': list_frameworks()})


class _AuditRequestSerializer(serializers.Serializer):
    document_text = serializers.CharField(trim_whitespace=False, max_length=MAX_DOCUMENT_CHARS)
    framework = serializers.CharField(required=False, default='gdpr')
    provider = serializers.CharField(required=False, allow_blank=True, default='')
    document_name = serializers.CharField(required=False, allow_blank=True, default='Document')

    def validate_document_text(self, value):
        if not value.strip():
            raise serializers.ValidationError('Document text must not be empty.')
        return value

    def validate_provider(self, value):
        value = (value or '').strip().lower()
        if value not in ALLOWED_PROVIDERS:
            raise serializers.ValidationError(
                f'Unsupported provider. Choose one of: {sorted(p for p in ALLOWED_PROVIDERS if p)}.'
            )
        return value

    def validate_framework(self, value):
        return (value or 'gdpr').strip().lower()


class ComplianceAuditView(APIView):
    """Audit a document against a framework; return findings + Markdown report."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = _AuditRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            audit = run_audit(
                document_text=data['document_text'],
                framework=data['framework'],
                provider=data['provider'] or None,
            )
        except ValueError as exc:
            # Unknown framework / empty document.
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except LLMError as exc:
            logger.warning('Compliance audit LLM failure: %s', exc)
            return Response(
                {'detail': f'The audit model was unavailable: {exc}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        document_name = data['document_name'] or 'Document'
        report_markdown = render_report(audit, document_name=document_name)
        return Response({**audit, 'document_name': document_name, 'report_markdown': report_markdown})
