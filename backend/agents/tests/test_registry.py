"""Tests for the agent tool registry."""

from __future__ import annotations

import pytest

from agents.registry import AgentTool, register_tool, registry


def test_register_and_lookup():
    @register_tool(
        name='echo',
        description='Echoes its input.',
        parameters={'type': 'object', 'properties': {'msg': {'type': 'string'}}, 'required': ['msg']},
        category='test',
    )
    def echo(msg: str) -> str:
        return msg

    tool = registry.get('echo')
    assert tool is not None
    assert tool.handler('hi') == 'hi'
    assert 'echo' in registry.names()


def test_to_openai_function_shape():
    @register_tool(
        name='sum2',
        description='Sum two numbers.',
        parameters={'type': 'object', 'properties': {'a': {'type': 'number'}, 'b': {'type': 'number'}}},
    )
    def _sum(a, b):
        return a + b

    schema = registry.get('sum2').to_openai_function()
    assert schema['type'] == 'function'
    assert schema['function']['name'] == 'sum2'
    assert 'parameters' in schema['function']


def test_filter_premium():
    registry.register(AgentTool(
        name='premium_only', description='', parameters={}, handler=lambda: None, is_premium=True,
    ))
    registry.register(AgentTool(
        name='free_one', description='', parameters={}, handler=lambda: None, is_premium=False,
    ))

    free_only = {t.name for t in registry.filter(allow_premium=False)}
    pro = {t.name for t in registry.filter(allow_premium=True)}

    assert 'premium_only' not in free_only
    assert 'free_one' in free_only
    assert {'premium_only', 'free_one'} <= pro


def test_unknown_lookup_returns_none():
    assert registry.get('does-not-exist') is None
