"""End-to-end tests for the agent runner with a mocked LLM router."""

from __future__ import annotations

import pytest

from agents.llm import ToolCall
from agents.models import Conversation, Message
from agents.registry import AgentTool, registry
from agents.services.runner import AgentRunner

from .conftest import FakeRouterScript

pytestmark = pytest.mark.django_db


def _drain(events):
    return list(events)


def _types(events):
    return [e['type'] for e in events]


def test_simple_completion_no_tools(user, fake_router):
    fake_router.script.append(FakeRouterScript(content='Hello!', finish_reason='stop'))
    conv = Conversation.objects.create(user=user, title='t')

    events = _drain(AgentRunner(router=fake_router).run(
        user=user, conversation=conv, user_message='Hi there', stream=True,
    ))

    types = _types(events)
    assert 'run_start' in types
    assert types.count('token') == len('Hello!')
    assert types[-1] == 'done'
    assert events[-1]['data']['status'] == 'completed'
    assert events[-1]['data']['final_output'] == 'Hello!'

    msgs = list(conv.messages.order_by('created_at'))
    assert [m.role for m in msgs] == ['user', 'assistant']
    assert msgs[1].content == 'Hello!'


def test_tool_call_loop_executes_tool_and_completes(user, fake_router):
    captured = {}

    def echo(text: str) -> str:
        captured['text'] = text
        return f'echoed:{text}'

    registry.register(AgentTool(
        name='echo_tool', description='Echo', parameters={
            'type': 'object', 'properties': {'text': {'type': 'string'}}, 'required': ['text'],
        }, handler=echo,
    ))

    fake_router.script = [
        FakeRouterScript(
            tool_calls=[ToolCall(id='c1', name='echo_tool', arguments={'text': 'hello'})],
            finish_reason='tool_calls',
        ),
        FakeRouterScript(content='Done!', finish_reason='stop'),
    ]
    conv = Conversation.objects.create(user=user, title='t')
    events = _drain(AgentRunner(router=fake_router).run(
        user=user, conversation=conv, user_message='please echo', stream=True,
    ))

    assert captured['text'] == 'hello'
    types = _types(events)
    assert types.count('tool_call') == 1
    assert types.count('tool_result') == 1
    tool_evt = next(e for e in events if e['type'] == 'tool_result')
    assert tool_evt['data']['name'] == 'echo_tool'
    assert tool_evt['data']['result'] == 'echoed:hello'
    assert events[-1]['type'] == 'done'
    assert events[-1]['data']['status'] == 'completed'

    # Both tool messages should be persisted to the conversation.
    msgs = list(conv.messages.order_by('created_at'))
    roles = [m.role for m in msgs]
    assert roles == ['user', 'assistant', 'tool', 'assistant']
    assert msgs[2].tool_name == 'echo_tool'


def test_premium_tool_hidden_from_free_user(user, fake_router):
    registry.register(AgentTool(
        name='premium_only_tool', description='Premium', parameters={'type': 'object', 'properties': {}},
        handler=lambda: 'should_not_be_called', is_premium=True,
    ))
    fake_router.script.append(FakeRouterScript(content='ok', finish_reason='stop'))
    conv = Conversation.objects.create(user=user, title='t')
    _drain(AgentRunner(router=fake_router).run(
        user=user, conversation=conv, user_message='hi', stream=True,
    ))
    schemas = fake_router.seen_calls[0]['tools']
    names = [s['function']['name'] for s in (schemas or [])]
    assert 'premium_only_tool' not in names


def test_premium_tool_visible_for_pro(pro_user, fake_router):
    registry.register(AgentTool(
        name='premium_visible_tool', description='Premium', parameters={'type': 'object', 'properties': {}},
        handler=lambda: 'ok', is_premium=True,
    ))
    fake_router.script.append(FakeRouterScript(content='ok', finish_reason='stop'))
    conv = Conversation.objects.create(user=pro_user, title='t')
    _drain(AgentRunner(router=fake_router).run(
        user=pro_user, conversation=conv, user_message='hi', stream=True,
    ))
    schemas = fake_router.seen_calls[0]['tools']
    names = [s['function']['name'] for s in (schemas or [])]
    assert 'premium_visible_tool' in names


def test_unknown_tool_call_records_error_and_continues(user, fake_router):
    fake_router.script = [
        FakeRouterScript(
            tool_calls=[ToolCall(id='c1', name='nope', arguments={})],
            finish_reason='tool_calls',
        ),
        FakeRouterScript(content='Sorry, fixed it.', finish_reason='stop'),
    ]
    conv = Conversation.objects.create(user=user, title='t')
    events = _drain(AgentRunner(router=fake_router).run(
        user=user, conversation=conv, user_message='fail please', stream=True,
    ))
    tool_result = next(e for e in events if e['type'] == 'tool_result')
    assert tool_result['data']['error'] is True
    assert events[-1]['type'] == 'done'
    assert events[-1]['data']['status'] == 'completed'


def test_max_steps_safeguard(user, fake_router):
    # The model never stops calling a tool — runner must cap and finish.
    registry.register(AgentTool(
        name='loop_tool', description='loop', parameters={'type': 'object', 'properties': {}},
        handler=lambda: 'loop',
    ))
    fake_router.script = [
        FakeRouterScript(
            tool_calls=[ToolCall(id=f'c{i}', name='loop_tool', arguments={})],
            finish_reason='tool_calls',
        )
        for i in range(10)
    ]
    conv = Conversation.objects.create(user=user, title='t')
    events = _drain(AgentRunner(max_steps=3, router=fake_router).run(
        user=user, conversation=conv, user_message='hi', stream=True,
    ))
    assert events[-1]['type'] == 'done'
    # Step budget exhausted but the run still completes deterministically.
    assert events[-1]['data']['status'] == 'completed'


def test_moderation_blocks_request(monkeypatch, user, fake_router):
    """When moderation flags input, the runner must short-circuit."""
    from agents.services import moderation as mod_module

    monkeypatch.setattr(
        'agents.services.runner.moderate_input',
        lambda text: mod_module.ModerationResult(flagged=True, category='violence'),
    )
    conv = Conversation.objects.create(user=user, title='t')
    events = _drain(AgentRunner(router=fake_router).run(
        user=user, conversation=conv, user_message='blocked input', stream=True,
    ))
    assert events[0]['type'] == 'error'
    assert events[-1]['type'] == 'done'
    assert events[-1]['data']['status'] == 'blocked'
    # No conversation messages should have been persisted for moderation rejection.
    assert conv.messages.count() == 0
