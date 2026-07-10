"""
Server-Sent Events helpers.

We deliberately format SSE events ourselves rather than pulling in a library —
SSE is a tiny protocol (six lines of state) and a hand-rolled implementation
gives us:

1. Perfect control over heartbeats (so nginx doesn't kill long-running streams).
2. Predictable error semantics — an exception inside the generator is
   surfaced as a final ``event: error`` frame to the client and never as a
   broken stream.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Callable, Dict, Iterable, Iterator, Optional

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 15.0  # seconds


def format_sse(event: str, data: Any, event_id: Optional[str] = None) -> str:
    """Encode one SSE frame.

    The ``data`` payload is JSON-encoded for structured events. If a string is
    passed, it is sent as-is so the client receives a plain ``data:`` line.
    """
    if not isinstance(data, str):
        data = json.dumps(data, default=str, ensure_ascii=False)
    chunks = []
    if event_id is not None:
        chunks.append(f'id: {event_id}')
    chunks.append(f'event: {event}')
    # Multi-line payloads must repeat ``data:`` on each line.
    for line in data.splitlines() or ['']:
        chunks.append(f'data: {line}')
    chunks.append('')  # blank line terminates the event
    return '\n'.join(chunks) + '\n'


def sse_response(generator: Iterable[str], *, request: Any = None) -> Any:
    """Wrap a generator in a Django StreamingHttpResponse with SSE headers.

    Imported lazily so this module can be unit-tested without Django.
    """
    from django.http import StreamingHttpResponse

    response = StreamingHttpResponse(generator, content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    # Disable nginx buffering for this connection (mirrors the location block).
    response['X-Accel-Buffering'] = 'no'
    response['Connection'] = 'keep-alive'
    return response


class HeartbeatStream:
    """Wrap a generator with periodic heartbeat comments.

    SSE comments (``: ping``) are ignored by browsers but keep proxies and
    load balancers from idling-out the connection.
    """

    def __init__(self, source: Iterator[str], interval: float = HEARTBEAT_INTERVAL) -> None:
        self.source = source
        self.interval = interval

    def __iter__(self) -> Iterator[str]:
        last = time.monotonic()
        for chunk in self.source:
            yield chunk
            now = time.monotonic()
            if now - last >= self.interval:
                yield ': ping\n\n'
                last = now


def safe_event_stream(builder: Callable[[], Iterator[Dict[str, Any]]]) -> Iterator[str]:
    """Convert a generator of ``{type, data}`` dicts into SSE frames, with
    a final ``error`` frame if anything raises mid-stream."""
    try:
        for event in builder():
            evt_type = event.get('type', 'message')
            yield format_sse(evt_type, event.get('data'))
    except GeneratorExit:
        # Client disconnected mid-stream; nothing to do.
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception('SSE stream failed: %s', exc)
        yield format_sse('error', {'message': str(exc) or 'stream_error'})
        yield format_sse('done', {'status': 'failed'})
