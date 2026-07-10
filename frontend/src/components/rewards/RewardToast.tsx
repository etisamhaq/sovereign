import { toast } from 'react-hot-toast';

interface RewardAward {
  reason: string;
  coins: number;
  label: string;
}

interface RewardData {
  coins_earned: number;
  new_balance: number;
  awards: RewardAward[];
  streak: number;
}

/**
 * Show a custom reward toast after a tool is used successfully.
 * Call this from any tool component when the API response includes `rewards`.
 */
export function showRewardToast(rewards: RewardData) {
  if (!rewards || rewards.coins_earned <= 0) return;

  const lines = rewards.awards.map(
    (a) => `${a.label}: +${a.coins} 🪙`
  );

  toast(
    (t) => (
      <div
        className="flex flex-col cursor-pointer"
        onClick={() => toast.dismiss(t.id)}
      >
        <div className="flex items-center mb-1">
          <span className="text-lg mr-2">🪙</span>
          <span className="font-semibold text-yellow-700 dark:text-yellow-300">
            +{rewards.coins_earned} Coins Earned!
          </span>
        </div>
        <div className="space-y-0.5">
          {lines.map((line, i) => (
            <p key={i} className="text-xs text-gray-600 dark:text-gray-400">
              {line}
            </p>
          ))}
        </div>
        {rewards.streak > 1 && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
            🔥 {rewards.streak}-day streak!
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Balance: {rewards.new_balance} coins
        </p>
      </div>
    ),
    {
      duration: 5000,
      style: {
        background: '#FFFBEB',
        border: '1px solid #FCD34D',
        borderRadius: '12px',
        padding: '12px 16px',
      },
      position: 'top-right',
    }
  );
}

export default showRewardToast;
