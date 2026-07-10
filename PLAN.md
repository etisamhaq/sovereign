# Sovereign — AMD Hackathon Act II (Track 3 / Unicorn) Plan

## 1. The product
**Sovereign** — a self-hosted Compliance & Document Audit Agent.

**One-line pitch:** "Regulated teams can't send confidential contracts and policies to OpenAI.
Sovereign runs a powerful audit agent *entirely on your own AMD Instinct GPUs via
ROCm* — your data never leaves your infrastructure."

**Why it wins Track 3 (mapped to judging pillars):**
1. **Uniqueness** — agentic, multi-step compliance reasoning, not a single prompt.
2. **Startup vision** — clear market (legal/health/finance), real buyer pain (data privacy + audit cost).
3. **Completeness** — full flow: upload → agent audit → cited risk report → export. Reuses the existing platform infra so it's polished.
4. **Meaningful AMD use** — open model self-hosted on AMD ROCm is *the value prop*, with a live
   Fireworks-vs-AMD toggle in the demo. Uses all three credited techs (AMD Cloud, ROCm, Fireworks).

## 1b. MAJOR UPDATE — the `agents` app is already a full agentic system
The `etisam` branch (copied into this repo) is NOT an empty scaffold. It already ships a
production-grade agent stack. This radically de-risks the build — we *extend*, not *build*:

- **`backend/agents/llm.py`** — multi-provider LLM abstraction (`BaseLLMProvider`) with
  OpenAI-compatible tool-calling, streaming, fallback chains, and cost tracking.
  "Adding a provider is a one-class change." → AMD vLLM + Fireworks = ~2 small classes.
  Provider selected via `AGENTS_DEFAULT_PROVIDER` / `AGENTS_FALLBACK_PROVIDERS` settings.
- **`backend/agents/`** — `registry.py`, `pool.py`, `tool_bindings.py`, `services/tool_registry.py`
  (agent + tool definitions), `services/runner.py` (the agent loop), `services/streaming.py`.
- **`backend/agents/services/workflow_engine.py` + `workflow_runner.py`** — multi-step workflow
  orchestration, with YAML workflows in `agents/workflows/` (e.g. `blog_from_research.yaml`).
- **`services/memory_retrieval.py`** (RAG), `connectors.py`, `moderation.py`, `crypto.py`,
  `oauth_refresh.py` — retrieval, integrations, guardrails.
- **`backend/solutions/`** + frontend `pages/agents/` (marketplace) & `pages/solutions/` — UI already exists.
- Test suites under `agents/tests/`.

## 2. Architecture (extend the existing agent stack)
```
Frontend (React) ── /api/agents/... ──► Django agents app
                                              │
                              ┌───────────────┼────────────────┐
                              ▼               ▼                ▼
                        Doc ingest      runner + workflow   llm.py providers
                        (parse/chunk)   engine (EXISTING)   (BaseLLMProvider)
                                         + compliance         ├─ AMD vLLM/ROCm (NEW, private)
                                         workflow (NEW)       ├─ Fireworks AI  (NEW, fast)
                                                              └─ Groq          (EXISTING fallback)
```

### Reuse (already built — just rebranded to Sovereign)
- Full agents app: llm abstraction, runner, workflow engine, tool registry, RAG, streaming.
- Auth (JWT), Polar payments, Docker Compose + nginx, CI/CD.
- `ToolInput`/`ToolOutput` React components + existing agent/solutions pages.

### New code (the hackathon delta)
- **Providers in `agents/llm.py`:** `AMDvLLMProvider` (OpenAI-compatible ROCm endpoint) +
  `FireworksProvider`. Register in the provider map; wire settings.
- **Compliance audit capability:** a `compliance_audit.yaml` workflow (or agent + tools) that
  runs doc → retrieve → check-vs-ruleset → cited risk report, using the existing runner.
- **Rulesets:** `agents/rulesets/` rule packs (GDPR, HIPAA, SOC2 starter) + a checker tool binding.
- **Doc ingest:** PDF/DOCX/text → chunks (reuse research module retrieval where possible).
- **Frontend:** an audit page + a provider toggle (AMD-private vs Fireworks-fast) + report view.

## 3. AMD infra (the riskiest part — de-risk first)
- **Private path:** serve an open model (Llama-3.x-8B-Instruct or Qwen2.5) on AMD Developer Cloud
  Instinct GPU via **vLLM with ROCm**, exposing the OpenAI-compatible `/v1/chat/completions`.
- **Fast path:** Fireworks AI API (same OpenAI-compatible interface).
- **Fallback:** Groq (already wired) so dev works even before AMD cloud is up.
- Provider chosen per-request via a `provider` field; demo toggles to show privacy/latency tradeoff.

## 4. Timeline

### Prep (now → Jul 6) — no clock penalty
- [ ] P1. Register: AMD AI Developer Program + lablab.ai team page for Act II. Claim credits
      (AMD cloud $100, Fireworks $50, DeepLearning.AI Pro).
- [ ] P2. **De-risk AMD Cloud:** spin up an Instinct GPU instance, serve a model with vLLM/ROCm,
      hit `/v1/chat/completions` with curl. This is the single biggest unknown — prove it now.
- [ ] P3. Add `AMDvLLMProvider` + `FireworksProvider` classes to `agents/llm.py` (provider layer
      already exists — this is a one-class-each change). Wire `AGENTS_DEFAULT_PROVIDER` /
      `AGENTS_FALLBACK_PROVIDERS` settings. Verify against existing `agents/tests/test_llm.py`.
- [ ] P4. Build the compliance-audit capability on the EXISTING runner/workflow engine
      (a `compliance_audit` workflow + ruleset tool). Test against Groq/Fireworks (no AMD dep yet).
- [ ] P5. Draft the pitch narrative + slide skeleton + demo script.

### Build window (Jul 6 → Jul 11)
- [ ] B1. Wire provider layer to live AMD vLLM endpoint + Fireworks; the toggle.
- [ ] B2. Doc ingest pipeline (PDF/DOCX/text → chunks).
- [ ] B3. Audit agent loop + 1–2 polished rulesets (GDPR + HIPAA or SOC2).
- [ ] B4. Risk report generation (cited findings, severity) + export reuse.
- [ ] B5. Frontend audit page + provider toggle + report view.
- [ ] B6. Containerize the new service into existing docker-compose; smoke test full stack.
- [ ] B7. Polish, seed demo docs, record demo video, finalize slides + repo README, submit on lablab.

## 5. Open questions / decisions to lock before B-day
- Which open model fits the AMD GPU tier we get (8B vs larger)?
- Which 1–2 regulations to ship deeply (recommend GDPR + HIPAA for the privacy narrative).
- How much of the existing 30-tool UI to hide vs keep behind the flagship.
```
