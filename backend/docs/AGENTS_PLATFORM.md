# Agents Platform (Production Architecture)

This document describes the new `agents` domain added to Sovereign.


## Stack

- Django + DRF APIs
- Celery async execution
- LangGraph orchestration (with safe sequential fallback)
- Existing Sovereign AI services and tool integrations
- Connector token encryption via Fernet (`cryptography`)


## Data Model

Tables:

- `agent_workflow_templates`
- `agent_workflow_runs`
- `agent_workflow_step_runs`
- `agent_workflow_approvals`
- `agent_memories`
- `agent_run_metrics`
- `agent_connector_accounts`
- `agent_external_actions`
- `agent_reliability_alerts`
- `agent_workspaces`
- `agent_workspace_memberships`
- `agent_policy_rules`
- `agent_orchestration_jobs`
- `agent_orchestration_job_steps`
- `agent_marketplace_listings`
- `agent_marketplace_purchases`


## API Surface

Base prefix: `/api/agents/`

- `GET /templates/`
- `POST /templates/` (create custom template)
- `GET /templates/<slug>/`
- `PATCH /templates/<slug>/` (edit owned template)
- `DELETE /templates/<slug>/` (soft-delete owned template)
- `GET /templates/<slug>/versions/`
- `POST /templates/<slug>/rollback/<version_number>/`
- `GET /runs/`
- `POST /runs/`
- `GET /runs/<id>/`
- `POST /runs/<run_id>/cancel/`
- `GET /approvals/`
- `POST /approvals/<approval_id>/approve/`
- `POST /approvals/<approval_id>/reject/`
- `GET /memory/`
- `POST /memory/`
- `GET/PATCH/DELETE /memory/<id>/`
- `GET /connectors/`
- `POST /connectors/`
- `DELETE /connectors/<id>/`
- `GET /triggers/`
- `POST /triggers/` (webhook/schedule trigger)
- `PATCH /triggers/<id>/`
- `DELETE /triggers/<id>/`
- `POST /triggers/<id>/rotate-secret/`
- `POST /hooks/<webhook_key>/` (public trigger invoke)
- `GET /alerts/`
- `POST /alerts/<id>/resolve/`
- `GET /dashboard/`
- `GET /dashboard/slo/`
- `GET /dashboard/traces/`
- `GET /workspaces/`
- `POST /workspaces/`
- `GET /workspaces/<workspace_slug>/members/`
- `POST /workspaces/<workspace_slug>/members/`
- `GET /workspaces/<workspace_slug>/policies/`
- `POST /workspaces/<workspace_slug>/policies/`
- `GET /orchestrations/`
- `POST /orchestrations/`
- `GET /orchestrations/<id>/`
- `POST /orchestrations/<id>/execute/`
- `GET /marketplace/listings/`
- `POST /marketplace/listings/`
- `POST /marketplace/listings/<id>/purchase/`


## Default Templates

Seeded templates:

1. Content Repurposing Agent
2. Revenue Ops Follow-up Agent
3. SEO Execution Agent


## Operational Notes

- Workflow runs are started asynchronously via `execute_agent_workflow_run` Celery task.
- Scheduled triggers are dispatched by `scan_scheduled_agent_triggers` via Celery Beat.
- Connector token/OAuth health is checked by `check_agent_connector_health`.
- Reliability alert evaluator runs via `evaluate_agent_reliability_alerts`.
- Provider-specific OAuth refresh handlers are supported for `gmail`, `google_calendar`, `hubspot`, `pipedrive`, and `outlook`.
- Workspace RBAC roles: `owner`, `admin`, `editor`, `viewer`.
- Workspace-scoped policy rules can enforce controls such as `max_steps_per_template`.
- Multi-agent orchestration jobs can run chained template steps through `execute_agent_orchestration_job`.
- Marketplace purchase clones published templates into buyer-owned private templates.
- Approval-gated steps set run status to `waiting_approval`.
- Approval triggers resume task `resume_agent_workflow_after_approval`.
- All external actions are idempotent via `idempotency_key`.
- Connector tokens are encrypted at rest.
- Trigger automation supports webhook and schedule patterns.
- Basic billing meter: each terminal run records one usage credit in `payments.UsageQuota` (idempotent per run).
- Template update supports optional version bump via `PATCH /templates/<slug>/?bump_version=true`.
- Template snapshots are stored for version history and rollback APIs.
- Template definition validation enforces advanced step contracts:
  - required `key`, `type`, `action`
  - unique step keys
  - `input_from` references only prior steps
  - `api_call` requires supported `provider`
  - `approval` requires `action=approval_checkpoint` and `requires_approval=true`
- RAG-backed memory retrieval uses semantic/vector ranking (hashed vector cosine + lexical overlap) and is injected into run context + LLM prompts from active `AgentMemory` records.
- Reliability notifications can be sent over email, webhook, and optional Slack webhook channels for open alerts.
- SLO dashboard endpoint reports success-rate SLO, error budget remaining, p95 latency, MTTR, open critical alerts, notification delivery rate, and 7-day uptime trend.
- Trace dashboard endpoint returns run-to-trigger/orchestration correlation data and external action counts for debugging.
- Guardrails enforced at runtime:
  - max steps per workflow via `AGENT_MAX_STEPS_PER_RUN`
  - per-run timeout via `AGENT_DEFAULT_TIMEOUT_SECONDS` (optional smaller per-run override with `input_payload_json.timeout_seconds`)
  - mid-run cancellation is respected before each step execution.
