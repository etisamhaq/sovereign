/**
 * Sovereign compliance-audit service.
 *
 * Backend endpoints (see agents/compliance_views.py):
 * - GET  /api/agents/compliance/frameworks/  — available frameworks
 * - POST /api/agents/compliance/audit/       — run an audit, returns findings + report
 *
 * The `provider` field is the product's centerpiece:
 *   ''         → configured default chain (fireworks → groq → amd)
 *   'amd'      → run privately on the customer's own AMD Instinct GPUs
 *   'fireworks'→ fast managed cloud path
 */

import { apiClient } from './api';

export type ComplianceStatus =
  | 'compliant'
  | 'partial'
  | 'not_addressed'
  | 'non_compliant';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Framework {
  framework: string;
  name: string;
  description: string;
  num_rules: number;
}

export interface Finding {
  rule_id: string;
  title: string;
  requirement: string;
  reference: string;
  status: ComplianceStatus;
  severity: Severity;
  evidence: string;
  issue: string;
  recommendation: string;
}

export interface AuditSummary {
  total_rules: number;
  issues: number;
  status_counts: Record<ComplianceStatus, number>;
  severity_counts: Record<Severity, number>;
  risk_score: number;
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low' | 'Minimal';
}

export interface AuditResult {
  framework: string;
  framework_name: string;
  provider_used: string;
  model_used: string;
  document_name: string;
  summary: AuditSummary;
  findings: Finding[];
  report_markdown: string;
}

export interface AuditRequest {
  document_text: string;
  framework: string;
  provider: string;
  document_name?: string;
}

export const complianceService = {
  async getFrameworks(): Promise<Framework[]> {
    const res = await apiClient.get<{ frameworks: Framework[] }>(
      '/agents/compliance/frameworks/'
    );
    return res.frameworks;
  },

  async runAudit(req: AuditRequest): Promise<AuditResult> {
    return apiClient.post<AuditResult>('/agents/compliance/audit/', req);
  },
};
