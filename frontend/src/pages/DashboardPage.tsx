import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  SparklesIcon,
  ClockIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowPathIcon,
  CalendarIcon,
  GiftIcon,
  FireIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { UsageChart } from '../components/analytics/UsageChart';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { usePageTitle } from '../hooks/usePageTitle';

interface DashboardData {
  stats: {
    monthly_usage: {
      current: number;
      limit: number;
      percentage: number;
      change: string;
      changeType: string;
    };
    tools_used: {
      value: number;
      change: string;
      changeType: string;
    };
    time_saved: {
      value: string;
      change: string;
      changeType: string;
    };
  };
  recentTools: Array<{
    id: string;
    name: string;
    icon: string;
    lastUsed: string;
    processing_time: number;
  }>;
  popularTools: Array<{
    id: string;
    name: string;
    category: string;
    usageCount: number;
  }>;
  usageTrend: Array<{
    date: string;
    count: number;
  }>;
  toolCategories: Array<{
    tool__category: string;
    count: number;
  }>;
}

interface ActivityData {
  results: Array<{
    id: string;
    tool: {
      id: string;
      name: string;
      slug: string;
      category: string;
      icon: string;
    };
    created_at: string;
    processing_time: number;
    success: boolean;
    input_preview: string;
    output_preview: string;
  }>;
  count: number;
}

interface AnalyticsData {
  period: string;
  usage_by_date: Array<{ date: string; count: number }>;
  usage_by_tool: Array<{
    tool__name: string;
    tool__category: string;
    count: number;
    avg_processing_time: number;
  }>;
  metrics: {
    total_usage: number;
    success_rate: number;
    avg_daily_usage: number;
  };
}

const DashboardPage: React.FC = () => {
  usePageTitle('Dashboard', 'View your Sovereign writing activity, usage analytics, and most-used AI tools.');
  const { user } = useAuthStore();
  const [analyticsPeriod, setAnalyticsPeriod] = useState('7d');

  // Fetch dashboard stats
  const { data: dashboardData, isLoading, error: dashboardError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.get('/dashboard/stats/'),
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch recent activity
  const { data: activityData } = useQuery<ActivityData>({
    queryKey: ['user-activity'],
    queryFn: () => apiClient.get('/dashboard/activity/?limit=5'),
  });

  // Fetch analytics
  const { data: analyticsData } = useQuery<AnalyticsData>({
    queryKey: ['tool-analytics', analyticsPeriod],
    queryFn: () => apiClient.get(`/dashboard/analytics/?period=${analyticsPeriod}`),
  });

  // Fetch rewards summary
  const { data: rewardsData } = useQuery<{ balance: number; current_streak: number; total_earned: number }>({
    queryKey: ['reward-balance'],
    queryFn: () => apiClient.get('/rewards/balance/'),
  });

  const handleRefresh = () => {
    refetch();
    toast.success('Dashboard refreshed!');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return format(date, 'MMM dd, yyyy');
  };

  const statsCards = [
    {
      name: 'Monthly Usage',
      value: `${dashboardData?.stats.monthly_usage.current || 0} / ${dashboardData?.stats.monthly_usage.limit || 50}`,
      icon: ChartBarIcon,
      change: dashboardData?.stats.monthly_usage.change || '0%',
      changeType: dashboardData?.stats.monthly_usage.changeType || 'neutral',
      percentage: dashboardData?.stats.monthly_usage.percentage || 0,
    },
    {
      name: 'Tools Used',
      value: dashboardData?.stats.tools_used.value || 0,
      icon: SparklesIcon,
      change: dashboardData?.stats.tools_used.change || '0',
      changeType: dashboardData?.stats.tools_used.changeType || 'neutral',
    },
    {
      name: 'Time Saved',
      value: dashboardData?.stats.time_saved.value || '0 hrs',
      icon: ClockIcon,
      change: dashboardData?.stats.time_saved.change || '0 hrs',
      changeType: dashboardData?.stats.time_saved.changeType || 'neutral',
    },
  ];

  if (dashboardError) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <ChartBarIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            Unable to load dashboard
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Something went wrong while fetching your dashboard data.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 btn btn-primary inline-flex items-center"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-80"></div>
          </div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="flex items-center">
                <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="ml-5 flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-64 bg-gray-100 dark:bg-gray-800"></div>
          <div className="card h-64 bg-gray-100 dark:bg-gray-800"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.first_name || 'User'}!
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Here's an overview of your writing activity.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn btn-outline flex items-center"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <stat.icon
                  className="h-6 w-6 text-gray-400"
                  aria-hidden="true"
                />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {stat.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {stat.value}
                    </div>
                    {stat.change && (
                      <div
                        className={`ml-2 flex items-baseline text-sm font-semibold ${
                          stat.changeType === 'positive'
                            ? 'text-green-600'
                            : stat.changeType === 'negative'
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {stat.changeType === 'positive' ? (
                          <ArrowUpIcon className="h-4 w-4 flex-shrink-0" />
                        ) : stat.changeType === 'negative' ? (
                          <ArrowDownIcon className="h-4 w-4 flex-shrink-0" />
                        ) : null}
                        <span className="ml-1">{stat.change}</span>
                      </div>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
            {stat.name === 'Monthly Usage' && stat.percentage !== undefined && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      stat.percentage > 80
                        ? 'bg-red-600'
                        : stat.percentage > 60
                        ? 'bg-yellow-600'
                        : 'bg-primary-600'
                    }`}
                    style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Rewards Summary */}
      {rewardsData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6"
        >
          <Link
            to="/profile"
            onClick={() => sessionStorage.setItem('profileTab', 'rewards')}
            className="block card bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">🪙</span>
                  <div>
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Coins</p>
                    <p className="text-xl font-bold text-yellow-900 dark:text-yellow-200">{rewardsData.balance}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <FireIcon className="h-6 w-6 text-orange-500 mr-2" />
                  <div>
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Streak</p>
                    <p className="text-xl font-bold text-orange-900 dark:text-orange-200">{rewardsData.current_streak} days</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <GiftIcon className="h-6 w-6 text-green-500 mr-2" />
                  <div>
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">Total Earned</p>
                    <p className="text-xl font-bold text-green-900 dark:text-green-200">{rewardsData.total_earned}</p>
                  </div>
                </div>
              </div>
              <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                View Rewards →
              </span>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Usage Progress Alert */}
      {!user?.is_pro && (dashboardData?.stats.monthly_usage.percentage || 0) > 80 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800"
        >
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You're approaching your monthly limit.
            <Link to="/pricing" className="ml-1 font-medium underline">
              Upgrade to Pro
            </Link>
            {' '}for unlimited access.
          </p>
        </motion.div>
      )}

      {/* Popular Tools */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Your Most Used Tools
        </h2>
        {dashboardData?.popularTools && dashboardData.popularTools.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardData.popularTools.map((tool) => (
              <Link
                key={tool.id}
                to={`/tools/${tool.id}`}
                className="card hover:shadow-lg transition-shadow duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <SparklesIcon className="h-10 w-10 text-primary-600 group-hover:text-primary-700" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {tool.category} • Used {tool.usageCount} times
                      </p>
                    </div>
                  </div>
                  <ArrowUpIcon className="h-5 w-5 text-gray-400 group-hover:text-primary-600 rotate-45" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-center py-10">
            <SparklesIcon className="mx-auto h-10 w-10 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No tools used yet
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Start exploring our AI tools to see your favorites here.
            </p>
            <div className="mt-4">
              <Link to="/tools" className="btn btn-primary text-sm">Explore Tools</Link>
            </div>
          </div>
        )}
      </motion.div>

      {/* Usage Analytics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Usage Trend
            </h3>
            <select
              value={analyticsPeriod}
              onChange={(e) => setAnalyticsPeriod(e.target.value)}
              className="text-sm input py-1"
              aria-label="Select analytics period"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <UsageChart
            chartType="line"
            usageData={analyticsData?.usage_by_date}
          />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tool Performance
          </h3>
          <UsageChart
            chartType="bar"
            toolUsage={analyticsData?.usage_by_tool.map(tool => ({
              name: tool.tool__name,
              count: tool.count,
              category: tool.tool__category,
            }))}
          />
        </div>
      </motion.div>

      {/* Analytics Metrics */}
      {analyticsData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="card text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {analyticsData.metrics.success_rate}%
            </p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Daily Average</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {analyticsData.metrics.avg_daily_usage} uses
            </p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Uses</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {analyticsData.metrics.total_usage}
            </p>
          </div>
        </motion.div>
      )}

      {/* Referral Invite Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="mt-8"
      >
        <div className="rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20">
                <UserPlusIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Invite Friends, Earn Rewards</h3>
                <p className="text-sm text-white/80">
                  Get 100 coins + 5 bonus tool uses for every friend who joins.
                  {user?.referral_code && (
                    <span className="ml-1 font-mono font-bold">{user.referral_code}</span>
                  )}
                </p>
              </div>
            </div>
            <Link
              to="/referrals"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-primary-700 font-semibold text-sm hover:bg-white/90 transition-colors flex-shrink-0"
            >
              <GiftIcon className="h-4 w-4 mr-1.5" />
              Invite Friends
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-8"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h2>
          {activityData && activityData.count > 5 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing latest 5 of {activityData.count}
            </span>
          )}
        </div>
        {activityData && activityData.results.length > 0 ? (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {activityData.results.map((activity) => (
                <li key={activity.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        activity.success
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <SparklesIcon className={`h-6 w-6 ${
                          activity.success
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.tool.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {activity.input_preview || 'No preview available'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <CalendarIcon className="inline h-3 w-3 mr-1" />
                        {formatTime(activity.created_at)} • {activity.processing_time.toFixed(2)}s
                      </p>
                    </div>
                    <div>
                      <Link
                        to={`/tools/${(activity.tool as any).slug || activity.tool.id}`}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-5 font-medium rounded-md text-primary-600 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900 dark:hover:bg-primary-800"
                      >
                        Use Again
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card text-center py-12">
            <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No activity yet
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by trying one of our AI-powered tools.
            </p>
            <div className="mt-6">
              <Link
                to="/tools"
                className="btn btn-primary"
              >
                Explore Tools
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default DashboardPage;