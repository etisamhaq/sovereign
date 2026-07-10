import React from 'react';
import { LeaderboardEntry } from '../../services/community';
import { TrophyIcon } from '@heroicons/react/24/solid';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries }) => {
  if (!entries || entries.length === 0) {
    return null;
  }

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrophyIcon className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Top Contributors</h3>
      </div>
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div key={entry.id} className="flex items-center gap-3">
            <span className={`text-sm font-bold w-5 text-center ${medalColors[index] || 'text-gray-400 dark:text-gray-500'}`}>
              {index + 1}
            </span>
            {entry.avatar ? (
              <img
                src={entry.avatar}
                alt={entry.display_name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                {entry.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {entry.display_name}
                </span>
                {entry.is_pro && (
                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                    PRO
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {entry.post_count} posts · {entry.likes_received} likes
              </div>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {entry.total_score} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
