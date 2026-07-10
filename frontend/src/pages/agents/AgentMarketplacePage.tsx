import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import SEOHead from '../../components/SEOHead';
import {
  MagnifyingGlassIcon,
  StarIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface Listing {
  id: string;
  template: string;
  template_slug: string;
  published_by: string;
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

const TYPE_LABELS: Record<string, string> = {
  content_repurpose: 'Content',
  revenue_ops: 'Revenue Ops',
  seo_execution: 'SEO',
  content_pipeline: 'Blog Pipeline',
  sales_outreach: 'Sales',
  document_analysis: 'Document',
  ad_campaign: 'Ad Campaign',
  email_sequence: 'Email',
  prompt_pack: 'Prompt Pack',
  custom: 'Custom',
};

const AgentMarketplacePage: React.FC = () => {
  usePageTitle('Agent Marketplace', 'Browse and install AI agents, automation templates, and prompt packs.');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [sort, setSort] = useState<'newest' | 'popular' | 'price_asc'>('newest');

  const { data: listings, isLoading } = useQuery<Listing[]>({
    queryKey: ['agent-marketplace-listings'],
    queryFn: () => apiClient.get('/agents/marketplace/listings/'),
  });

  const filtered = useMemo(() => {
    let items = listings || [];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(l => l.title.toLowerCase().includes(q) || l.summary.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') {
      items = items.filter(l => (l as any).template_type === typeFilter || l.template_slug.includes(typeFilter));
    }
    if (priceFilter === 'free') items = items.filter(l => Number(l.price_usd) === 0);
    if (priceFilter === 'paid') items = items.filter(l => Number(l.price_usd) > 0);
    if (sort === 'newest') items = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === 'popular') items = [...items].sort((a, b) => b.installs_count - a.installs_count);
    if (sort === 'price_asc') items = [...items].sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
    return items;
  }, [listings, search, typeFilter, priceFilter, sort]);

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead title="Agent Marketplace" description="Browse and install AI agents, automation templates, and prompt packs." />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agent Marketplace</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">Browse AI agents, automation templates, and prompt packs built by the community.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/agents/marketplace/publish" className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              <PlusIcon className="h-4 w-4 mr-2" />Sell Your Agent
            </Link>
            <Link to="/agents/marketplace/dashboard" className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ChartBarIcon className="h-4 w-4 mr-2" />Seller Dashboard
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents, templates, prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white">
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value as any)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white">
            <option value="all">All Prices</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white">
            <option value="newest">Newest</option>
            <option value="popular">Most Installed</option>
            <option value="price_asc">Price: Low to High</option>
          </select>
        </div>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No listings found.</p>
            <p className="mt-2 text-gray-400 dark:text-gray-500">Try adjusting your filters or <Link to="/agents/marketplace/publish" className="text-primary-600 hover:underline">publish your own agent</Link>.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((listing, idx) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link to={`/agents/marketplace/${listing.id}`} className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:shadow-lg transition-shadow h-full">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">{listing.title}</h3>
                    <span className="shrink-0 text-sm font-bold text-primary-600">
                      {Number(listing.price_usd) === 0 ? 'Free' : `$${Number(listing.price_usd).toFixed(2)}`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{listing.summary || 'No description'}</p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" />{listing.installs_count} installs
                    </span>
                    {Number(listing.rating_avg) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <StarIcon className="h-3.5 w-3.5 text-yellow-500" />{Number(listing.rating_avg).toFixed(1)} ({listing.rating_count})
                      </span>
                    )}
                    {listing.billing_cycle !== 'one_time' && (
                      <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{listing.billing_cycle}</span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentMarketplacePage;
