import React from 'react';
import { Link } from 'react-router-dom';
import { Post } from '../../services/community';
import UserBadge from './UserBadge';
import {
  HandThumbUpIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  BookmarkIcon,
  MapPinIcon,
  LockClosedIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import {
  HandThumbUpIcon as HandThumbUpSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
} from '@heroicons/react/24/solid';

interface PostCardProps {
  post: Post;
  onLike?: (slug: string) => void;
  onBookmark?: (slug: string) => void;
  isAuthenticated?: boolean;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onBookmark, isAuthenticated }) => {
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row gap-4">
        {post.cover_thumbnail_url && (
          <Link
            to={`/community/post/${post.slug}`}
            className="relative shrink-0 w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-600"
          >
            <img
              src={post.cover_thumbnail_url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {post.has_video && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <PlayCircleIcon className="h-10 w-10 text-white drop-shadow-md" />
              </span>
            )}
          </Link>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <MapPinIcon className="h-3 w-3" /> Pinned
              </span>
            )}
            {post.is_locked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                <LockClosedIcon className="h-3 w-3" /> Locked
              </span>
            )}
            {post.moderation_state === 'pending' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Pending review
              </span>
            )}
            {post.moderation_state === 'removed' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                Removed
              </span>
            )}
            <Link
              to={`/community?category=${post.category.slug}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: `${post.category.color}20`,
                color: post.category.color,
              }}
            >
              {post.category.icon} {post.category.name}
            </Link>
          </div>

          <Link
            to={`/community/post/${post.slug}`}
            className="block"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2">
              {post.title}
            </h3>
          </Link>

          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {post.excerpt || post.content}
          </p>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/community?tag=${tag}`}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <UserBadge author={post.author} size="sm" />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {timeAgo(post.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Views */}
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <EyeIcon className="h-4 w-4" />
            {post.views_count}
          </span>

          {/* Replies */}
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <ChatBubbleLeftIcon className="h-4 w-4" />
            {post.replies_count}
          </span>

          {/* Like */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onLike?.(post.slug);
            }}
            className={`flex items-center gap-1 text-xs transition-colors ${
              post.is_liked
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`}
            disabled={!isAuthenticated}
          >
            {post.is_liked ? (
              <HandThumbUpSolidIcon className="h-4 w-4" />
            ) : (
              <HandThumbUpIcon className="h-4 w-4" />
            )}
            {post.likes_count}
          </button>

          {/* Bookmark */}
          {isAuthenticated && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onBookmark?.(post.slug);
              }}
              className={`transition-colors ${
                post.is_bookmarked
                  ? 'text-amber-500'
                  : 'text-gray-400 dark:text-gray-500 hover:text-amber-500'
              }`}
            >
              {post.is_bookmarked ? (
                <BookmarkSolidIcon className="h-4 w-4" />
              ) : (
                <BookmarkIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCard;
