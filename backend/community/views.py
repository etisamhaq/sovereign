import copy
import hashlib
import json

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, F, Q
from django.db.models.expressions import RawSQL
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Bookmark, Category, Post, PostAttachment, PostLike, Reply, ReplyLike
from .permissions import IsAuthorOrReadOnly, IsPostAuthor, IsStaffUser
from .serializers import (
    CategorySerializer,
    CreateContentReportSerializer,
    CreatePostAttachmentSerializer,
    CreatePostSerializer,
    CreateReplySerializer,
    LeaderboardSerializer,
    PostAttachmentReadSerializer,
    PostDetailSerializer,
    PostListSerializer,
    ReplySerializer,
    UpdatePostSerializer,
)


def _bump_community_post_cache():
    v = cache.get('community:posts_cache_ver')
    if v is None:
        cache.set('community:posts_cache_ver', 2, timeout=None)
    else:
        cache.set('community:posts_cache_ver', v + 1, timeout=None)


def _post_visible_for_user(post, user):
    if post.moderation_state == Post.ModerationState.PUBLISHED:
        return True
    if user.is_authenticated and (
        post.author_id == user.id or user.is_staff
    ):
        return True
    return False


def get_post_for_read(slug, user):
    post = get_object_or_404(
        Post.objects.select_related('author', 'category').prefetch_related(
            'attachments'
        ),
        slug=slug,
        is_deleted=False,
    )
    if not _post_visible_for_user(post, user):
        raise NotFound()
    return post


def get_post_for_interaction(slug, user):
    """Like/bookmark/reply: same visibility as read."""
    return get_post_for_read(slug, user)


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 50


# ─── Categories ─────────────────────────────────────────

class CategoryListView(generics.ListAPIView):
    """List all active categories with post counts."""
    permission_classes = [permissions.AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None  # Categories are a small fixed list; no pagination needed

    def get_queryset(self):
        return Category.objects.filter(is_active=True).annotate(
            post_count=Count(
                'posts',
                filter=Q(
                    posts__is_deleted=False,
                    posts__moderation_state=Post.ModerationState.PUBLISHED,
                ),
            )
        ).order_by('order')


# ─── Posts ───────────────────────────────────────────────

class PostListView(generics.ListAPIView):
    """List posts with filtering, sorting, and pagination."""
    permission_classes = [permissions.AllowAny]
    serializer_class = PostListSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = Post.objects.filter(
            is_deleted=False,
            moderation_state=Post.ModerationState.PUBLISHED,
        ).select_related('author', 'category').prefetch_related('attachments')

        # Filter by category slug
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__slug=category)

        # Filter by tag
        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__contains=[tag])

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(content__icontains=search)
            )

        # Sort
        sort = self.request.query_params.get('sort', 'latest')
        if sort == 'popular':
            queryset = queryset.order_by('-is_pinned', '-likes_count', '-created_at')
        elif sort == 'unanswered':
            queryset = queryset.filter(replies_count=0).order_by('-created_at')
        elif sort == 'most-viewed':
            queryset = queryset.order_by('-is_pinned', '-views_count', '-created_at')
        elif sort == 'trending' and connection.vendor == 'postgresql':
            hot_sql = (
                "(community_posts.likes_count * 2 + community_posts.replies_count * 3 "
                "+ community_posts.views_count * 0.1) / POWER(GREATEST("
                "EXTRACT(EPOCH FROM (NOW() - community_posts.created_at))/3600.0, 0.5), 1.5)"
            )
            queryset = queryset.annotate(_hot_score=RawSQL(hot_sql, [])).order_by(
                '-is_pinned', '-_hot_score', '-created_at'
            )
        else:
            queryset = queryset.order_by('-is_pinned', '-created_at')

        return queryset

    def list(self, request, *args, **kwargs):
        page = int(request.query_params.get('page', 1) or 1)
        ttl = getattr(settings, 'COMMUNITY_POST_LIST_CACHE_TTL', 45)
        if ttl <= 0 or page != 1:
            return super().list(request, *args, **kwargs)
        cache_dict = {
            'category': request.query_params.get('category') or '',
            'tag': request.query_params.get('tag') or '',
            'search': request.query_params.get('search') or '',
            'sort': request.query_params.get('sort') or 'latest',
            'page_size': request.query_params.get('page_size') or '',
        }
        ver = cache.get('community:posts_cache_ver') or 1
        key_raw = json.dumps(cache_dict, sort_keys=True)
        key = f'community:posts:v{ver}:{hashlib.md5(key_raw.encode()).hexdigest()}'
        cached = cache.get(key)
        if cached is not None:
            return Response(copy.deepcopy(cached))
        response = super().list(request, *args, **kwargs)
        cache.set(key, response.data, timeout=ttl)
        return response


class PostCreateView(generics.CreateAPIView):
    """Create a new post (authenticated users only)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CreatePostSerializer

    def perform_create(self, serializer):
        post = serializer.save()
        # Invalidate list cache for all new posts so feeds stay consistent after publish flow.
        _bump_community_post_cache()


class PostDetailView(generics.RetrieveAPIView):
    """Get a single post with all replies."""
    permission_classes = [permissions.AllowAny]
    serializer_class = PostDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return Post.objects.filter(is_deleted=False).select_related(
            'author', 'category'
        ).prefetch_related('attachments')

    def get_object(self):
        slug = self.kwargs[self.lookup_field]
        return get_post_for_read(slug, self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Increment view count
        Post.objects.filter(pk=instance.pk).update(views_count=F('views_count') + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class PostUpdateView(generics.UpdateAPIView):
    """Update own post."""
    permission_classes = [permissions.IsAuthenticated, IsAuthorOrReadOnly]
    serializer_class = UpdatePostSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return Post.objects.filter(is_deleted=False).prefetch_related('attachments')


class PostDeleteView(APIView):
    """Soft-delete a post (author or admin)."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, slug):
        post = get_object_or_404(Post, slug=slug, is_deleted=False)
        if post.author != request.user and not request.user.is_staff:
            return Response(
                {'error': 'You do not have permission to delete this post.'},
                status=status.HTTP_403_FORBIDDEN
            )
        was_public = post.moderation_state == Post.ModerationState.PUBLISHED
        post.is_deleted = True
        post.save(update_fields=['is_deleted'])
        if was_public:
            _bump_community_post_cache()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PostLikeToggleView(APIView):
    """Toggle like on a post."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        post = get_post_for_interaction(slug, request.user)
        like, created = PostLike.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
            post.likes_count = max(0, post.likes_count - 1)
            post.save(update_fields=['likes_count'])
            return Response({'liked': False, 'likes_count': post.likes_count})
        post.likes_count = post.post_likes.count()
        post.save(update_fields=['likes_count'])
        return Response({'liked': True, 'likes_count': post.likes_count})


class PostBookmarkToggleView(APIView):
    """Toggle bookmark on a post."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        post = get_post_for_interaction(slug, request.user)
        bookmark, created = Bookmark.objects.get_or_create(
            user=request.user, post=post
        )
        if not created:
            bookmark.delete()
            return Response({'bookmarked': False})
        return Response({'bookmarked': True})


# ─── Replies ─────────────────────────────────────────────

class ReplyCreateView(generics.CreateAPIView):
    """Create a reply on a post."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CreateReplySerializer

    def perform_create(self, serializer):
        post = get_post_for_interaction(self.kwargs['slug'], self.request.user)
        if post.is_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("This post is locked and cannot receive new replies.")
        reply = serializer.save(author=self.request.user, post=post)
        # Update post reply count
        post.replies_count = post.replies.filter(is_deleted=False).count()
        post.save(update_fields=['replies_count'])


class ReplyUpdateView(generics.UpdateAPIView):
    """Update own reply."""
    permission_classes = [permissions.IsAuthenticated, IsAuthorOrReadOnly]
    serializer_class = CreateReplySerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return Reply.objects.filter(is_deleted=False)


class ReplyDeleteView(APIView):
    """Soft-delete a reply (author or admin)."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        reply = get_object_or_404(Reply, pk=pk, is_deleted=False)
        if reply.author != request.user and not request.user.is_staff:
            return Response(
                {'error': 'You do not have permission to delete this reply.'},
                status=status.HTTP_403_FORBIDDEN
            )
        reply.is_deleted = True
        reply.save(update_fields=['is_deleted'])
        # Update post reply count
        reply.post.replies_count = reply.post.replies.filter(is_deleted=False).count()
        reply.post.save(update_fields=['replies_count'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReplyLikeToggleView(APIView):
    """Toggle like on a reply."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        reply = get_object_or_404(Reply, pk=pk, is_deleted=False)
        like, created = ReplyLike.objects.get_or_create(
            user=request.user, reply=reply
        )
        if not created:
            like.delete()
            reply.likes_count = max(0, reply.likes_count - 1)
            reply.save(update_fields=['likes_count'])
            return Response({'liked': False, 'likes_count': reply.likes_count})
        reply.likes_count = reply.reply_likes.count()
        reply.save(update_fields=['likes_count'])
        return Response({'liked': True, 'likes_count': reply.likes_count})


class MarkSolutionView(APIView):
    """Mark/unmark a reply as solution (only post author can do this)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        reply = get_object_or_404(Reply, pk=pk, is_deleted=False)
        post = reply.post

        if post.author != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Only the post author can mark a solution.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Toggle solution status
        if reply.is_solution:
            reply.is_solution = False
            reply.save(update_fields=['is_solution'])
            return Response({'is_solution': False})

        # Unmark any existing solution on this post
        Reply.objects.filter(post=post, is_solution=True).update(is_solution=False)
        reply.is_solution = True
        reply.save(update_fields=['is_solution'])
        return Response({'is_solution': True})


# ─── User-specific views ────────────────────────────────

class MyPostsView(generics.ListAPIView):
    """List the authenticated user's posts."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PostListSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        return Post.objects.filter(
            author=self.request.user, is_deleted=False
        ).select_related('author', 'category').prefetch_related(
            'attachments'
        ).order_by('-created_at')


class MyBookmarksView(generics.ListAPIView):
    """List the authenticated user's bookmarked posts."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PostListSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        bookmarked_ids = Bookmark.objects.filter(
            user=self.request.user
        ).values_list('post_id', flat=True)
        return Post.objects.filter(
            id__in=bookmarked_ids, is_deleted=False
        ).select_related('author', 'category').prefetch_related(
            'attachments'
        ).order_by('-created_at')


# ─── Community Stats & Leaderboard ─────────────────────

class CommunityStatsView(APIView):
    """Public community statistics."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from accounts.models import User

        total_posts = Post.objects.filter(
            is_deleted=False,
            moderation_state=Post.ModerationState.PUBLISHED,
        ).count()
        total_replies = Reply.objects.filter(is_deleted=False).count()
        total_members = User.objects.filter(is_active=True).count()

        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        posts_today = Post.objects.filter(
            is_deleted=False,
            moderation_state=Post.ModerationState.PUBLISHED,
            created_at__gte=today,
        ).count()

        # Recent active users in community
        active_authors = Post.objects.filter(
            is_deleted=False,
            moderation_state=Post.ModerationState.PUBLISHED,
            created_at__gte=timezone.now() - timezone.timedelta(days=7),
        ).values('author').distinct().count()

        return Response({
            'total_posts': total_posts,
            'total_replies': total_replies,
            'total_members': total_members,
            'posts_today': posts_today,
            'active_this_week': active_authors,
        })


class LeaderboardView(APIView):
    """Top community contributors."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from accounts.models import User

        # Get users with most community activity
        users = User.objects.filter(
            is_active=True
        ).annotate(
            post_count=Count(
                'community_posts',
                filter=Q(
                    community_posts__is_deleted=False,
                    community_posts__moderation_state=Post.ModerationState.PUBLISHED,
                ),
            ),
            reply_count=Count(
                'community_replies',
                filter=Q(community_replies__is_deleted=False)
            ),
            likes_received=Count(
                'community_posts__post_likes',
                filter=Q(
                    community_posts__is_deleted=False,
                    community_posts__moderation_state=Post.ModerationState.PUBLISHED,
                ),
            ),
        ).annotate(
            total_score=F('post_count') * 3 + F('reply_count') + F('likes_received') * 2
        ).filter(
            total_score__gt=0
        ).order_by('-total_score')[:10]

        results = []
        for user in users:
            full_name = f"{user.first_name} {user.last_name}".strip()
            results.append({
                'id': user.id,
                'display_name': full_name or user.email.split('@')[0],
                'avatar': user.avatar.url if user.avatar else None,
                'is_pro': user.is_pro,
                'post_count': user.post_count,
                'reply_count': user.reply_count,
                'likes_received': user.likes_received,
                'total_score': user.total_score,
            })

        return Response(results)


# ─── Admin actions ───────────────────────────────────────

class PostPinToggleView(APIView):
    """Toggle pin on a post (staff only)."""
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]

    def post(self, request, slug):
        post = get_object_or_404(Post, slug=slug, is_deleted=False)
        post.is_pinned = not post.is_pinned
        post.save(update_fields=['is_pinned'])
        return Response({'is_pinned': post.is_pinned})


class PostLockToggleView(APIView):
    """Toggle lock on a post (staff only)."""
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]

    def post(self, request, slug):
        post = get_object_or_404(Post, slug=slug, is_deleted=False)
        post.is_locked = not post.is_locked
        post.save(update_fields=['is_locked'])
        return Response({'is_locked': post.is_locked})


class PostAttachmentCreateView(APIView):
    """Attach image/video to own post (multipart)."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'community_upload'
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, slug):
        post = get_object_or_404(Post, slug=slug, is_deleted=False)
        if post.author_id != request.user.id:
            return Response(
                {'detail': 'You can only add media to your own posts.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        max_total = getattr(settings, 'COMMUNITY_MAX_ATTACHMENTS_PER_POST', 6)
        max_img = getattr(settings, 'COMMUNITY_MAX_IMAGES_PER_POST', 4)
        max_vid = getattr(settings, 'COMMUNITY_MAX_VIDEOS_PER_POST', 1)
        if post.attachments.count() >= max_total:
            raise ValidationError({'detail': 'Maximum attachments for this post reached.'})
        kind = request.data.get('kind')
        if kind == PostAttachment.Kind.VIDEO:
            if post.attachments.filter(kind=PostAttachment.Kind.VIDEO).count() >= max_vid:
                raise ValidationError({'detail': 'This post already has a video.'})
        elif kind == PostAttachment.Kind.IMAGE:
            if (
                post.attachments.filter(kind=PostAttachment.Kind.IMAGE).count()
                >= max_img
            ):
                raise ValidationError({'detail': 'Maximum images for this post reached.'})

        ser = CreatePostAttachmentSerializer(
            data=request.data,
            context={'request': request},
        )
        ser.is_valid(raise_exception=True)
        attachment = ser.save(post=post)
        out = PostAttachmentReadSerializer(
            attachment, context={'request': request}
        ).data
        return Response(out, status=status.HTTP_201_CREATED)


class PostAttachmentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, slug, pk):
        post = get_object_or_404(Post, slug=slug, is_deleted=False)
        if post.author_id != request.user.id and not request.user.is_staff:
            return Response(status=status.HTTP_403_FORBIDDEN)
        att = get_object_or_404(PostAttachment, pk=pk, post=post)
        att.file.delete(save=False)
        if att.thumbnail:
            att.thumbnail.delete(save=False)
        att.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentReportCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CreateContentReportSerializer


class ModerationPendingPostsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]
    serializer_class = PostListSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        return (
            Post.objects.filter(
                is_deleted=False,
                moderation_state=Post.ModerationState.PENDING,
            )
            .select_related('author', 'category')
            .prefetch_related('attachments')
            .order_by('created_at')
        )


class ModerationPostApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]

    def post(self, request, slug):
        post = get_object_or_404(
            Post,
            slug=slug,
            is_deleted=False,
            moderation_state=Post.ModerationState.PENDING,
        )
        post.moderation_state = Post.ModerationState.PUBLISHED
        post.save(update_fields=['moderation_state'])
        _bump_community_post_cache()
        return Response(
            {'moderation_state': post.moderation_state},
            status=status.HTTP_200_OK,
        )


class ModerationPostRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]

    def post(self, request, slug):
        post = get_object_or_404(
            Post,
            slug=slug,
            is_deleted=False,
            moderation_state=Post.ModerationState.PENDING,
        )
        post.moderation_state = Post.ModerationState.REMOVED
        post.save(update_fields=['moderation_state'])
        return Response(
            {'moderation_state': post.moderation_state},
            status=status.HTTP_200_OK,
        )
