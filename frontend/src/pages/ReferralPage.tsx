import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  UserPlusIcon,
  GiftIcon,
  TrophyIcon,
  ShareIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { authService } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';

interface ReferralMilestone {
  target: number;
  type: string;
  description: string;
  coins: number;
  pro_days: number;
  achieved: boolean;
}

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  total_coins_earned: number;
  total_credits_earned: number;
  next_milestone: {
    target: number;
    current: number;
    remaining: number;
    reward_coins: number;
    reward_pro_days: number;
  } | null;
  recent_referrals: {
    name: string;
    coins_earned: number;
    credits_earned: number;
    date: string;
  }[];
  milestones: ReferralMilestone[];
  rewards_per_referral: {
    referrer_coins: number;
    referrer_credits: number;
    referee_coins: number;
    referee_credits: number;
  };
}

const ReferralPage: React.FC = () => {
  usePageTitle('Referral Program');
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: stats, isLoading } = useQuery<ReferralStats>({
    queryKey: ['referral-stats'],
    queryFn: () => authService.getReferralStats() as Promise<ReferralStats>,
  });

  const referralCode = stats?.referral_code || user?.referral_code || '';
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareOnTwitter = () => {
    const text = `Join me on Sovereign — AI-powered writing tools! Use my referral code ${referralCode} and we'll both earn rewards 🎁`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`, '_blank');
  };

  const shareOnWhatsApp = () => {
    const text = `Hey! I've been using Sovereign for AI writing tools and it's amazing. Sign up with my link and we'll both get bonus coins and extra tool uses: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = 'Join me on Sovereign — AI Writing Tools';
    const body = `Hey!\n\nI've been using Sovereign for AI-powered writing tools and thought you'd love it too.\n\nSign up with my referral link and we'll both earn bonus rewards:\n${referralLink}\n\nYou'll get 25 bonus coins + 2 extra tool uses just for signing up!\n\nCheers`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <GiftIcon className="h-8 w-8 text-primary-600" />
          Referral Program
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Invite friends to Sovereign and earn rewards for every signup!
        </p>
      </motion.div>

      {/* How It Works Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 p-6 text-white"
      >
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <p className="font-semibold">Share Your Link</p>
              <p className="text-sm text-white/80">Send your unique referral link to friends</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <p className="font-semibold">They Sign Up</p>
              <p className="text-sm text-white/80">Your friend creates an account using your link</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <p className="font-semibold">Both Earn Rewards</p>
              <p className="text-sm text-white/80">You get {stats?.rewards_per_referral.referrer_coins || 100} coins + {stats?.rewards_per_referral.referrer_credits || 5} tool uses, they get {stats?.rewards_per_referral.referee_coins || 25} coins + {stats?.rewards_per_referral.referee_credits || 2} tool uses</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <UserPlusIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Referrals</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_referrals || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <SparklesIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Coins Earned</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_coins_earned || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <ArrowTrendingUpIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bonus Credits Earned</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_credits_earned || 0}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Referral Code & Link */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Referral Code</h3>

            {/* Code display */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3 font-mono text-lg font-bold text-primary-600 dark:text-primary-400 tracking-wider text-center">
                {referralCode}
              </div>
              <button
                onClick={copyCode}
                className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                title="Copy code"
              >
                {copied ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
              </button>
            </div>

            {/* Link display */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Shareable Link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 truncate">
                {referralLink}
              </div>
              <button
                onClick={copyLink}
                className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                title="Copy link"
              >
                {copiedLink ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
              </button>
            </div>

            {/* Share buttons */}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Share via</p>
              <div className="flex gap-2">
                <button
                  onClick={shareOnTwitter}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  Twitter
                </button>
                <button
                  onClick={shareOnWhatsApp}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </button>
                <button
                  onClick={shareViaEmail}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <ShareIcon className="h-4 w-4" />
                  Email
                </button>
              </div>
            </div>
          </motion.div>

          {/* Reward Details */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rewards Per Referral</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">You earn</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">For each friend who signs up</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-600 dark:text-primary-400">{stats?.rewards_per_referral.referrer_coins || 100} coins</p>
                  <p className="text-sm text-primary-500">+ {stats?.rewards_per_referral.referrer_credits || 5} tool uses</p>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Your friend earns</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Welcome bonus for joining</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 dark:text-green-400">{stats?.rewards_per_referral.referee_coins || 25} coins</p>
                  <p className="text-sm text-green-500">+ {stats?.rewards_per_referral.referee_credits || 2} tool uses</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Milestones */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrophyIcon className="h-5 w-5 text-yellow-500" />
              Milestones
            </h3>

            {/* Progress bar */}
            {stats?.next_milestone && (
              <div className="mb-5">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    {stats.next_milestone.current} / {stats.next_milestone.target} referrals
                  </span>
                  <span className="text-primary-600 dark:text-primary-400 font-medium">
                    {stats.next_milestone.remaining} more to go!
                  </span>
                </div>
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (stats.next_milestone.current / stats.next_milestone.target) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              {stats?.milestones.map((milestone) => (
                <div
                  key={milestone.type}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    milestone.achieved
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      milestone.achieved
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {milestone.achieved ? '✓' : milestone.target}
                    </div>
                    <div>
                      <p className={`font-medium ${
                        milestone.achieved ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white'
                      }`}>
                        {milestone.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {milestone.target} referrals
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      milestone.achieved ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      +{milestone.coins} coins
                    </p>
                    {milestone.pro_days > 0 && (
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        +{milestone.pro_days} Pro days
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Referrals */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Referrals</h3>

            {stats?.recent_referrals && stats.recent_referrals.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_referrals.map((referral, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <UserPlusIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{referral.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(referral.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                        +{referral.coins_earned} coins
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        +{referral.credits_earned} credits
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <UserPlusIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No referrals yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Share your link to start earning rewards!
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
