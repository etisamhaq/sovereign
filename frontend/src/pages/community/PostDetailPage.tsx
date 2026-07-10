import React, { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import { useAuthStore } from '../../store/authStore';
import {
  getPost,
  togglePostLike,
  toggleBookmark,
  createReply,
  toggleReplyLike,
  markSolution,
  updateReply,
  deleteReply,
  deletePost,
  togglePin,
  toggleLock,
  reportCommunityContent,
  moderateApprovePost,
  moderateRejectPost,
} from '../../services/community';
import UserBadge from '../../components/community/UserBadge';
import ReplyCard from '../../components/community/ReplyCard';
import ReplyEditor from '../../components/community/ReplyEditor';
import {
  ArrowLeftIcon,
  HandThumbUpIcon,
  BookmarkIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  MapPinIcon,
  LockClosedIcon,
  PencilIcon,
  TrashIcon,
  ShareIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import {
  HandThumbUpIcon as HandThumbUpSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
} from '@heroicons/react/24/solid';

const PostDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isReplyLoading, setIsReplyLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['community-post', slug],
    queryFn: () => getPost(slug!),
    enabled: !!slug,
  });

  const likeMutation = useMutation({
    mutationFn: () => togglePostLike(slug!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-post', slug] }),
  });

  const bookmarkMutation = useMutation({
    mutationFn: () => toggleBookmark(slug!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-post', slug] }),
  });

  const replyMutation = useMutation({
    mutationFn: (data: { content: string; parent?: string | null }) =>
      createReply(slug!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-post', slug] });
      setReplyingTo(null);
      toast.success('Reply posted!');
    },
    onError: () => toast.error('Failed to post reply'),
  });

  const replyLikeMutation = useMutation({
    mutationFn: toggleReplyLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-post', slug] }),
  });

  const solutionMutation = useMutation({
    mutationFn: markSolution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-post', slug] });
      toast.success('Solution marked!');
    },
  });

  const editReplyMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      updateReply(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-post', slug] });
      toast.success('Reply updated!');
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: deleteReply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-post', slug] });
      toast.success('Reply deleted');
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: () => deletePost(slug!),
    onSuccess: () => {
      toast.success('Post deleted');
      navigate('/community');
    },
  });

  const pinMutation = useMutation({
    mutationFn: () => togglePin(slug!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-post', slug] }),
  });

  const lockMutation = useMutation({
    mutationFn: () => toggleLock(slug!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-post', slug] }),
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) =>
      reportCommunityContent({ reason, post_slug: slug! }),
    onSuccess: () => {
      toast.success('Thanks — we will review this report.');
      setReportOpen(false);
      setReportReason('');
    },
    onError: () => toast.error('Could not submit report'),
  });

  const approveMutation = useMutation({
    mutationFn: () => moderateApprovePost(slug!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-post', slug] });
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      toast.success('Post approved');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => moderateRejectPost(slug!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-post', slug] });
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      toast.success('Post rejected');
    },
  });

  const handleReplySubmit = useCallback((content: string, parentId?: string | null) => {
    setIsReplyLoading(true);
    replyMutation.mutate(
      { content, parent: parentId || null },
      { onSettled: () => setIsReplyLoading(false) }
    );
  }, [replyMutation]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Post not found</h2>
          <Link to="/community" className="text-primary-600 hover:text-primary-700">
            ← Back to Community
          </Link>
        </div>
      </div>
    );
  }

  const isAuthor = user?.id === post.author.id;
  const isAdmin = user?.is_staff;
  const descPreview =
    (post.content && post.content.slice(0, 160)) ||
    'Community discussion on Sovereign';
  const ogImage =
    post.cover_thumbnail_url ||
    post.attachments?.find((a) => a.thumbnail_url || a.url)?.thumbnail_url ||
    post.attachments?.find((a) => a.url)?.url;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet>
        <title>{post.title} | Sovereign Community</title>
        <meta name="description" content={descPreview} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={descPreview} />
        {ogImage && <meta property="og:image" content={ogImage} />}
      </Helmet>
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Report this post
            </h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              placeholder="What is wrong with this content?"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-white mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setReportOpen(false); setReportReason(''); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reportReason.trim() || reportMutation.isPending}
                onClick={() => reportMutation.mutate(reportReason.trim())}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg disabled:opacity-50"
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          to="/community"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Community
        </Link>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8"
        >
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
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
            <Link
              to={`/community?category=${post.category.slug}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80"
              style={{ backgroundColor: `${post.category.color}20`, color: post.category.color }}
            >
              {post.category.icon} {post.category.name}
            </Link>
          </div>

          {post.moderation_state === 'pending' && (
            <div className="mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
              This post is pending review and is only visible to you and moderators.
            </div>
          )}
          {post.moderation_state === 'removed' && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200">
              This post was removed after moderation and is not shown in the public feed.
            </div>
          )}

          {isAdmin && post.moderation_state === 'pending' && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Approve post
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reject this post? It will be hidden from the feed.')) {
                    rejectMutation.mutate();
                  }
                }}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject post
              </button>
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {post.title}
          </h1>

          {/* Author & meta */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <UserBadge author={post.author} size="md" showPostCount />
              <span className="text-sm text-gray-400 dark:text-gray-500">
                {timeAgo(post.created_at)}
                {post.updated_at !== post.created_at && ' (edited)'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
              <EyeIcon className="h-4 w-4" /> {post.views_count} views
            </div>
          </div>

          {post.attachments && post.attachments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {post.attachments.map((att) =>
                att.kind === 'image' ? (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900"
                  >
                    <img
                      src={att.thumbnail_url || att.url}
                      alt={att.alt_text || ''}
                      loading="lazy"
                      className="w-full max-h-[28rem] object-contain"
                    />
                  </a>
                ) : (
                  <div
                    key={att.id}
                    className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black"
                  >
                    <video
                      src={att.url}
                      controls
                      preload="metadata"
                      poster={att.thumbnail_url || undefined}
                      className="w-full max-h-[28rem]"
                    />
                  </div>
                )
              )}
            </div>
          )}

          {/* Content */}
          <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {post.content}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/community?tag=${tag}`}
                  className="text-sm px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { if (!isAuthenticated) { toast.error('Please log in'); return; } likeMutation.mutate(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  post.is_liked
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                }`}
              >
                {post.is_liked ? <HandThumbUpSolidIcon className="h-4 w-4" /> : <HandThumbUpIcon className="h-4 w-4" />}
                {post.likes_count}
              </button>

              <button
                onClick={() => { if (!isAuthenticated) { toast.error('Please log in'); return; } bookmarkMutation.mutate(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  post.is_bookmarked
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                }`}
              >
                {post.is_bookmarked ? <BookmarkSolidIcon className="h-4 w-4" /> : <BookmarkIcon className="h-4 w-4" />}
                Bookmark
              </button>

              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ShareIcon className="h-4 w-4" /> Share
              </button>

              {isAuthenticated && !isAuthor && (
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <FlagIcon className="h-4 w-4" /> Report
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isAuthor && (
                <>
                  <Link
                    to={`/community/edit/${post.slug}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <PencilIcon className="h-4 w-4" /> Edit
                  </Link>
                  <button
                    onClick={() => { if (window.confirm('Delete this post?')) deletePostMutation.mutate(); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" /> Delete
                  </button>
                </>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => pinMutation.mutate()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {post.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => lockMutation.mutate()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {post.is_locked ? 'Unlock' : 'Lock'}
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.article>

        {/* Replies section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ChatBubbleLeftIcon className="h-5 w-5" />
            {post.replies_count} {post.replies_count === 1 ? 'Reply' : 'Replies'}
          </h2>

          {/* Reply editor (top-level) */}
          {isAuthenticated && !post.is_locked && (
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <ReplyEditor
                onSubmit={(content) => handleReplySubmit(content)}
                placeholder="Share your thoughts..."
                isLoading={isReplyLoading}
              />
            </div>
          )}

          {post.is_locked && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              🔒 This post is locked. New replies cannot be added.
            </div>
          )}

          {/* Replies list */}
          <div className="space-y-4">
            {post.replies && post.replies.map((reply) => (
              <div key={reply.id}>
                <ReplyCard
                  reply={reply}
                  isPostAuthor={user?.id === post.author.id}
                  currentUserId={user?.id}
                  isAuthenticated={isAuthenticated}
                  onLike={(id) => {
                    if (!isAuthenticated) { toast.error('Please log in'); return; }
                    replyLikeMutation.mutate(id);
                  }}
                  onMarkSolution={(id) => solutionMutation.mutate(id)}
                  onReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
                  onEdit={(id, content) => editReplyMutation.mutate({ id, content })}
                  onDelete={(id) => {
                    if (window.confirm('Delete this reply?')) deleteReplyMutation.mutate(id);
                  }}
                />
                {/* Inline reply editor for nested replies */}
                {replyingTo === reply.id && (
                  <div className="ml-8 mt-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <ReplyEditor
                      onSubmit={(content) => handleReplySubmit(content, reply.id)}
                      placeholder={`Reply to ${reply.author?.display_name || 'user'}...`}
                      parentAuthor={reply.author?.display_name}
                      isLoading={isReplyLoading}
                      onCancel={() => setReplyingTo(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {(!post.replies || post.replies.length === 0) && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <ChatBubbleLeftIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No replies yet. Be the first to respond!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostDetailPage;
