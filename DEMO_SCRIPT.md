# Sovereign — Demo Script (~3 min)

A tight walkthrough for a screen-recorded demo video or a live pitch. Times are targets.

**Before recording**
- Log in on the live app (or local) so you're at the dashboard. Have the sample document ready (it's built into the audit page via **Load sample**).
- Optional (for the live AMD moment): have an AMD Developer Cloud vLLM endpoint running and `AMD_VLLM_BASE_URL` set, so the **AMD** toggle works end-to-end. If not, demo on **Fireworks** and narrate the AMD path (see the note at the end).

---

## 0:00 — Hook (15s)
> "Legal and healthcare teams can't paste confidential contracts into ChatGPT — it's a compliance violation in itself. So the people who most need AI review can't use it. Sovereign fixes that: it audits your documents against GDPR, HIPAA, and SOC 2 — running on your *own* AMD GPUs, so nothing ever leaves your infrastructure."

_On screen: the landing page — "Audit compliance without leaking your data."_

## 0:15 — The problem, briefly (15s)
> "Compliance review is manual and expensive, and the obvious fix — an LLM API — is off-limits when the document is confidential."

_Scroll the homepage: the problem/solution and the AMD-private line._

## 0:30 — Open the auditor (10s)
- Click **Compliance** in the nav.
> "Here's the audit workspace."

## 0:40 — Load a document + pick framework (15s)
- Click **Load sample** (a realistic privacy policy appears).
- Select **GDPR**.
> "I'll audit this privacy policy against GDPR. It also supports HIPAA and SOC 2."

## 0:55 — The provider toggle — the key moment (20s)
- Point at the provider toggle: **AMD Instinct (private) · Fireworks (fast) · Auto**.
> "This is the important part. I can run the exact same audit two ways. **Fireworks** for speed — but the document leaves my network. Or **AMD Instinct**, where an open model runs on my own GPUs and the document *never* leaves. Same audit, my choice."
- Select the provider you'll run (AMD if live; otherwise Fireworks).

## 1:15 — Run the audit (20s)
- Click **Run compliance audit**. Let it stream/return.
> "The agent checks every GDPR obligation against the document."

## 1:35 — Read the result (40s)
- Point to the **risk score** and **status counts**.
> "High risk — 6 of 7 checks flagged."
- Open a critical finding (e.g. breach notification / international transfer).
> "Every finding is mapped to a specific GDPR article, with the **exact sentence quoted from the document** as evidence, plus a recommended fix. Here it caught that data goes to US analytics vendors with no transfer safeguards — quoting the line — and that there's no 72-hour breach process."
- Point to the **"Audited on"** provenance badge.
> "And it shows where it ran — on AMD, that's fully private."

## 2:15 — Download the report (10s)
- Click **Markdown** to download the report.
> "Export the full report for your records — a compliance review in under a minute, with zero data leaving your infrastructure."

## 2:25 — The rest of the platform (40s)
_Compliance is the flagship, but it rides on a full private-agent platform — everything below runs through the same multi-provider (AMD / Fireworks / Groq) engine. Keep each one to ~2 lines._

> "And this isn't a one-trick app — the same private engine powers a whole platform."

- **Tools** — click **Tools**: *"30+ document and research tools — summarize, extract keywords, generate citations, research a topic — for the everyday work around a review."*
- **Agents** — click **Agents**: *"A control plane to build and run multi-step agents and YAML workflows, with human approvals and run history. The compliance audit is itself one of these workflows."*
- **Chat** — click **Chat**, send one message: *"And a streaming chat agent with tool use — same private inference, same provider toggle."* (show tokens streaming in)

## 3:05 — Close (10s)
> "Sovereign — private compliance auditing, on a full private-AI platform, running on your own AMD GPUs. It's live now."

_On screen: the live URL._

---

### Note on the AMD toggle for filming
- **If your AMD endpoint is live** (`AMD_VLLM_BASE_URL` set): select **AMD Instinct**, run the audit, and show the "Audited on: your own AMD Instinct GPUs (private)" badge — that's the money shot.
- **If it isn't yet:** run on **Fireworks** for the visible result, and while it runs, narrate: *"In production this runs on an AMD Instinct GPU via vLLM/ROCm — the code path is identical; it's a single config change to route inference onto your own hardware."* Keep it honest; the architecture and toggle are real and on screen either way.
