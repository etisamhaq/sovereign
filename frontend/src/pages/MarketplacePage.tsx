import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import { toast } from 'react-hot-toast';
import {
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  RocketLaunchIcon,
  PlusCircleIcon,
  FunnelIcon,
  CheckBadgeIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

interface MarketplaceTool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  external_url: string;
  icon: string;
  is_free: boolean;
  is_featured: boolean;
  owner: {
    name: string;
    website: string;
  };
  trust: {
    verified: boolean;
    last_reviewed_at: string | null;
    uptime_percentage: number | null;
  };
  created_at: string;
}

interface MarketplaceResponse {
  count: number;
  results: MarketplaceTool[];
  can_submit_tools: boolean;
  submission_status: 'coming_soon' | string;
}

interface MarketplaceSubmissionPayload {
  tool_name: string;
  tool_url: string;
  category: string;
  contact_email: string;
  description: string;
}

const MarketplacePage: React.FC = () => {
  usePageTitle('Marketplace', 'Discover external AI tools in the Sovereign Marketplace. Free to access for logged-in users.');
  const [category, setCategory] = useState('all');
  const [pricing, setPricing] = useState<'all' | 'free' | 'paid'>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<'featured' | 'newest'>('featured');
  const [formData, setFormData] = useState<MarketplaceSubmissionPayload>({
    tool_name: '',
    tool_url: '',
    category: '',
    contact_email: '',
    description: '',
  });
  const [showThanksMessage, setShowThanksMessage] = useState(false);

  const { data, isLoading, error } = useQuery<MarketplaceResponse>({
    queryKey: ['marketplace-tools', category, pricing, featuredOnly, sort],
    queryFn: () =>
      apiClient.get('/tools/marketplace/', {
        params: {
          category,
          pricing,
          featured: featuredOnly ? 'true' : undefined,
          sort,
        },
      }),
  });

  const tools = data?.results || [];
  const submissionsEnabled = Boolean(data?.can_submit_tools);

  const submitToolMutation = useMutation({
    mutationFn: (payload: MarketplaceSubmissionPayload) =>
      apiClient.post('/tools/marketplace/submissions/', payload),
    onSuccess: () => {
      setShowThanksMessage(true);
      setFormData({
        tool_name: '',
        tool_url: '',
        category: '',
        contact_email: '',
        description: '',
      });
      toast.success('Thanks! Your submission is now in review.');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.detail || 'Failed to submit tool. Please try again.';
      toast.error(message);
    },
  });

  const handleFormChange = (field: keyof MarketplaceSubmissionPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowThanksMessage(false);
    submitToolMutation.mutate(formData);
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set((data?.results || []).map((t) => t.category).filter(Boolean)));
    return ['all', ...unique];
  }, [data]);

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead
        title="Marketplace"
        description="Discover external AI tools in the Sovereign Marketplace. Free to access for logged-in users."
        canonical="/marketplace"
        keywords="AI marketplace, Sovereign marketplace, external AI tools, prepza, logiforge, vixora, slideo"
        noIndex
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-medium">
            <SparklesIcon className="h-4 w-4" />
            Sovereign Marketplace
          </div>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 dark:text-white">Discover AI Tools Beyond Sovereign</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Access partner and external tools curated by Sovereign. Marketplace access is free for all logged-in users.
          </p>
        </motion.div>

        <div className="mt-10 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/40">
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 dark:text-gray-300">
            <FunnelIcon className="h-4 w-4" />
            Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={pricing}
              onChange={(e) => setPricing(e.target.value as 'all' | 'free' | 'paid')}
              aria-label="Filter by pricing"
            >
              <option value="all">All Pricing</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>

            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'featured' | 'newest')}
              aria-label="Sort tools"
            >
              <option value="featured">Featured First</option>
              <option value="newest">Newest</option>
            </select>

            <button
              onClick={() => setFeaturedOnly((v) => !v)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                featuredOnly
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
              }`}
            >
              Featured Only
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-12 text-center text-red-500">Failed to load marketplace tools. Please try again.</div>
        ) : (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{tool.name}</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">{tool.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                        {tool.category}
                      </span>
                      {tool.is_featured && (
                        <span className="px-2 py-1 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          Featured
                        </span>
                      )}
                      {tool.trust?.verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                          <CheckBadgeIcon className="h-3.5 w-3.5" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium">
                    {tool.is_free ? 'Free' : 'Paid'}
                  </span>
                </div>

                <Link
                  to={`/marketplace/${tool.slug}`}
                  className="mt-6 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2.5 text-white font-semibold hover:bg-primary-500 transition-colors"
                >
                  View Details
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-14 rounded-2xl border border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/60 dark:bg-primary-900/20 p-8"
        >
          <div className="flex items-center gap-3 text-primary-700 dark:text-primary-300">
            <PlusCircleIcon className="h-6 w-6" />
            <h2 className="text-xl font-semibold">
              {submissionsEnabled ? 'Add Your Tool' : 'Add Your Tool (Coming Soon)'}
            </h2>
          </div>
          {submissionsEnabled ? (
            <>
              <p className="mt-3 text-gray-700 dark:text-gray-300">
                Submit your AI product and our team will review it for quality, trust, and user value.
              </p>

              {showThanksMessage && (
                <div className="mt-4 rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 p-4 text-green-800 dark:text-green-300 text-sm">
                  Thanks! Our team will review your tool, and if approved, we’ll add it to the marketplace.
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Tool Name"
                  value={formData.tool_name}
                  onChange={(e) => handleFormChange('tool_name', e.target.value)}
                  className="input"
                />
                <input
                  required
                  type="url"
                  placeholder="Tool URL"
                  value={formData.tool_url}
                  onChange={(e) => handleFormChange('tool_url', e.target.value)}
                  className="input"
                />
                <input
                  required
                  placeholder="Category"
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  className="input"
                />
                <input
                  required
                  type="email"
                  placeholder="Contact Email"
                  value={formData.contact_email}
                  onChange={(e) => handleFormChange('contact_email', e.target.value)}
                  className="input"
                />
                <textarea
                  required
                  placeholder="Tool Description"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  className="input md:col-span-2 min-h-[90px]"
                />

                <div className="md:col-span-2 mt-1">
                  <button
                    type="submit"
                    disabled={submitToolMutation.isPending}
                    className="inline-flex items-center rounded-lg px-4 py-2.5 bg-primary-600 text-white font-semibold hover:bg-primary-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitToolMutation.isPending ? 'Submitting...' : 'Submit Tool'}
                    <PaperAirplaneIcon className="h-4 w-4 ml-2" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <p className="mt-3 text-gray-700 dark:text-gray-300">
                Soon, creators will be able to submit and list their own AI tools in the Sovereign Marketplace.
                We’re preparing review, quality, and trust systems before opening submissions.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 font-medium">
                <RocketLaunchIcon className="h-4 w-4" />
                Submission portal launch planned in a future release
              </div>
            </>
          )}
        </motion.div>

        <div className="mt-10 text-center">
          <Link to="/tools" className="text-primary-600 hover:text-primary-500 font-semibold">
            Back to Sovereign Tools
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MarketplacePage;