import React from 'react';
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  UsersIcon,
  FireIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { CommunityStats as CommunityStatsType } from '../../services/community';

interface CommunityStatsProps {
  stats: CommunityStatsType;
}

const CommunityStatsBar: React.FC<CommunityStatsProps> = ({ stats }) => {
  const items = [
    { label: 'Members', value: stats.total_members, icon: UsersIcon, color: 'text-blue-500' },
    { label: 'Posts', value: stats.total_posts, icon: DocumentTextIcon, color: 'text-indigo-500' },
    { label: 'Replies', value: stats.total_replies, icon: ChatBubbleLeftRightIcon, color: 'text-purple-500' },
    { label: 'Today', value: stats.posts_today, icon: FireIcon, color: 'text-orange-500' },
    { label: 'Active This Week', value: stats.active_this_week, icon: UserGroupIcon, color: 'text-green-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
        >
          <item.icon className={`h-8 w-8 ${item.color} flex-shrink-0`} />
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {item.value.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommunityStatsBar;
