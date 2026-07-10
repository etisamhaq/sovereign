import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import {
  ShieldCheckIcon,
  LockClosedIcon,
  BoltIcon,
  ServerStackIcon,
  ArrowDownTrayIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

import { usePageTitle } from '../hooks/usePageTitle';
import {
  complianceService,
  Framework,
  AuditResult,
  Finding,
  ComplianceStatus,
  Severity,
} from '../services/compliance';

/* ─── Demo content ─────────────────────────────────────────────────────── */

const SAMPLE_DOCUMENT = `ACME CORP PRIVACY POLICY (excerpt)

We collect your name, email address, and usage data in order to provide and
improve our service. We process this data based on our legitimate interests in
operating and securing the platform.

You may email privacy@acme.example at any time to request a copy of the personal
data we hold about you, or to ask us to delete your account. We keep your data
only for as long as your account remains active.

We rely on third-party analytics and advertising providers located in the United
States to understand how the product is used. Payments are processed by our
payment partner. Data transmitted between your browser and our servers is
protected using TLS.`;

/* ─── Provider toggle ──────────────────────────────────────────────────── */

interface ProviderOption {
  id: string;
  label: string;
  tagline: string;
  Icon: typeof LockClosedIcon;
  accent: string; // tailwind classes for the selected state
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'amd',
    label: 'AMD Instinct',
    tagline: 'Private · on your own GPUs',
    Icon: LockClosedIcon,
    accent: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    tagline: 'Fast · managed cloud',
    Icon: BoltIcon,
    accent: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  },
  {
    id: '',
    label: 'Auto',
    tagline: 'Default fallback chain',
    Icon: ServerStackIcon,
    accent: 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300',
  },
];

/* ─── Status / severity styling ────────────────────────────────────────── */

const STATUS_STYLE: Record<ComplianceStatus, { label: string; cls: string }> = {
  non_compliant: { label: 'Non-compliant', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  not_addressed: { label: 'Not addressed', cls: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  compliant: { label: 'Compliant', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-slate-400 text-white',
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

function riskColor(level: string): string {
  switch (level) {
    case 'Critical': return 'text-red-600 dark:text-red-400';
    case 'High': return 'text-orange-600 dark:text-orange-400';
    case 'Medium': return 'text-yellow-600 dark:text-yellow-400';
    case 'Low': return 'text-blue-600 dark:text-blue-400';
    default: return 'text-green-600 dark:text-green-400';
  }
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function CompliancePage() {
  usePageTitle(
    'Compliance Audit',
    'Audit contracts and policies against GDPR, HIPAA and SOC 2 — privately, on your own AMD Instinct GPUs.'
  );

  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [framework, setFramework] = useState('gdpr');
  const [provider, setProvider] = useState('amd');
  const [documentText, setDocumentText] = useState('');
  const [documentName, setDocumentName] = useState('Acme Privacy Policy');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    complianceService
      .getFrameworks()
      .then((fw) => {
        setFrameworks(fw);
        if (fw.length && !fw.some((f) => f.framework === framework)) {
          setFramework(fw[0].framework);
        }
      })
      .catch(() => {/* non-fatal; selector falls back to defaults */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedFindings = useMemo(() => {
    if (!result) return [];
    const issues = result.findings.filter((f) => f.status !== 'compliant');
    const ok = result.findings.filter((f) => f.status === 'compliant');
    issues.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    return [...issues, ...ok];
  }, [result]);

  const runAudit = async () => {
    if (!documentText.trim()) {
      toast.error('Paste a document to audit first.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await complianceService.runAudit({
        document_text: documentText,
        framework,
        provider,
        document_name: documentName || 'Document',
      });
      setResult(res);
      toast.success(`Audited on ${res.provider_used || 'default'} · ${res.summary.issues} gap(s) found`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Audit failed. Check that a provider is configured.';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([result.report_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(result.document_name || 'audit').replace(/\s+/g, '_')}_${result.framework}_audit.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const providerUsedIsAmd = result?.provider_used === 'amd';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sovereign Compliance Audit</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Audit contracts &amp; policies against GDPR, HIPAA, and SOC 2 — privately, on your own AMD Instinct GPUs.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Input panel ── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-900 dark:text-white">Document</label>
              <button
                onClick={() => { setDocumentText(SAMPLE_DOCUMENT); setDocumentName('Acme Privacy Policy'); }}
                className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Load sample
              </button>
            </div>
            <textarea
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              placeholder="Paste a contract, privacy policy, or security document…"
              rows={12}
              className="w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Document name"
              className="mt-3 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Framework */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <label className="mb-3 block text-sm font-semibold text-gray-900 dark:text-white">Framework</label>
            <div className="flex flex-wrap gap-2">
              {(frameworks.length ? frameworks : [
                { framework: 'gdpr', name: 'GDPR', description: '', num_rules: 0 },
                { framework: 'hipaa', name: 'HIPAA', description: '', num_rules: 0 },
                { framework: 'soc2', name: 'SOC 2', description: '', num_rules: 0 },
              ]).map((f) => (
                <button
                  key={f.framework}
                  onClick={() => setFramework(f.framework)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    framework === f.framework
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                  title={f.description}
                >
                  {f.framework.toUpperCase()}
                  {f.num_rules ? <span className="ml-1.5 text-xs opacity-60">{f.num_rules}</span> : null}
                </button>
              ))}
            </div>
          </div>

          {/* Provider toggle — the centerpiece */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <label className="mb-1 block text-sm font-semibold text-gray-900 dark:text-white">Inference provider</label>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Where the audit runs. <span className="font-medium text-red-600 dark:text-red-400">AMD Instinct</span> keeps every document on your own hardware.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map(({ id, label, tagline, Icon, accent }) => (
                <button
                  key={id || 'auto'}
                  onClick={() => setProvider(id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all ${
                    provider === id
                      ? accent
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{tagline}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runAudit}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Auditing…
              </>
            ) : (
              <>
                <DocumentMagnifyingGlassIcon className="h-5 w-5" />
                Run compliance audit
              </>
            )}
          </button>
        </div>

        {/* ── Results panel ── */}
        <div className="lg:col-span-3">
          {!result && !loading && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
              <ShieldCheckIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Load the sample, pick a framework and provider, then run an audit.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Running the agent against the ruleset…</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Score + provenance */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Overall risk</p>
                    <p className={`text-3xl font-bold ${riskColor(result.summary.risk_level)}`}>
                      {result.summary.risk_level}
                      <span className="ml-2 text-lg text-gray-400">{result.summary.risk_score}/100</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {result.summary.issues} of {result.summary.total_rules} checks raised a gap.
                    </p>
                  </div>
                  <div className={`rounded-xl px-4 py-3 text-sm ${
                    providerUsedIsAmd
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      {providerUsedIsAmd ? <LockClosedIcon className="h-4 w-4" /> : <ServerStackIcon className="h-4 w-4" />}
                      {providerUsedIsAmd ? 'Ran privately on AMD' : `Ran on ${result.provider_used || 'default'}`}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] opacity-70">{result.model_used}</div>
                  </div>
                </div>

                {/* status counts */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['non_compliant', 'partial', 'not_addressed', 'compliant'] as ComplianceStatus[]).map((s) => (
                    <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[s].cls}`}>
                      {STATUS_STYLE[s].label}: {result.summary.status_counts?.[s] ?? 0}
                    </span>
                  ))}
                </div>
              </div>

              {/* toggle findings / report */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReport(false)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!showReport ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  Findings
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${showReport ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  Full report
                </button>
                <button
                  onClick={downloadReport}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" /> Markdown
                </button>
              </div>

              {!showReport ? (
                <div className="space-y-3">
                  {sortedFindings.map((f) => (
                    <FindingCard key={f.rule_id} finding={f} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                  <div className="prose prose-sm prose-gray max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-gray-900 dark:prose-strong:text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.report_markdown}</ReactMarkdown>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Finding card ─────────────────────────────────────────────────────── */

function FindingCard({ finding }: { finding: Finding }) {
  const status = STATUS_STYLE[finding.status];
  const isOk = finding.status === 'compliant';
  return (
    <div className={`rounded-xl border bg-white p-4 dark:bg-gray-800 ${
      isOk ? 'border-gray-200 dark:border-gray-700' : 'border-l-4 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
        {!isOk && (
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_STYLE[finding.severity]}`}>
            {finding.severity}
          </span>
        )}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{finding.title}</h3>
        {finding.reference && (
          <span className="ml-auto text-xs text-gray-400">{finding.reference}</span>
        )}
      </div>
      {!isOk && (
        <div className="mt-2 space-y-1.5 text-sm">
          {finding.issue && (
            <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Issue:</span> {finding.issue}</p>
          )}
          {finding.evidence && (
            <p className="text-gray-500 dark:text-gray-400"><span className="font-medium">Evidence:</span> “{finding.evidence}”</p>
          )}
          {finding.recommendation && (
            <p className="rounded-lg bg-primary-50 p-2 text-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
              <span className="font-medium">Fix:</span> {finding.recommendation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
