"""HTTP / API tests for the chat-runtime endpoints.

The chat endpoints live under ``/api/agents/chat/`` so they don't collide
with HEAD's enterprise control plane (workspaces, templates, runs, …).
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from agents.models import Conversation, Message
from agents.registry import AgentTool, registry

from .conftest import FakeRouterScript

pytestmark = pytest.mark.django_db


@pytest.fixture
def client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def test_conversation_crud(client, user):
    res = client.post('/api/agents/chat/conversations/', {'title': 'Project plan'}, format='json')
    assert res.status_code == 201, res.data
    cid = res.data['id']

    res = client.get('/api/agents/chat/conversations/')
    assert res.status_code == 200
    assert any(c['id'] == cid for c in res.data['results'])

    res = client.get(f'/api/agents/chat/conversations/{cid}/')
    assert res.status_code == 200
    assert res.data['title'] == 'Project plan'

    res = client.patch(
        f'/api/agents/chat/conversations/{cid}/',
        {'title': 'Renamed'},
        format='json',
    )
    assert res.status_code == 200
    assert res.data['title'] == 'Renamed'

    res = client.delete(f'/api/agents/chat/conversations/{cid}/')
    assert res.status_code == 204


def test_tool_catalogue(client, user):
    registry.register(AgentTool(
        name='cat_a', description='a',
        parameters={'type': 'object', 'properties': {}}, handler=lambda: 'a',
    ))
    registry.register(AgentTool(
        name='cat_b', description='b',
        parameters={'type': 'object', 'properties': {}},
        handler=lambda: 'b', is_premium=True,
    ))
    res = client.get('/api/agents/chat/tools/')
    assert res.status_code == 200
    payload = res.data
    names = {t['name']: t for t in payload['tools']}
    assert 'cat_a' in names and 'cat_b' in names
    assert names['cat_a']['available'] is True
    # Free user: premium tools shown but marked unavailable.
    assert names['cat_b']['available'] is False


def test_streaming_endpoint_emits_sse_events(client, user, fake_router):
    fake_router.script.append(FakeRouterScript(content='Hi!', finish_reason='stop'))
    res = client.post('/api/agents/chat/stream/', {'message': 'hello'}, format='json')
    assert res.status_code == 200
    body = b''.join(res.streaming_content).decode('utf-8')
    assert 'event: conversation' in body
    assert 'event: run_start' in body
    assert 'event: token' in body
    assert 'event: done' in body


def test_streaming_endpoint_creates_conversation_when_missing(client, user, fake_router):
    fake_router.script.append(FakeRouterScript(content='ok', finish_reason='stop'))
    assert Conversation.objects.filter(user=user).count() == 0
    res = client.post(
        '/api/agents/chat/stream/', {'message': 'first message'}, format='json',
    )
    assert res.status_code == 200
    list(res.streaming_content)
    assert Conversation.objects.filter(user=user).count() == 1
    convo = Conversation.objects.get(user=user)
    assert convo.title == 'first message'


def test_streaming_endpoint_reuses_conversation(client, user, fake_router):
    convo = Conversation.objects.create(user=user, title='Existing')
    fake_router.script.append(FakeRouterScript(content='ok', finish_reason='stop'))
    res = client.post('/api/agents/chat/stream/', {
        'conversation_id': str(convo.id), 'message': 'continue',
    }, format='json')
    assert res.status_code == 200
    list(res.streaming_content)
    convo.refresh_from_db()
    assert convo.messages.filter(role='user', content='continue').exists()


def test_run_audit_listing(client, user, fake_router):
    fake_router.script.append(FakeRouterScript(content='one', finish_reason='stop'))
    res = client.post('/api/agents/chat/stream/', {'message': 'hello'}, format='json')
    list(res.streaming_content)

    res = client.get('/api/agents/chat/runs/')
    assert res.status_code == 200
    assert res.data['count'] == 1
    run = res.data['results'][0]
    assert run['status'] == 'completed'
    assert run['total_steps'] >= 1


def test_rating_endpoint(client, user, fake_router):
    fake_router.script.append(FakeRouterScript(content='hello', finish_reason='stop'))
    res = client.post('/api/agents/chat/stream/', {'message': 'hi'}, format='json')
    list(res.streaming_content)
    msg = Message.objects.filter(role='assistant').first()
    assert msg is not None

    res = client.post(
        '/api/agents/chat/ratings/',
        {'message': str(msg.id), 'rating': 1},
        format='json',
    )
    assert res.status_code == 201, res.data

    # Idempotent — same user can flip but doesn't duplicate.
    res = client.post(
        '/api/agents/chat/ratings/',
        {'message': str(msg.id), 'rating': -1, 'comment': 'meh'},
        format='json',
    )
    assert res.status_code == 201
    res = client.get('/api/agents/chat/ratings/')
    assert res.data['count'] == 1
    assert res.data['results'][0]['rating'] == -1
