import { apiClient } from './api';

// ─── Types ──────────────────────────────────────────────

export interface Author {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  is_pro: boolean;
  is_staff: boolean;
  display_name: string;
  post_count: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  post_count: number;
}

export interface PostAttachment {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  byte_size: number;
  sort_order: number;
  alt_text: string;
  processing_status: string;
  created_at: string;
}

export interface Post {
  id: string;
  author: Author;
  category: Category;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  tags: string[];
  is_pinned: boolean;
  is_locked: boolean;
  views_count: number;
  likes_count: number;
  replies_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  replies?: Reply[];
  cover_thumbnail_url?: string | null;
  media_count?: number;
  primary_media_type?: string | null;
  has_video?: boolean;
  moderation_state?: string;
  attachments?: PostAttachment[];
  created_at: string;
  updated_at: string;
}

export interface Reply {
  id: string;
  post: string;
  author: Author | null;
  parent: string | null;
  content: string;
  is_solution: boolean;
  is_deleted: boolean;
  likes_count: number;
  is_liked: boolean;
  children: Reply[];
  created_at: string;
  updated_at: string;
}

export interface CommunityStats {
  total_posts: number;
  total_replies: number;
  total_members: number;
  posts_today: number;
  active_this_week: number;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  avatar: string | null;
  is_pro: boolean;
  post_count: number;
  reply_count: number;
  likes_received: number;
  total_score: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CreatePostData {
  title: string;
  content: string;
  category_id: string;
  tags?: string[];
}

export interface CreateReplyData {
  content: string;
  parent?: string | null;
}

const FEED_DEDUPE_SEP = '\u0000';

/**
 * List endpoints return newest first. Collapses accidental duplicate rows
 * (double submit / retries): same id, or same author + title + body with different slugs.
 */
export function dedupeCommunityFeedPosts(posts: Post[]): Post[] {
  const seenIds = new Set<string>();
  const seenBody = new Set<string>();
  const out: Post[] = [];
  for (const post of posts) {
    if (!post || post.id == null) continue;
    const idKey = String(post.id);
    if (seenIds.has(idKey)) continue;
    const authorId =
      post.author && post.author.id != null ? String(post.author.id) : '';
    // List API uses excerpt only; detail uses content — never call .trim() on undefined.
    const bodySnippet = String(post.content ?? post.excerpt ?? '').trim();
    const title = String(post.title ?? '').trim();
    const bodyKey = `${authorId}${FEED_DEDUPE_SEP}${title}${FEED_DEDUPE_SEP}${bodySnippet}`;
    if (seenBody.has(bodyKey)) continue;
    seenIds.add(idKey);
    seenBody.add(bodyKey);
    out.push(post);
  }
  return out;
}

// ─── API Functions ──────────────────────────────────────

// Categories
export const getCategories = () =>
  apiClient.get<Category[]>('/community/categories/');

// Posts
export const getPosts = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiClient.get<PaginatedResponse<Post>>(`/community/posts/${query}`);
};

export const getPost = (slug: string) =>
  apiClient.get<Post>(`/community/posts/${slug}/`);

export const createPost = (data: CreatePostData) =>
  apiClient.post<Post>('/community/posts/create/', data);

export const uploadPostAttachment = (slug: string, form: FormData) =>
  apiClient.postFormData<PostAttachment>(
    `/community/posts/${slug}/attachments/`,
    form
  );

export const deletePostAttachment = (slug: string, attachmentId: string) =>
  apiClient.delete(`/community/posts/${slug}/attachments/${attachmentId}/`);

export interface ReportContentData {
  reason: string;
  post_slug?: string;
  reply_id?: string;
}

export const reportCommunityContent = (data: ReportContentData) =>
  apiClient.post('/community/reports/', data);

export const getModerationPendingPosts = (page?: number) => {
  const query = page ? `?page=${page}` : '';
  return apiClient.get<PaginatedResponse<Post>>(
    `/community/moderation/posts/pending/${query}`
  );
};

export const moderateApprovePost = (slug: string) =>
  apiClient.post<{ moderation_state: string }>(
    `/community/moderation/posts/${slug}/approve/`
  );

export const moderateRejectPost = (slug: string) =>
  apiClient.post<{ moderation_state: string }>(
    `/community/moderation/posts/${slug}/reject/`
  );

export const updatePost = (slug: string, data: Partial<CreatePostData>) =>
  apiClient.put<Post>(`/community/posts/${slug}/update/`, data);

export const deletePost = (slug: string) =>
  apiClient.delete(`/community/posts/${slug}/delete/`);

export const togglePostLike = (slug: string) =>
  apiClient.post<{ liked: boolean; likes_count: number }>(
    `/community/posts/${slug}/like/`
  );

export const toggleBookmark = (slug: string) =>
  apiClient.post<{ bookmarked: boolean }>(
    `/community/posts/${slug}/bookmark/`
  );

// Replies
export const createReply = (postSlug: string, data: CreateReplyData) =>
  apiClient.post<Reply>(`/community/posts/${postSlug}/replies/`, data);

export const updateReply = (replyId: string, data: { content: string }) =>
  apiClient.put<Reply>(`/community/replies/${replyId}/update/`, data);

export const deleteReply = (replyId: string) =>
  apiClient.delete(`/community/replies/${replyId}/delete/`);

export const toggleReplyLike = (replyId: string) =>
  apiClient.post<{ liked: boolean; likes_count: number }>(
    `/community/replies/${replyId}/like/`
  );

export const markSolution = (replyId: string) =>
  apiClient.post<{ is_solution: boolean }>(
    `/community/replies/${replyId}/solution/`
  );

// User-specific
export const getMyPosts = (page?: number) => {
  const query = page ? `?page=${page}` : '';
  return apiClient.get<PaginatedResponse<Post>>(`/community/my/posts/${query}`);
};

export const getMyBookmarks = (page?: number) => {
  const query = page ? `?page=${page}` : '';
  return apiClient.get<PaginatedResponse<Post>>(`/community/my/bookmarks/${query}`);
};

// Stats & Leaderboard
export const getCommunityStats = () =>
  apiClient.get<CommunityStats>('/community/stats/');

export const getLeaderboard = () =>
  apiClient.get<LeaderboardEntry[]>('/community/leaderboard/');

// Admin
export const togglePin = (slug: string) =>
  apiClient.post<{ is_pinned: boolean }>(`/community/posts/${slug}/pin/`);

export const toggleLock = (slug: string) =>
  apiClient.post<{ is_locked: boolean }>(`/community/posts/${slug}/lock/`);
