import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import {
  getCategories,
  getPosts,
  getCommunityStats,
  getLeaderboard,
  togglePostLike,
  toggleBookmark,
  dedupeCommunityFeedPosts,
  Category,
} from '../../services/community';
import PostCard from '../../components/community/PostCard';
import CategoryCard from '../../components/community/CategoryCard';
import CommunityStatsBar from '../../components/community/CommunityStats';
import Leaderboard from '../../components/community/Leaderboard';
import PostFilters from '../../components/community/PostFilters';
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  ArrowLeftIcon,
  BookmarkIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const CommunityPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  const categorySlug = searchParams.get('category') || '';
  const tagFilter = searchParams.get('tag') || '';
  const [sort, setSort] = useState('latest');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [categorySlug, tagFilter, sort, searchQuery]);

  const { data: categoriesRaw } = useQuery({
    queryKey: ['community-categories'],
    queryFn: getCategories,
    staleTime: 60000,
  });

  // Normalize: backend may return a plain array or paginated {results: [...]}
  const categories: Category[] = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : (categoriesRaw as any)?.results ?? [];

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['community-posts', categorySlug, tagFilter, sort, searchQuery, page],
    queryFn: () => {
      const params: Record<string, string> = { sort, page: String(page) };
      if (categorySlug) params.category = categorySlug;
      if (tagFilter) params.tag = tagFilter;
      if (searchQuery) params.search = searchQuery;
      return getPosts(params);
    },
  });

  const uniquePostResults = useMemo(
    () => dedupeCommunityFeedPosts(postsData?.results ?? []),
    [postsData?.results]
  );

  const { data: stats } = useQuery({
    queryKey: ['community-stats'],
    queryFn: getCommunityStats,
    staleTime: 30000,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['community-leaderboard'],
    queryFn: getLeaderboard,
    staleTime: 60000,
  });

  const likeMutation = useMutation({
    mutationFn: togglePostLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
    onError: () => toast.error('Please log in to like posts'),
  });

  const bookmarkMutation = useMutation({
    mutationFn: toggleBookmark,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
    onError: () => toast.error('Please log in to bookmark posts'),
  });

  const handleLike = useCallback((slug: string) => {
    if (!isAuthenticated) { toast.error('Please log in to like posts'); return; }
    likeMutation.mutate(slug);
  }, [isAuthenticated, likeMutation]);

  const handleBookmark = useCallback((slug: string) => {
    if (!isAuthenticated) { toast.error('Please log in to bookmark posts'); return; }
    bookmarkMutation.mutate(slug);
  }, [isAuthenticated, bookmarkMutation]);

  const handleSearchSubmit = () => setSearchQuery(search);

  const activeCategory = categories.find((c: any) => c.slug === categorySlug);

  const showCategories = !categorySlug && !tagFilter;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex justify-center mb-4">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-indigo-200" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Sovereign Community</h1>
            <p className="text-indigo-200 text-lg max-w-2xl mx-auto">
              Connect with fellow writers, share tips, get help with AI tools, and showcase your work.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/community/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors"
                  >
                    <PlusIcon className="h-5 w-5" /> New Post
                  </Link>
                  <Link
                    to="/community/my-posts"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
                  >
                    <DocumentTextIcon className="h-5 w-5" /> My Posts
                  </Link>
                </>
              ) : (
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors"
                >
                  Join the Community
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <CommunityStatsBar stats={stats} />
          </motion.div>
        )}

        {/* Category / Tag header */}
        {(categorySlug || tagFilter) && (
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={() => { setSearchParams({}); }}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            {activeCategory ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeCategory.icon}</span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {activeCategory.name}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({activeCategory.post_count} posts)
                </span>
              </div>
            ) : tagFilter ? (
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Posts tagged #{tagFilter}
              </h2>
            ) : null}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Categories grid (shown only on main page) */}
            {showCategories && categories.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Browse Categories
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {categories.map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Filters */}
            <PostFilters
              sort={sort}
              onSortChange={setSort}
              search={search}
              onSearchChange={setSearch}
              onSearchSubmit={handleSearchSubmit}
            />

            {/* Posts list */}
            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : postsData && uniquePostResults.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {uniquePostResults.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={handleLike}
                    onBookmark={handleBookmark}
                    isAuthenticated={isAuthenticated}
                  />
                ))}

                {/* Pagination */}
                {(postsData.next || postsData.previous) && (
                  <div className="flex justify-center gap-2 pt-4">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!postsData.previous}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      Page {page}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!postsData.next}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="text-center py-16">
                <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No posts yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Be the first to start a conversation!
                </p>
                {isAuthenticated && (
                  <Link
                    to="/community/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <PlusIcon className="h-5 w-5" /> Create Post
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick actions */}
            {isAuthenticated && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Link
                    to="/community/new"
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" /> New Post
                  </Link>
                  <Link
                    to="/community/my-posts"
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <DocumentTextIcon className="h-4 w-4" /> My Posts
                  </Link>
                  <Link
                    to="/community/my-posts?tab=bookmarks"
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <BookmarkIcon className="h-4 w-4" /> Bookmarks
                  </Link>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {Array.isArray(leaderboard) && leaderboard.length > 0 && (
              <Leaderboard entries={leaderboard} />
            )}

            {/* CTA for non-authenticated */}
            {!isAuthenticated && (
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
                <h3 className="font-semibold mb-2">Join the Community</h3>
                <p className="text-sm text-indigo-100 mb-4">
                  Create an account to post, reply, like, and bookmark content.
                </p>
                <Link
                  to="/register"
                  className="inline-block w-full text-center px-4 py-2.5 text-sm font-semibold bg-white text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
