import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import SEOHead from '../../components/SEOHead';
import { Link } from 'react-router-dom';

interface ServiceRequest {
  id: string;
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
  delivered_url: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const statusSteps = ['pending', 'paid', 'in_progress', 'completed'];

const MyServiceRequestsPage: React.FC = () => {
  const { data: requests, isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ['my-service-requests'],
    queryFn: async () => {
      const res = await apiClient.get('/solutions/my-requests/');
      return (res as any).results || res;
    },
  });

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead title="My Service Requests" description="Track your Sovereign solution requests." />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Service Requests</h1>
          <Link
            to="/solutions/automation"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            New Request
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No service requests yet.</p>
            <p className="mt-2 text-gray-400 dark:text-gray-500">
              Visit our <Link to="/solutions/automation" className="text-primary-600 hover:underline">Solutions</Link> pages to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((req, idx) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {req.service_type_display}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {req.package_tier_display} Package &middot; ${parseFloat(req.amount).toLocaleString()} &middot; {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColors[req.status] || statusColors.pending}`}>
                        {req.status_display}
                      </span>
                      {req.payment_status === 'paid' && (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Paid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status tracker */}
                  {req.status !== 'cancelled' && (
                    <div className="mt-6 flex items-center gap-1">
                      {statusSteps.map((step, i) => {
                        const currentIdx = statusSteps.indexOf(req.status);
                        const isCompleted = i <= currentIdx;
                        return (
                          <React.Fragment key={step}>
                            <div className={`h-2 flex-1 rounded-full ${isCompleted ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-1 flex justify-between text-xs text-gray-400 dark:text-gray-500">
                    {statusSteps.map(s => (
                      <span key={s} className="capitalize">{s.replace('_', ' ')}</span>
                    ))}
                  </div>

                  {/* Requirements */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Requirements</h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{req.requirements}</p>
                  </div>

                  {/* AI Analysis */}
                  {(req.ai_summary || req.ai_suggested_solution) && (
                    <div className="mt-6 rounded-lg bg-primary-50 dark:bg-primary-900/20 p-4">
                      <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2">AI Analysis</h4>
                      {req.ai_summary && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">Summary</p>
                          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{req.ai_summary}</p>
                        </div>
                      )}
                      {req.ai_suggested_solution && (
                        <div>
                          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">Suggested Solution</p>
                          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{req.ai_suggested_solution}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery Link */}
                  {req.delivered_url && (
                    <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <h4 className="text-sm font-semibold text-green-700 dark:text-green-300">Your Delivery</h4>
                      <a
                        href={req.delivered_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center text-sm text-green-600 hover:text-green-700 dark:text-green-400 hover:underline"
                      >
                        Access your solution &rarr;
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyServiceRequestsPage;
