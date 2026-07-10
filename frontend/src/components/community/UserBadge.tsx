import React from 'react';
import { Author } from '../../services/community';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

interface UserBadgeProps {
  author: Author;
  size?: 'sm' | 'md' | 'lg';
  showPostCount?: boolean;
}

const UserBadge: React.FC<UserBadgeProps> = ({ author, size = 'md', showPostCount = false }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex items-center gap-2">
      {author.avatar ? (
        <img
          src={author.avatar}
          alt={author.display_name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {author.display_name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className={`font-medium text-gray-900 dark:text-white ${textClasses[size]}`}>
            {author.display_name}
          </span>
          {author.is_pro && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
              PRO
            </span>
          )}
          {author.is_staff && (
            <CheckBadgeIcon className="h-4 w-4 text-blue-500" title="Admin" />
          )}
        </div>
        {showPostCount && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {author.post_count} {author.post_count === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>
    </div>
  );
};

export default UserBadge;
