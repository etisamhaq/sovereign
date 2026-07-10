import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface RewardSummary {
  balance: number;
  current_streak: number;
}

const CoinDisplay: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  const { data: summary } = useQuery<RewardSummary>({
    queryKey: ['reward-balance'],
    queryFn: () => apiClient.get('/rewards/balance/'),
    enabled: isAuthenticated,
    staleTime: 60000, // cache for 1 minute
    refetchInterval: 120000, // refresh every 2 minutes
  });

  if (!isAuthenticated || !summary) return null;

  return (
    <Link
      to="/profile"
      onClick={() => {
        // Set a flag so ProfilePage opens on Rewards tab
        sessionStorage.setItem('profileTab', 'rewards');
      }}
      className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
      title="Your Coins & Rewards"
    >
      <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
        🪙 {summary.balance}
      </span>
      {summary.current_streak > 0 && (
        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
          🔥 {summary.current_streak}
        </span>
      )}
    </Link>
  );
};

export default CoinDisplay;
