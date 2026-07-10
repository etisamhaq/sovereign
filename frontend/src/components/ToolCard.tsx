import React from 'react';
import { Link } from 'react-router-dom';
import {
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { getToolIcon } from '../utils/toolIcons';

interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  icon: string;
  is_premium: boolean;
  is_implemented: boolean;
  usage_count: number;
  external_url?: string;
  user_has_access: boolean;
}

interface ToolCardProps {
  tool: Tool;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const { isAuthenticated } = useAuthStore();
  const Icon = getToolIcon(tool.icon);

  const canUseTool = tool.user_has_access;

  return (
    <div className={`card h-full flex flex-col ${!canUseTool ? 'opacity-90' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${canUseTool ? 'bg-primary-100 dark:bg-primary-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
          <Icon className={`h-6 w-6 ${canUseTool ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`} />
        </div>
        <div className="flex gap-2">
          {!tool.is_implemented && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              Coming Soon
            </span>
          )}
          {tool.is_premium && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              ⭐ Pro
            </span>
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {tool.name}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">
        {tool.description}
      </p>

      <div className="mt-auto">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Used {tool.usage_count.toLocaleString()} times
        </div>

        {!tool.is_implemented ? (
          <button
            disabled
            className="btn btn-secondary w-full opacity-75 cursor-not-allowed"
          >
            Coming Soon
          </button>
        ) : !isAuthenticated ? (
          <Link
            to="/login"
            className="btn btn-primary w-full text-center"
          >
            Login to Use
          </Link>
        ) : canUseTool ? (
          tool.external_url ? (
            <a
              href={tool.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full text-center"
            >
              Use Tool
            </a>
          ) : (
            <Link
              to={`/tools/${tool.slug}`}
              className="btn btn-primary w-full text-center"
            >
              Use Tool
            </Link>
          )
        ) : (
          <div className="relative">
            <Link
              to="/pricing"
              className="btn btn-secondary w-full flex items-center justify-center"
            >
              <LockClosedIcon className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolCard;