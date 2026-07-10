import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'react-hot-toast';
import SEOHead from '../../components/SEOHead';
import { Navigate } from 'react-router-dom';

interface ServiceRequest {
  id: string;
  user: string | null;
  user_email: string | null;
  user_name: string | null;
  service_type: string;
  service_type_display: string;
  package_tier: string;
  package_tier_display: string;
  status: string;
  status_display: string;
  payment_status: string;
  name: string;
  email: string;
  business_type: string;
  requirements: string;
  tools_used: string;
  budget: string;
  timeline: string;
  amount: string;
  ai_summary: string | null;
  ai_suggested_solution: string | null;
  admin_notes: string;
  delivered_url: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const AdminServiceRequestsPage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editUrl, setEditUrl] = useState<Record<string, string>>({});

  // Build the query string up-front so the ``useQuery`` key + URL stay in
  // sync when filters change.
  const params = new URLSearchParams();
  if (filterStatus) params.append('status', filterStatus);
  if (filterType) params.append('service_type', filterType);

  // Hooks must be called unconditionally; the staff redirect happens *after*
  // we've registered all hooks. We also gate the actual query on staff status
  // via ``enabled`` so non-staff users never hit the admin endpoint.
  const isStaff = !!user?.is_staff;

  const { data: requests, isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ['admin-service-requests', filterStatus, filterType],
    queryFn: async () => {
      const res = await apiClient.get(`/solutions/admin/requests/?${params.toString()}`);
      return (res as any).results || res;
    },
    enabled: isStaff,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiClient.patch(`/solutions/admin/requests/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] });
      toast.success('Request updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  if (!isStaff) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleStatusChange = (id: string, newStatus: string) => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  const handleSaveNotes = (id: string) => {
    const data: any = {};
    if (editNotes[id] !== undefined) data.admin_notes = editNotes[id];
    if (editUrl[id] !== undefined) data.delivered_url = editUrl[id] || null;
    updateMutation.mutate({ id, data });
  };

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead title="Admin: Service Requests" description="Manage solution service requests." />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Service Requests (Admin)</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="automation">AI Automation Setup</option>
            <option value="agents">Custom AI Agents</option>
            <option value="optimization">Workflow Optimization</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : !requests || requests.length === 0 ? (
          <p className="text-center py-20 text-gray-500 dark:text-gray-400">No service requests found.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((req, idx) => {
              const isExpanded = expandedId === req.id;
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  {/* Header row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="w-full p-4 flex flex-wrap items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[req.status]}`}>
                        {req.status_display}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {req.name} &mdash; {req.service_type_display}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {req.email} &middot; {req.package_tier_display} &middot; ${parseFloat(req.amount).toLocaleString()} &middot; {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <svg className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client Details</h4>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div className="flex gap-2"><dt className="font-medium text-gray-700 dark:text-gray-300">Name:</dt><dd className="text-gray-600 dark:text-gray-400">{req.name}</dd></div>
                            <div className="flex gap-2"><dt className="font-medium text-gray-700 dark:text-gray-300">Email:</dt><dd className="text-gray-600 dark:text-gray-400">{req.email}</dd></div>
                            <div className="flex gap-2"><dt className="font-medium text-gray-700 dark:text-gray-300">Business:</dt><dd className="text-gray-600 dark:text-gray-400">{req.business_type}</dd></div>
                            <div className="flex gap-2"><dt className="font-medium text-gray-700 dark:text-gray-300">Budget:</dt><dd className="text-gray-600 dark:text-gray-400">{req.budget}</dd></div>
                            <div className="flex gap-2"><dt className="font-medium text-gray-700 dark:text-gray-300">Timeline:</dt><dd className="text-gray-600 dark:text-gray-400">{req.timeline}</dd></div>
                            <div className="flex gap-2"><dt className="font-medium text-gray-700 dark:text-gray-300">Tools Used:</dt><dd className="text-gray-600 dark:text-gray-400">{req.tools_used || 'N/A'}</dd></div>
                          </dl>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Requirements</h4>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{req.requirements}</p>
                        </div>
                      </div>

                      {/* AI Analysis */}
                      {(req.ai_summary || req.ai_suggested_solution) && (
                        <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-4">
                          <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2">AI Analysis</h4>
                          {req.ai_summary && <p className="text-sm text-gray-700 dark:text-gray-300 mb-2"><strong>Summary:</strong> {req.ai_summary}</p>}
                          {req.ai_suggested_solution && <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"><strong>Suggested Solution:</strong> {req.ai_suggested_solution}</p>}
                        </div>
                      )}

                      {/* Admin controls */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Update Status</label>
                          <select
                            value={req.status}
                            onChange={(e) => handleStatusChange(req.id, e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                          >
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery URL</label>
                          <input
                            type="url"
                            defaultValue={req.delivered_url || ''}
                            onChange={(e) => setEditUrl(prev => ({ ...prev, [req.id]: e.target.value }))}
                            placeholder="https://..."
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Notes</label>
                        <textarea
                          defaultValue={req.admin_notes}
                          onChange={(e) => setEditNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                          rows={3}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveNotes(req.id)}
                          disabled={updateMutation.isPending}
                          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminServiceRequestsPage;
