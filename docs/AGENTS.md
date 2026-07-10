# Sovereign Agent — Architecture & Developer Guide

Sovereign Agent is the function-calling agentic system that sits on top of the
30+ existing AI tools. It exposes a streaming chat surface, a YAML workflow
runner, and a Pro-aware tool catalogue. This document describes the system
end-to-end so you can extend, debug, and operate it confidently.

- [Goals](#goals)
- [High-level architecture](#high-level-architecture)
- [Backend layout](#backend-layout)
- [Frontend layout](#frontend-layout)
- [API surface](#api-surface)
- [SSE event protocol](#sse-event-protocol)
- [LLM providers and fallback](#llm-providers-and-fallback)
- [Tool registry](#tool-registry)
- [Workflows (YAML)](#workflows-yaml)
- [Moderation](#moderation)
- [Persistence and audit trail](#persistence-and-audit-trail)
- [Configuration](#configuration)
- [Local development](#local-development)
- [Testing](#testing)
- [Deployment notes](#deployment-notes)
- [Extending the system](#extending-the-system)

---

## Goals

1. **One conversational surface, many tools.** A single chat endpoint can
   plan, call any registered tool, stream tokens, and persist the audit
   trail.
2. **Provider-agnostic LLM layer.** Groq is the default planner; OpenAI,
   Anthropic, and self-hosted Ollama are drop-in fallbacks.
3. **Production-ready streaming.** Token-by-token SSE with heartbeats,
   rate limiting, moderation, and tool-execution timeouts.
4. **Composable workflows.** Multi-step content pipelines defined in YAML
   ship out of the box (blog from research, social amplification, study
   pack) and stream live progress events.
5. **Auditable.** Every model call, tool call, and outcome is persisted in
   `AgentRun` / `AgentRunStep` for replay and analytics.

---

## High-level architecture

```
                   ┌────────────────────────────────────────┐
   Browser ──────► │  POST /api/agents/stream/   (SSE out) │
                   └──────────────────┬─────────────────────┘
                                      │
                          ┌───────────▼────────────┐
                          │   AgentChatStreamView  │  (DRF APIView)
                          └───────────┬────────────┘
                                      │
                       ┌──────────────▼─────────────┐
                       │        AgentRunner         │
                       │  (services/runner.py)      │
                       │                            │
                       │  1. moderation gate        │
                       │  2. compose system+history │
                       │  3. call LLMRouter         │
                       │  4. execute tools          │
                       │  5. emit events / persist  │
                       └─┬───────┬───────┬──────────┘
                         │       │       │
            ┌────────────▼┐ ┌────▼───┐ ┌─▼──────────┐
            │ LLMRouter   │ │Registry│ │ Models /   │
            │ (llm.py)    │ │(tool   │ │ DB         │
            │ groq→openai │ │ list)  │ │ Conversation│
            │ →anthropic  │ │        │ │ Message    │
            │ →ollama     │ │        │ │ AgentRun   │
            └─────┬───────┘ └────────┘ └────────────┘
                  │
       ┌──────────┴──────────┐
       │   Tool handlers     │
       │ (existing AIService │
       │   functions wrapped │
       │   as AgentTools)    │
       └─────────────────────┘
```

The frontend (`useAgentChat`) consumes the SSE event stream, applies events
to a reducer, and renders messages, in-flight tool cards, and live tokens.

---

## Backend layout

| Path | Responsibility |
|------|----------------|
| `backend/agents/apps.py` | Django app config; lazy-loads `tool_bindings` on `ready()` |
| `backend/agents/models.py` | `Conversation`, `Message`, `AgentRun`, `AgentRunStep`, `Workflow`, `WorkflowRun`, `OutputRating` |
| `backend/agents/registry.py` | Thread-safe `ToolRegistry` singleton + `AgentTool` dataclass + `register_tool` decorator |
| `backend/agents/llm.py` | `LLMRouter`, `GroqProvider`, `OpenAIProvider`, `AnthropicProvider`, `OllamaProvider`, `estimate_cost_usd` |
| `backend/agents/tool_bindings.py` | Registers each `AIService` method as an `AgentTool` (paraphrase, grammar, summarize, essay, research, …) |
| `backend/agents/services/runner.py` | Function-calling planner; orchestrates tools, streams events, persists run |
| `backend/agents/services/workflow_runner.py` | Loads YAML pipelines, runs them step-by-step, streams progress |
| `backend/agents/services/streaming.py` | SSE encoder, heartbeat generator, error-safe wrapper |
| `backend/agents/services/moderation.py` | Heuristic keyword check + prompt-injection regexes (+ optional OpenAI Moderation) |
| `backend/agents/views.py` | DRF `ConversationViewSet`, `AgentChatStreamView`, `WorkflowViewSet` (with `run/`), `AgentRunViewSet`, `OutputRatingViewSet`, `ToolCatalogueView` |
| `backend/agents/serializers.py` | Conversation/Message/AgentRun/Workflow/Rating serializers + request payload schemas |
| `backend/agents/permissions.py` | `IsConversationOwner`, `IsRunOwner`, `IsWorkflowAccessible` |
| `backend/agents/throttles.py` | `AgentChatThrottle`, `WorkflowRunThrottle` (DRF `UserRateThrottle` subclasses) |
| `backend/agents/admin.py` | Django admin registration for all models |
| `backend/agents/tasks.py` | Celery tasks: `cleanup_stale_conversations`, `run_workflow_async` |
| `backend/agents/workflows/*.yaml` | Built-in YAML pipelines |
| `backend/agents/tests/` | 33 pytest tests covering registry, runner, moderation, workflow, LLM, REST |

---

## Frontend layout

| Path | Responsibility |
|------|----------------|
| `frontend/src/services/agents.ts` | Typed REST client + `streamChat` / `streamWorkflow` SSE helpers |
| `frontend/src/hooks/useAgentChat.ts` | Reducer hook that drives the streaming UX (state machine: `idle → connecting → streaming → thinking → idle`) |
| `frontend/src/components/ChatBot.tsx` | Floating widget (bottom-right) — chat + history sidebar |
| `frontend/src/pages/AgentPage.tsx` | Full-screen agent workspace at `/agent` (3-column layout: conversations / chat / tools+run) |

All routes in `App.tsx` are now `React.lazy()`-loaded behind a `<Suspense>`
boundary for snappy initial paint.

---

## API surface

All endpoints are mounted under `/api/agents/`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/conversations/` | List the user's conversations (`?archived=true` to filter) |
| `POST` | `/conversations/` | Manually create a conversation (rare; usually auto-created on first message) |
| `GET` | `/conversations/{id}/` | Detail with full message history |
| `PATCH` | `/conversations/{id}/` | Rename or archive |
| `DELETE` | `/conversations/{id}/` | Delete conversation + cascade |
| `GET` | `/conversations/{id}/runs/` | List runs for a conversation |
| `POST` | `/stream/` | **Stream chat (SSE)** — body `{message, conversation_id?, title?}` |
| `GET` | `/runs/` | List user's runs |
| `GET` | `/runs/{id}/` | Run detail with steps |
| `GET` | `/tools/` | Tool catalogue (premium gating respected) |
| `GET` | `/workflows/` | List built-in + user workflows |
| `GET` | `/workflows/{slug}/` | Workflow detail |
| `POST` | `/workflows/{slug}/run/` | **Run workflow (SSE)** — body `{inputs}` |
| `POST` | `/workflows/sync_builtin/` | (Admin only) Sync YAML files into DB |
| `GET` | `/workflow-runs/` | List user's workflow runs |
| `GET` | `/workflow-runs/{id}/` | Workflow run detail |
| `POST` | `/ratings/` | Submit feedback (`message` or `workflow_run`, plus rating 1–5) |

All endpoints require `Authorization: Bearer <jwt>`. Streaming endpoints use
the dedicated `agent_chat` and `agent_workflow` throttle scopes.

---

## SSE event protocol

The streaming endpoints emit `text/event-stream` frames, each containing a
JSON envelope:

```json
{"type": "<event-type>", "data": {...}}
```

### Chat events

| `type` | When | `data` shape |
|--------|------|--------------|
| `conversation` | Once at the start | `{id, title}` |
| `run_start` | Run row created | `{run_id, conversation_id, user_message_id}` |
| `message_start` | Beginning of a model turn | `{step}` |
| `token` | Each LLM delta | `{delta}` |
| `message_end` | End of a model turn | `{message_id, has_tool_calls}` |
| `tool_call` | Model decided to call a tool | `{id, name, arguments}` |
| `tool_result` | Tool finished | `{id, name, result, duration_ms, error}` |
| `done` | Run complete | `{status, run_id, final_output, prompt_tokens, completion_tokens, cost_usd, steps}` |
| `error` | Fatal | `{message, category?}` |

Heartbeats `: ping` are sent every ~15 s to keep the connection alive
through proxies.

### Workflow events

| `type` | When | `data` shape |
|--------|------|--------------|
| `workflow_start` | Run begins | `{run_id, workflow_slug, inputs}` |
| `workflow_step_start` | Each step | `{index, name, tool}` |
| `workflow_step_end` | Each step | `{index, name, output, duration_ms}` |
| `workflow_end` | Done | `{status, final_output, total_cost_usd}` |
| `error` | Fatal | `{message}` |

---

## LLM providers and fallback

`agents.llm.LLMRouter` builds an ordered chain from settings:

```python
AGENTS_DEFAULT_PROVIDER  = 'groq'          # primary
AGENTS_FALLBACK_PROVIDERS = 'openai,anthropic,ollama'
```

For each chat or stream call the router tries the primary first and falls
back through the chain on `LLMError`. Each provider implements:

- `chat(messages, tools, tool_choice, temperature, max_tokens)` → `LLMResponse`
- `stream_chat(...)` → iterator of `LLMStreamEvent`

`estimate_cost_usd(provider, model, prompt_tokens, completion_tokens)` returns
a `Decimal` cost; rates ship in a small per-model table that can be
overridden at deploy time via env vars.

Add a new provider by subclassing `BaseLLMProvider`, implementing the two
methods, and registering it in `LLMRouter._build_provider`.

---

## Tool registry

```python
from agents.registry import register_tool, ToolContext

@register_tool(
    name='paraphrase_text',
    description='Rewrite text in a different style.',
    parameters={
        'type': 'object',
        'properties': {
            'text': {'type': 'string'},
            'mode': {'type': 'string', 'enum': ['standard', 'formal', 'creative']},
        },
        'required': ['text'],
    },
    category='writing',
    is_premium=False,
    timeout_s=30,
)
def paraphrase_text(text: str, mode: str = 'standard', ctx: ToolContext = None):
    return AIService().paraphrase(text, mode=mode)
```

- Tools are stored in a thread-safe singleton (`agents.registry.registry`).
- `ToolContext` is injected into handlers that declare a `ctx` parameter,
  giving them the caller `user`, `conversation_id`, `run_id`.
- The runner generates OpenAI-style JSON schemas (`to_openai_function()`)
  and passes them on every model call.
- Premium tools are filtered out for free-tier users automatically.

The full list of pre-registered tools lives in
`backend/agents/tool_bindings.py` and includes paraphrase, grammar, essay,
research, summarisation, translation, tone analysis, citations, flashcards,
quiz, outlines, social posts, SEO meta, plagiarism check, code generation,
and more.

---

## Workflows (YAML)

Workflows are deterministic multi-step pipelines that consume named inputs
and produce a final output by chaining tools.

Example: `backend/agents/workflows/blog_from_research.yaml`

```yaml
slug: blog-from-research
name: Blog from research
description: Research a topic, build an outline, write a 600-word post,
             generate a SEO meta description.
category: writing
inputs:
  type: object
  properties:
    topic:
      type: string
      description: The blog post topic.
  required: [topic]
steps:
  - name: Research the topic
    tool: research_topic
    args:
      query: "{{ inputs.topic }}"
    output: research

  - name: Build an outline
    tool: generate_outline
    args:
      topic: "{{ inputs.topic }}"
      context: "{{ steps.research.output }}"
    output: outline

  - name: Write the post
    tool: generate_essay
    args:
      topic: "{{ inputs.topic }}"
      outline: "{{ steps.outline.output }}"
      length: 'medium'
    output: post

  - name: Meta description
    tool: generate_meta_description
    args:
      content: "{{ steps.post.output }}"
    output: meta

output_template: |
  # {{ inputs.topic }}

  {{ steps.post.output }}

  ---
  **Meta:** {{ steps.meta.output }}
```

Templates use `{{ inputs.<key> }}` and `{{ steps.<name>.output }}`.
`workflow_runner.py` resolves them, runs each tool sequentially with a
timeout, and emits SSE progress events.

---

## Moderation

`agents.services.moderation` provides:

- `heuristic_check(text)` — keyword block list (violence, hate, etc.).
- `detect_prompt_injection(text)` — regex for "ignore previous", "system
  prompt", etc. The runner doesn't refuse but adds a hardening note.
- `_openai_moderation(text)` — optional, gated by `AGENTS_USE_OPENAI_MODERATION=true`
  and an `OPENAI_API_KEY`.

`moderate_input` runs them in order with **fail-open** semantics on
external errors so a Moderation outage never silently breaks chat.

If a request is flagged, the runner short-circuits with an `error` event
followed by `done` with `status='blocked'`, and **no messages are
persisted**.

---

## Persistence and audit trail

| Model | Purpose |
|-------|---------|
| `Conversation` | Belongs to a user, has many `Message`s, can be archived |
| `Message` | `role` ∈ `{system,user,assistant,tool}`; tracks tokens, cost, provider, model, tool_calls JSON |
| `AgentRun` | One per user turn; aggregates totals and final output |
| `AgentRunStep` | Either an `llm` step (tokens / cost) or a `tool_call` step (args + result + duration + error) |
| `Workflow` | Built-in (from YAML) or user-defined; cached schema + steps |
| `WorkflowRun` | Inputs, outputs, cost, status |
| `OutputRating` | 1–5 stars + optional comment, on either a `Message` or a `WorkflowRun` |

Indexes are placed on `(user, last_message_at)` for sidebar listing and on
`(conversation, created_at)` for replays.

---

## Configuration

`backend/core/settings.py` exposes:

```python
AGENTS_DEFAULT_PROVIDER       = env('AGENTS_DEFAULT_PROVIDER', default='groq')
AGENTS_PLANNER_MODEL          = env('AGENTS_PLANNER_MODEL',
                                    default='llama-3.3-70b-versatile')
AGENTS_MAX_STEPS              = int(env('AGENTS_MAX_STEPS', default='6'))
AGENTS_TOOL_TIMEOUT           = int(env('AGENTS_TOOL_TIMEOUT', default='45'))
AGENTS_FALLBACK_PROVIDERS     = env('AGENTS_FALLBACK_PROVIDERS',
                                    default='openai,anthropic,ollama').split(',')
AGENTS_ENABLE_MODERATION      = env('AGENTS_ENABLE_MODERATION', default='true') == 'true'
AGENTS_FREE_TIER_DAILY_LIMIT  = int(env('AGENTS_FREE_TIER_DAILY_LIMIT', default='30'))
AGENTS_PRO_TIER_DAILY_LIMIT   = int(env('AGENTS_PRO_TIER_DAILY_LIMIT', default='1000'))
```

Throttles (in `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`):

```
agent_chat:     30/minute      (also enforced at nginx with limit_req_zone=agents:10m)
agent_workflow: 10/minute
```

Nginx already exposes a long-lived SSE-friendly location for
`/api/agents/stream/` with `proxy_buffering off` and
`X-Accel-Buffering: no`.

---

## Local development

### 1. Prerequisites
- Python 3.10+, Node 18+, PostgreSQL or SQLite, Redis.

### 2. Install
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python init_db.py     # seeds the 30 tools

cd ../frontend
npm install
```

### 3. Environment
Copy `.env.example` → `.env` and fill in at minimum:

```
DJANGO_SECRET_KEY=...
DATABASE_URL=postgres://user:pass@localhost:5432/sovereign
REDIS_URL=redis://localhost:6379/0
GROQ_API_KEY=gsk_...
```

Optional fallback / advanced:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
AGENTS_DEFAULT_PROVIDER=groq
AGENTS_FALLBACK_PROVIDERS=openai,anthropic,ollama
AGENTS_ENABLE_MODERATION=true
SENTRY_DSN=...
```

Frontend `.env`:
```
REACT_APP_API_URL=http://localhost:8000/api
```

### 4. Run
```bash
# In separate terminals
cd backend && python manage.py runserver
cd backend && celery -A core worker -l info
cd backend && celery -A core beat -l info
cd frontend && npm start
```

### 5. Smoke test the agent
1. Sign in → open `/agent`.
2. Type "Paraphrase: The quick brown fox jumps over the lazy dog."
3. You should see `connecting` → `streaming` tokens → `idle`.
4. Inspect `Run` panel on the right for token usage / cost.

### 6. Common issues
- **`KeyError: 'agent_chat'` on test runs** — ensure the
  `agent_chat` and `agent_workflow` rates are present in
  `core/test_settings.py` (already configured).
- **SSE stalls behind a corporate proxy** — confirm nginx is sending
  `X-Accel-Buffering: no` and not gzipping the stream.
- **`LLMError: rate_limited`** — verify `GROQ_API_KEY` and that the
  fallback chain has at least one valid provider.
- **Tool times out** — bump `AGENTS_TOOL_TIMEOUT` or the per-tool
  `timeout_s` in the registration.

---

## Testing

### Backend (33 agent tests + 319 platform tests)

```bash
cd backend
DJANGO_SETTINGS_MODULE=core.test_settings pytest -q
```

Targeted:

```bash
DJANGO_SETTINGS_MODULE=core.test_settings pytest agents/tests -q
```

Coverage includes:
- `test_registry.py` — tool registration, lookup, OpenAI schema, premium filtering.
- `test_runner.py` — simple completion, tool-call loop, premium gating, unknown tool, max-steps safeguard, moderation block.
- `test_moderation.py` — keyword + injection detection.
- `test_workflow.py` — template rendering, step execution, unknown tool, builtin discovery.
- `test_views.py` — Conversation CRUD, tool catalogue, streaming endpoint frames, run audit, ratings.
- `test_llm.py` — router fallback chain, cost estimation.

### Frontend

```bash
cd frontend
CI=true npx react-scripts test --watchAll=false --testPathPattern="agents.test|useAgentChat"
```

Covers the SSE parser (split chunks, comments, errors, abort) and the
`useAgentChat` reducer (token streaming, tool round-trips, error states).

### Validation checklist before deploy

- [ ] `pytest -q` (backend) green.
- [ ] `npx react-scripts build` (frontend) green.
- [ ] `/api/agents/stream/` returns events with valid JWT.
- [ ] `/api/agents/workflows/blog-from-research/run/` streams progress with valid inputs.
- [ ] `/api/agents/tools/` lists at least the registered tools.
- [ ] Free user does not see premium tools in catalogue.
- [ ] Moderation: send a flagged input → returns `done` with `status=blocked`, no DB messages.
- [ ] Cancel mid-stream from the UI → `cancel()` aborts; backend `AgentRun.status='failed'` with abort error.
- [ ] Sentry receives traces (if `SENTRY_DSN` set).

---

## Deployment notes

- **Workers**: prefer at least 2 gunicorn workers with `--threads >= 4` and
  `--timeout 120` for SSE. The provided Dockerfile honors
  `GUNICORN_WORKERS`, `GUNICORN_THREADS`, and `GUNICORN_TIMEOUT`.
- **Nginx**: keep the dedicated `/api/agents/stream/` location with
  `proxy_buffering off`, `proxy_cache off`, `proxy_http_version 1.1`,
  `Connection ""` and a 5-minute read timeout.
- **Celery beat**: includes `agents-cleanup-stale-conversations` (daily) to
  archive idle conversations older than 90 days. Tune in
  `core/celery.py`.
- **Sync workflows on deploy**:
  ```bash
  python manage.py shell -c "from agents.services.workflow_runner import sync_builtin_workflows; sync_builtin_workflows()"
  ```
  or trigger `POST /api/agents/workflows/sync_builtin/` as an admin.

---

## Extending the system

### Add a new tool
1. Implement the function (likely as a method on `tools.AIService`).
2. Register it in `agents/tool_bindings.py` with `@register_tool(...)`.
3. Add a unit test in `agents/tests/test_registry.py` if it needs custom
   parameter coercion or premium gating.
4. (Optional) Reference it in a new YAML workflow.

### Add a new workflow
1. Drop a YAML file into `backend/agents/workflows/`.
2. Run `sync_builtin_workflows()` (or the admin endpoint).
3. Hit `POST /api/agents/workflows/<slug>/run/`.

### Add a new LLM provider
1. Subclass `BaseLLMProvider` in `agents/llm.py`.
2. Implement `chat` and `stream_chat`.
3. Register the class name in `LLMRouter._build_provider`.
4. Add cost rates in `_PRICE_TABLE`.
5. Set `AGENTS_FALLBACK_PROVIDERS=...,my_provider`.

### Add a new front-end surface
- Anything you build with `useAgentChat` will inherit streaming, cancel,
  conversation persistence, tool rendering, and error handling for free.
- For workflow UIs, use `agentsService.streamWorkflow({slug, inputs})`
  with the same handler shape (`onEvent`, `onError`, `onComplete`).

---

Need help? Open an issue at
<https://github.com/etisamhaq/Sovereign-AI-Tools/issues> or email
support@sovereign.com.
