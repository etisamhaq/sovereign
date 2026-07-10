import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import ConfirmModal from '../ConfirmModal';
import {
  FireIcon,
  TrophyIcon,
  GiftIcon,
  ArrowPathIcon,
  SparklesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface RewardSummary {
  balance: number;
  total_earned: number;
  total_redeemed: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  achievements: Array<{
    achievement_type: string;
    achievement_display?: string;
    coins_awarded: number;
    achieved_at: string;
  }>;
}

interface RedemptionTier {
  id: string;
  name: string;
  description: string;
  coin_cost: number;
  bonus_credits: number;
  icon: string;
  is_active: boolean;
}

interface CoinTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  reason: string;
  reason_display: string;
  description: string;
  balance_after: number;
  created_at: string;
}

const ACHIEVEMENT_LABELS: Record<string, { label: string; icon: string }> = {
  milestone_50: { label: '50 Uses', icon: '⭐' },
  milestone_100: { label: '100 Uses', icon: '🌟' },
  milestone_500: { label: '500 Uses', icon: '💫' },
  streak_7: { label: '7-Day Streak', icon: '🔥' },
  streak_30: { label: '30-Day Streak', icon: '🏆' },
  all_tools: { label: 'Tool Explorer', icon: '🧭' },
};

const RewardsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [redeemConfirm, setRedeemConfirm] = useState<{ open: boolean; tier: RedemptionTier | null }>({
    open: false,
    tier: null,
  });

  const { data: summary, isLoading } = useQuery<RewardSummary>({
    queryKey: ['reward-balance'],
    queryFn: () => apiClient.get('/rewards/balance/'),
  });

  const { data: tiers } = useQuery<RedemptionTier[]>({
    queryKey: ['reward-tiers'],
    queryFn: () => apiClient.get('/rewards/tiers/'),
  });

  const { data: transactions } = useQuery<{ results: CoinTransaction[] }>({
    queryKey: ['reward-transactions'],
    queryFn: () => apiClient.get('/rewards/transactions/'),
    enabled: showHistory,
  });

  const redeemMutation = useMutation({
    mutationFn: (tierId: string) =>
      apiClient.post('/rewards/redeem/', { tier_id: tierId }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Redeemed successfully!');
      queryClient.invalidateQueries({ queryKey: ['reward-balance'] });
      queryClient.invalidateQueries({ queryKey: ['reward-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['usage-quota'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Redemption failed');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const txnList = Array.isArray(transactions) ? transactions : transactions?.results || [];

  return (
    <div className="space-y-6">
      {/* Balance & Streak Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Coin Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Coin Balance
              </p>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-200 mt-1">
                🪙 {summary?.balance || 0}
              </p>
            </div>
            <SparklesIcon className="h-10 w-10 text-yellow-500 opacity-60" />
          </div>
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
            {summary?.total_earned || 0} earned total
          </p>
        </motion.div>

        {/* Streak */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                Daily Streak
              </p>
              <p className="text-3xl font-bold text-orange-900 dark:text-orange-200 mt-1">
                🔥 {summary?.current_streak || 0}
              </p>
            </div>
            <FireIcon className="h-10 w-10 text-orange-500 opacity-60" />
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-500 mt-2">
            Best: {summary?.longest_streak || 0} days
          </p>
        </motion.div>

        {/* Redeemed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Credits Redeemed
              </p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-200 mt-1">
                🎁 {summary?.total_redeemed || 0}
              </p>
            </div>
            <GiftIcon className="h-10 w-10 text-green-500 opacity-60" />
          </div>
          <p className="text-xs text-green-600 dark:text-green-500 mt-2">
            coins spent on bonus credits
          </p>
        </motion.div>
      </div>

      {/* How to Earn */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <SparklesIcon className="h-5 w-5 mr-2 text-yellow-500" />
          How to Earn Coins
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Use any tool', coins: 10, icon: '🛠️' },
            { label: 'First use of the day', coins: 20, icon: '☀️' },
            { label: 'Try a new tool', coins: 30, icon: '🆕' },
            { label: '3+ day streak', coins: 5, icon: '🔥', suffix: '/day' },
            { label: '7+ day streak', coins: 10, icon: '🔥🔥', suffix: '/day' },
            { label: 'Reach 50 uses', coins: 200, icon: '⭐', once: true },
            { label: 'Reach 100 uses', coins: 500, icon: '🌟', once: true },
            { label: 'Reach 500 uses', coins: 1500, icon: '💫', once: true },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center">
                <span className="text-lg mr-2">{item.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                  +{item.coins}
                </span>
                <span className="text-xs text-gray-500 ml-1">
                  {item.suffix || (item.once ? '(once)' : '')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Redeem Section */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <GiftIcon className="h-5 w-5 mr-2 text-green-500" />
          Redeem Coins for Bonus Credits
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tiers?.map((tier) => {
            const canAfford = (summary?.balance || 0) >= tier.coin_cost;
            return (
              <motion.div
                key={tier.id}
                whileHover={{ scale: 1.02 }}
                className={`relative rounded-xl border-2 p-5 text-center transition-colors ${
                  canAfford
                    ? 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-800'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60'
                }`}
              >
                <div className="text-3xl mb-2">{tier.icon}</div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {tier.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                  {tier.description}
                </p>
                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  🪙 {tier.coin_cost}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400 mb-4">
                  +{tier.bonus_credits} bonus credits
                </div>
                <button
                  onClick={() => setRedeemConfirm({ open: true, tier })}
                  disabled={!canAfford || redeemMutation.isPending}
                  className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    canAfford
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                  }`}
                >
                  {redeemMutation.isPending ? 'Redeeming...' : canAfford ? 'Redeem' : 'Not Enough Coins'}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Achievements */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <TrophyIcon className="h-5 w-5 mr-2 text-purple-500" />
          Achievements
        </h3>
        {summary?.achievements && summary.achievements.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {summary.achievements.map((a, i) => {
              const info = ACHIEVEMENT_LABELS[a.achievement_type] || {
                label: a.achievement_display || a.achievement_type,
                icon: '🏅',
              };
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                >
                  <span className="text-2xl mb-1">{info.icon}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white text-center">
                    {info.label}
                  </span>
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    +{a.coins_awarded} 🪙
                  </span>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <TrophyIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No achievements yet. Keep using tools to unlock them!</p>
          </div>
        )}

        {/* Locked Achievements */}
        {(() => {
          const earned = new Set(summary?.achievements?.map(a => a.achievement_type) || []);
          const locked = Object.entries(ACHIEVEMENT_LABELS).filter(([k]) => !earned.has(k));
          if (locked.length === 0) return null;
          return (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Locked</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {locked.map(([key, info]) => (
                  <div
                    key={key}
                    className="flex flex-col items-center p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-40"
                  >
                    <span className="text-2xl mb-1 grayscale">🔒</span>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center">
                      {info.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Transaction History */}
      <div className="card">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-blue-500" />
            Coin History
          </h3>
          <span className="text-sm text-primary-600 dark:text-primary-400">
            {showHistory ? 'Hide' : 'Show'}
          </span>
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
                {txnList.length > 0 ? (
                  txnList.map((txn: CoinTransaction) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {txn.description || txn.reason_display}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(txn.created_at).toLocaleDateString()} ·{' '}
                          {new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-semibold ${
                            txn.amount > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {txn.amount > 0 ? '+' : ''}{txn.amount} 🪙
                        </span>
                        <p className="text-xs text-gray-400">
                          bal: {txn.balance_after}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No transactions yet
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Redeem Confirmation Modal */}
      <ConfirmModal
        open={redeemConfirm.open}
        onClose={() => setRedeemConfirm({ open: false, tier: null })}
        onConfirm={() => {
          if (redeemConfirm.tier) {
            redeemMutation.mutate(redeemConfirm.tier.id);
            setRedeemConfirm({ open: false, tier: null });
          }
        }}
        title="Redeem Coins"
        message={
          redeemConfirm.tier
            ? `Redeem ${redeemConfirm.tier.coin_cost} coins for ${redeemConfirm.tier.bonus_credits} bonus credits?`
            : ''
        }
        confirmText="Redeem"
        cancelText="Cancel"
        variant="primary"
        icon={<GiftIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />}
        loading={redeemMutation.isPending}
      />
    </div>
  );
};

export default RewardsTab;
