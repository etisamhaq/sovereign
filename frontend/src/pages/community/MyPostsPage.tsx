import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import {
  getMyPosts,
  getMyBookmarks,
  togglePostLike,
  toggleBookmark,
  dedupeCommunityFeedPosts,
} from '../../services/community';
import PostCard from '../../components/community/PostCard';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  BookmarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const MyPostsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  const tab = searchParams.get('tab') || 'posts';
  const [page, setPage] = useState(1);

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['my-community-posts', page],
    queryFn: () => getMyPosts(page),
    enabled: tab === 'posts',
  });

  const { data: bookmarksData, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['my-community-bookmarks', page],
    queryFn: () => getMyBookmarks(page),
    enabled: tab === 'bookmarks',
  });

  const likeMutation = useMutation({
    mutationFn: togglePostLike,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['my-community-bookmarks'] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: toggleBookmark,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['my-community-bookmarks'] });
    },
  });

  const data = tab === 'posts' ? postsData : bookmarksData;
  const isLoading = tab === 'posts' ? postsLoading : bookmarksLoading;

  const displayResults = useMemo(
    () => dedupeCommunityFeedPosts(data?.results ?? []),
    [data?.results]
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sign in required</h2>
          <Link to="/login" className="text-indigo-600 font-medium">Go to Login →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/community"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Community
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Community</h1>
          <Link
            to="/community/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> New Post
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => { setSearchParams({ tab: 'posts' }); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'posts'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <DocumentTextIcon className="h-4 w-4" />
            My Posts
            {postsData && <span className="ml-1 text-xs">({postsData.count})</span>}
          </button>
          <button
            onClick={() => { setSearchParams({ tab: 'bookmarks' }); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'bookmarks'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <BookmarkIcon className="h-4 w-4" />
            Bookmarks
            {bookmarksData && <span className="ml-1 text-xs">({bookmarksData.count})</span>}
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : data && displayResults.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {displayResults.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={(slug) => likeMutation.mutate(slug)}
                onBookmark={(slug) => bookmarkMutation.mutate(slug)}
                isAuthenticated={isAuthenticated}
              />
            ))}

            {(data.next || data.previous) && (
              <div className="flex justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!data.previous}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.next}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="text-center py-16">
            {tab === 'posts' ? (
              <>
                <DocumentTextIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No posts yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Start a conversation in the community!</p>
                <Link
                  to="/community/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  <PlusIcon className="h-5 w-5" /> Create Post
                </Link>
              </>
            ) : (
              <>
                <BookmarkIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No bookmarks</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Bookmark posts you want to read later</p>
                <Link to="/community" className="text-indigo-600 font-medium hover:text-indigo-700">
                  Browse Community →
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPostsPage;
