import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';
import SEOHead from '../../components/SEOHead';
import {
  ArrowLeftIcon,
  CurrencyDollarIcon,
  ArrowDownTrayIcon,
  ShoppingCartIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface Analytics {
  listings_total: number;
  installs_total: number;
  purchases_total: number;
  active_purchases: number;
  refunded_purchases: number;
  settlements_pending: number;
  settlements_settled: number;
  gross_revenue_usd: number;
  platform_fees_usd: number;
  net_revenue_usd: number;
}

interface Listing {
  id: string;
  template_slug: string;
  title: string;
  summary: string;
  price_usd: string;
  billing_cycle: string;
  status: string;
  installs_count: number;
  created_at: string;
}

// NOTE: A previous ``Purchase`` interface and ``settleMutation`` were defined
// here as scaffolding for an in-dashboard settlement action that was later
// moved to a dedicated admin view. They were dead code and have been removed.

const SellerDashboardPage: React.FC = () => {
  usePageTitle('Seller Dashboard');

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ['marketplace-analytics'],
    queryFn: () => apiClient.get('/agents/marketplace/analytics/'),
  });

  const { data: listings } = useQuery<Listing[]>({
    queryKey: ['agent-marketplace-listings'],
    queryFn: () => apiClient.get('/agents/marketplace/listings/'),
  });

  const stats = [
    { label: 'Total Listings', value: analytics?.listings_total ?? 0, icon: ShoppingCartIcon },
    { label: 'Total Installs', value: analytics?.installs_total ?? 0, icon: ArrowDownTrayIcon },
    { label: 'Gross Revenue', value: `$${(analytics?.gross_revenue_usd ?? 0).toFixed(2)}`, icon: CurrencyDollarIcon },
    { label: 'Platform Fees', value: `$${(analytics?.platform_fees_usd ?? 0).toFixed(2)}`, icon: ArrowPathIcon },
    { label: 'Net Revenue', value: `$${(analytics?.net_revenue_usd ?? 0).toFixed(2)}`, icon: CheckCircleIcon },
    { label: 'Pending Settlements', value: analytics?.settlements_pending ?? 0, icon: ClockIcon },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead title="Seller Dashboard" description="Manage your marketplace listings and track revenue." />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link to="/agents/marketplace" className="inline-flex items-center text-primary-600 hover:text-primary-500 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />Back to Marketplace
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Seller Dashboard</h1>
          <Link to="/agents/marketplace/publish" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            Publish New Agent
          </Link>
        </div>

        {/* Analytics Cards */}
        {analyticsLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center"
              >
                <stat.icon className="h-6 w-6 mx-auto text-primary-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Purchase Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Active Purchases</p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-200">{analytics?.active_purchases ?? 0}</p>
          </div>
          <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Pending Settlements</p>
            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{analytics?.settlements_pending ?? 0}</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Refunded</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200">{analytics?.refunded_purchases ?? 0}</p>
          </div>
        </div>

        {/* Listings Table */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Listings</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {(!listings || listings.length === 0) ? (
              <div className="p-6 text-center text-gray-500">
                No listings yet. <Link to="/agents/marketplace/publish" className="text-primary-600 hover:underline">Publish your first agent</Link>.
              </div>
            ) : (
              listings.map((listing) => (
                <div key={listing.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/agents/marketplace/${listing.id}`} className="font-semibold text-sm text-gray-900 dark:text-white hover:text-primary-600 truncate block">
                      {listing.title}
                    </Link>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className={`px-2 py-0.5 rounded-full ${
                        listing.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : listing.status === 'draft' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        : 'bg-red-100 text-red-700'
                      }`}>{listing.status}</span>
                      <span>${Number(listing.price_usd).toFixed(2)} {listing.billing_cycle === 'monthly' ? '/mo' : ''}</span>
                      <span>{listing.installs_count} installs</span>
                      <span>{new Date(listing.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboardPage;
