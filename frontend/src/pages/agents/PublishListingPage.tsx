import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import SEOHead from '../../components/SEOHead';
import { ArrowLeftIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';

interface Template {
  id: string;
  name: string;
  slug: string;
  template_type: string;
  description: string;
  is_public: boolean;
}

const PublishListingPage: React.FC = () => {
  usePageTitle('Publish Agent to Marketplace');
  const navigate = useNavigate();

  const [selectedSlug, setSelectedSlug] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [price, setPrice] = useState('0');
  const [billingCycle, setBillingCycle] = useState<'one_time' | 'monthly'>('one_time');
  const [listingStatus, setListingStatus] = useState<'published' | 'draft'>('published');

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['agent-templates'],
    queryFn: () => apiClient.get('/agents/templates/'),
  });

  const myTemplates = (templates || []).filter(t => !t.is_public || t.template_type === 'custom');

  const selectedTemplate = myTemplates.find(t => t.slug === selectedSlug);

  const publishMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/agents/marketplace/listings/', data),
    onSuccess: () => {
      toast.success('Agent published to marketplace!');
      navigate('/agents/marketplace');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to publish listing.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) {
      toast.error('Please select a template to publish.');
      return;
    }
    publishMutation.mutate({
      template_slug: selectedSlug,
      title: title || selectedTemplate?.name || 'Untitled Agent',
      summary,
      price_usd: price,
      billing_cycle: billingCycle,
      status: listingStatus,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead title="Publish Agent" description="List your AI agent on the Sovereign marketplace." />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/agents/marketplace" className="inline-flex items-center text-primary-600 hover:text-primary-500 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />Back to Marketplace
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Publish Your Agent</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">List an agent template on the marketplace for others to install and use.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Template</label>
              <select
                value={selectedSlug}
                onChange={(e) => {
                  setSelectedSlug(e.target.value);
                  const t = myTemplates.find(t => t.slug === e.target.value);
                  if (t) {
                    setTitle(t.name);
                    setSummary(t.description || '');
                  }
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Choose a template...</option>
                {myTemplates.map(t => (
                  <option key={t.slug} value={t.slug}>{t.name} ({t.template_type})</option>
                ))}
              </select>
              {myTemplates.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">No custom templates found. <Link to="/agents" className="text-primary-600 hover:underline">Create one first</Link>.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Listing Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Blog Content Pipeline Pro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary / Description</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                placeholder="Describe what this agent does and who it's for..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">Set to 0 for free. Platform takes 10% commission.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Billing</label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="one_time">One-time</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={listingStatus}
                  onChange={(e) => setListingStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="published">Published (visible now)</option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={!selectedSlug || publishMutation.isPending}
                className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <RocketLaunchIcon className="h-4 w-4 mr-2" />
                {publishMutation.isPending ? 'Publishing...' : 'Publish to Marketplace'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default PublishListingPage;
