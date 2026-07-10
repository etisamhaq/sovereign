import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import SEOHead from '../../components/SEOHead';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  StarIcon,
  UserCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface ListingDetail {
  id: string;
  template: string;
  template_slug: string;
  template_type: string;
  template_description: string;
  template_definition_json: { steps?: Array<{ key: string; type: string; action: string; config?: Record<string, unknown> }> };
  published_by: string;
  seller_email: string;
  seller_name: string;
  title: string;
  summary: string;
  price_usd: string;
  billing_cycle: string;
  status: string;
  installs_count: number;
  rating_avg: string;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

const STEP_TYPE_COLORS: Record<string, string> = {
  tool: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  llm: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  api_call: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  transform: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const AgentMarketplaceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  usePageTitle('Agent Details');

  const { data: listing, isLoading } = useQuery<ListingDetail>({
    queryKey: ['agent-marketplace-listing', id],
    queryFn: () => apiClient.get(`/agents/marketplace/listings/${id}/`),
    enabled: !!id,
  });

  const purchaseMutation = useMutation({
    mutationFn: () => apiClient.post(`/agents/marketplace/listings/${id}/purchase/`),
    onSuccess: () => {
      toast.success('Agent installed! You can now use it from your Agents page.');
      qc.invalidateQueries({ queryKey: ['agent-marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['agent-templates'] });
      navigate('/agents');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Failed to install agent.';
      toast.error(msg);
    },
  });

  if (isLoading || !listing) {
    return (
      <div className="bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const price = Number(listing.price_usd);
  const isFree = price === 0;
  const steps = listing.template_definition_json?.steps || [];

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead title={listing.title} description={listing.summary} />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link to="/agents/marketplace" className="inline-flex items-center text-primary-600 hover:text-primary-500 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />Back to Marketplace
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-r from-primary-600 to-indigo-600 px-8 py-10 text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <span className="inline-block mb-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">{listing.template_type}</span>
                <h1 className="text-3xl font-bold">{listing.title}</h1>
                <p className="mt-2 text-primary-100 max-w-2xl">{listing.summary || listing.template_description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold">{isFree ? 'Free' : `$${price.toFixed(2)}`}</p>
                {listing.billing_cycle === 'monthly' && <p className="text-sm text-primary-200">/month</p>}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-primary-100">
              <span className="inline-flex items-center gap-1"><ArrowDownTrayIcon className="h-4 w-4" />{listing.installs_count} installs</span>
              {Number(listing.rating_avg) > 0 && (
                <span className="inline-flex items-center gap-1"><StarIcon className="h-4 w-4" />{Number(listing.rating_avg).toFixed(1)} ({listing.rating_count} ratings)</span>
              )}
              <span className="inline-flex items-center gap-1"><ClockIcon className="h-4 w-4" />{new Date(listing.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Purchase Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending}
                className="rounded-lg bg-primary-600 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {purchaseMutation.isPending ? 'Installing...' : isFree ? 'Install Free' : `Get This Agent — $${price.toFixed(2)}`}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">Installs a copy to your agent workspace. Your data stays private.</p>
            </div>

            {/* Seller Info */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Seller</h3>
              <div className="flex items-center gap-3">
                <UserCircleIcon className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{listing.seller_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{listing.seller_email}</p>
                </div>
              </div>
            </div>

            {/* Workflow Preview */}
            {steps.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workflow Steps ({steps.length})</h3>
                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div key={step.key} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{step.key}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STEP_TYPE_COLORS[step.type] || 'bg-gray-100 text-gray-700'}`}>{step.type}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{step.action}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {listing.template_description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">About This Agent</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{listing.template_description}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AgentMarketplaceDetailPage;
