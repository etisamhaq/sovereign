import React, { useState } from 'react';
import { Reply } from '../../services/community';
import UserBadge from './UserBadge';
import {
  HandThumbUpIcon,
  CheckCircleIcon,
  ChatBubbleLeftIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  HandThumbUpIcon as HandThumbUpSolidIcon,
  CheckCircleIcon as CheckCircleSolidIcon,
} from '@heroicons/react/24/solid';

interface ReplyCardProps {
  reply: Reply;
  isPostAuthor: boolean;
  currentUserId?: string;
  isAuthenticated: boolean;
  onLike: (replyId: string) => void;
  onMarkSolution: (replyId: string) => void;
  onReply: (replyId: string) => void;
  onEdit: (replyId: string, content: string) => void;
  onDelete: (replyId: string) => void;
  depth?: number;
}

const ReplyCard: React.FC<ReplyCardProps> = ({
  reply,
  isPostAuthor,
  currentUserId,
  isAuthenticated,
  onLike,
  onMarkSolution,
  onReply,
  onEdit,
  onDelete,
  depth = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);

  const isAuthor = currentUserId && reply.author?.id === currentUserId;

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onEdit(reply.id, editContent.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      <div
        className={`rounded-lg p-4 ${
          reply.is_solution
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-gray-50 dark:bg-gray-800/50'
        }`}
      >
        {/* Solution badge */}
        {reply.is_solution && (
          <div className="flex items-center gap-1.5 mb-2 text-green-600 dark:text-green-400">
            <CheckCircleSolidIcon className="h-5 w-5" />
            <span className="text-sm font-semibold">Accepted Solution</span>
          </div>
        )}

        {/* Author & time */}
        <div className="flex items-center justify-between mb-2">
          {reply.author ? (
            <UserBadge author={reply.author} size="sm" />
          ) : (
            <span className="text-sm text-gray-400 italic">Deleted user</span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {timeAgo(reply.created_at)}
            {reply.updated_at !== reply.created_at && ' (edited)'}
          </span>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mt-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditContent(reply.content); }}
                className="px-3 py-1 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-1">
            {reply.content}
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => onLike(reply.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                reply.is_liked
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              disabled={!isAuthenticated}
            >
              {reply.is_liked ? (
                <HandThumbUpSolidIcon className="h-3.5 w-3.5" />
              ) : (
                <HandThumbUpIcon className="h-3.5 w-3.5" />
              )}
              {reply.likes_count > 0 && reply.likes_count}
            </button>

            {isAuthenticated && depth === 0 && (
              <button
                onClick={() => onReply(reply.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
                Reply
              </button>
            )}

            {isPostAuthor && !reply.is_solution && (
              <button
                onClick={() => onMarkSolution(reply.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              >
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Mark as Solution
              </button>
            )}

            {isAuthor && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => onDelete(reply.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Nested replies */}
      {reply.children && reply.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {reply.children.map((child) => (
            <ReplyCard
              key={child.id}
              reply={child}
              isPostAuthor={isPostAuthor}
              currentUserId={currentUserId}
              isAuthenticated={isAuthenticated}
              onLike={onLike}
              onMarkSolution={onMarkSolution}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReplyCard;
