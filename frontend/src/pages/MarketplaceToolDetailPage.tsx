import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import {
  ArrowTopRightOnSquareIcon,
  ArrowLeftIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface MarketplaceToolDetail {
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
  clicks_count: number;
  created_at: string;
  updated_at: string;
}

const MarketplaceToolDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [opening, setOpening] = useState(false);

  const { data: tool, isLoading, error } = useQuery<MarketplaceToolDetail>({
    queryKey: ['marketplace-tool-detail', slug],
    queryFn: () => apiClient.get(`/tools/marketplace/${slug}/`),
    enabled: !!slug,
  });

  usePageTitle(tool ? `${tool.name} · Marketplace` : 'Marketplace Tool');

  const openTool = async () => {
    if (!tool || opening) return;
    setOpening(true);
    try {
      const response = await apiClient.post(`/tools/marketplace/${tool.slug}/click/`, {
        source: 'marketplace_detail',
        referrer_path: window.location.pathname,
      }) as { ok: boolean; external_url: string };

      if (response?.external_url) {
        window.open(response.external_url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast.error('Failed to open tool. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 animate-pulse">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        <div className="h-10 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-red-600">Tool not found.</p>
        <Link to="/marketplace" className="mt-4 inline-flex items-center text-primary-600 hover:text-primary-500">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <SEOHead
        title={`${tool.name} · Marketplace`}
        description={tool.description}
        canonical={`/marketplace/${tool.slug}`}
        noIndex
      />

      <div className="mx-auto max-w-4xl px-6 py-14">
        <Link to="/marketplace" className="inline-flex items-center text-primary-600 hover:text-primary-500">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
              {tool.category}
            </span>
            {tool.is_featured && (
              <span className="px-2 py-1 rounded text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                Featured
              </span>
            )}
            <span className="px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
              {tool.is_free ? 'Free' : 'Paid'}
            </span>
            {tool.trust?.verified && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                <CheckBadgeIcon className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">{tool.description}</p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <UserIcon className="h-4 w-4" />
                Owner
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{tool.owner?.name || 'Unknown'}</p>
              {tool.owner?.website && (
                <a
                  href={tool.owner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:text-primary-500"
                >
                  Visit website
                </a>
              )}
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <ShieldCheckIcon className="h-4 w-4" />
                Uptime
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {tool.trust?.uptime_percentage != null ? `${tool.trust.uptime_percentage}%` : 'N/A'}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-4 w-4" />
                Last Reviewed
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {tool.trust?.last_reviewed_at ? new Date(tool.trust.last_reviewed_at).toLocaleDateString() : 'Pending'}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={openTool}
              disabled={opening}
              className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-3 text-white font-semibold hover:bg-primary-500 transition-colors disabled:opacity-70"
            >
              {opening ? 'Opening...' : 'Open External Tool'}
              <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">{tool.clicks_count} opens from marketplace</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MarketplaceToolDetailPage;
