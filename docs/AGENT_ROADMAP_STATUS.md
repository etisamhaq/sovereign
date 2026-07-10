# Agent Platform Roadmap Status (Mar 27, 2026)

This document tracks implementation against the committed roadmap.

## Phase 1 (MVP, 6–8 weeks)

### 1) Agent builder basic form + template system

Status: **Partially complete**

Implemented:

- Backend custom template APIs (`POST/PATCH/DELETE /api/agents/templates/`)
- Template validation for workflow step keys and structure
- Frontend basic custom-template builder form added on Agents page

Remaining:

- Richer guided form (step type selectors, schema helpers, validation UX)
- Versioning workflow UX (clone/new version)

### 2) Run engine + approvals + run logs

Status: **Complete for MVP**

Implemented:

- Async run creation + execution
- Approval-gated steps with approve/reject flows
- Run detail timeline and status tracking
- Runtime guardrails (timeout, max-steps, cancellation checks)

### 3) 5–8 connectors

Status: **MVP baseline complete, hardening pending**

Implemented:

- Connector account framework with encrypted tokens
- Providers available: hubspot, pipedrive, gmail, outlook, google_calendar, custom_api
- External idempotent action records

Remaining:

- Real provider OAuth exchange/refresh implementations per connector
- Connector health/sync status UX

### 4) Scheduler + webhooks

Status: **Complete for MVP**

Implemented:

- Trigger model + CRUD APIs
- Webhook invoke endpoint + secret support + rotate secret
- Scheduled trigger scanner task
- Celery beat wiring for scheduled scans
- Frontend trigger creation/listing UI in Agents page

### 5) Basic billing meters

Status: **Complete for MVP baseline**

Implemented:

- Agent run metrics (tokens/cost estimates)
- Idempotent usage credit metering to `payments.UsageQuota` on terminal run completion
- Dashboard shows aggregate usage/cost signals

Remaining:

- Billing-facing dashboard card integration in Payments UI
- Tier-aware token/step rate limits

## Phase 2 (Scale + reliability, 8–12 weeks)

### Visual workflow builder (drag/drop)

Status: **Complete for current Phase 2 scope**

- Drag/drop step ordering shipped in Agents UI
- Live JSON definition editor shipped
- Save-as-new and update-selected template UX shipped
- Step-level schema controls shipped in builder (type/action/provider/input/source/config/requires_approval)
- Template diff summary shipped (added/removed/changed/reordered)
- Version bump UX shipped for template update

Remaining:

- Collaborative live-edit locking UX for concurrent edits

### Better RAG memory + personalization

Status: **Complete for current Phase 2 scope**

- RAG-backed memory retrieval integrated into workflow run context
- LLM prompt enrichment now includes retrieved memory snippets
- Semantic/vector retrieval and relevance ranking implemented

Remaining:

- Per-template memory policies and retrieval scoring controls

### Connector auth hardening

Status: **Complete for current Phase 2 scope**

- Encryption and connector framework done
- OAuth/token health checks and expiry handling task added
- Provider-specific OAuth refresh handlers implemented for google/gmail, hubspot, pipedrive, and outlook

Remaining:

- Connector reauth wizard UX polish

### Observability dashboards + alerts

Status: **Complete for current Phase 2 scope**

- Basic agent dashboard and run logs done
- Reliability alerting implemented for failed-run-ratio + trigger dispatch failures + stalled schedules
- Notification channels implemented (email + webhook)
- SLO dashboard API/UX implemented (success-rate target, error budget, p95, MTTR, alert delivery, uptime trend)
- Trace correlation dashboard API implemented (`/api/agents/dashboard/traces/`)
- Slack notification channel delivery implemented

Remaining:

- Frontend trace explorer and cross-run drill-down UX polish

## Phase 3 (12+ weeks)

### Multi-agent orchestration

Status: **Complete for current Phase 3 scope**

Implemented:

- Orchestration job model and step graph execution lifecycle
- Asynchronous orchestration execute API and task runner
- Step-to-run linkage and failure alert propagation

### Public marketplace + monetization

Status: **Complete for current Phase 3 scope**

Implemented:

- Agent marketplace listing publish/list endpoints
- Marketplace purchase flow with owned-template clone creation
- Install counters and purchase tracking records

### Enterprise controls (RBAC, SSO, policy engine)

Status: **Complete for current Phase 3 scope**

Implemented:

- Workspace model with role-based memberships (owner/admin/editor/viewer)
- Policy engine with workspace-scoped policy rules
- Policy enforcement on template create/update (`max_steps_per_template`)

## Priority Order Progress

1. Agent definition + execution + monitoring — **Mostly complete (MVP)**
2. Trigger/action workflow engine — **Complete (MVP)**
3. Connector/auth framework — **Complete for current Phase 2 scope**
4. Memory/RAG — **Complete for current Phase 2 scope**
5. Billing meters — **Baseline complete**
6. Marketplace — **Complete for current Phase 3 scope**
7. Multi-agent delegation — **Complete for current Phase 3 scope**

## Next Implementation Slice (immediate)

- Add SSO provider integrations (OIDC/SAML) and org-level audit exports
- Add marketplace payment settlement integration and revenue analytics
- Add orchestration DAG branching/condition nodes and human-in-loop branch approvals
