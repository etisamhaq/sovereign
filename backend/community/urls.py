from django.urls import path
from . import views

urlpatterns = [
    # Categories
    path('categories/', views.CategoryListView.as_view(), name='community-categories'),

    # Posts
    path('posts/', views.PostListView.as_view(), name='community-posts'),
    path('posts/create/', views.PostCreateView.as_view(), name='community-post-create'),
    path('posts/<slug:slug>/', views.PostDetailView.as_view(), name='community-post-detail'),
    path('posts/<slug:slug>/update/', views.PostUpdateView.as_view(), name='community-post-update'),
    path('posts/<slug:slug>/delete/', views.PostDeleteView.as_view(), name='community-post-delete'),
    path('posts/<slug:slug>/like/', views.PostLikeToggleView.as_view(), name='community-post-like'),
    path('posts/<slug:slug>/bookmark/', views.PostBookmarkToggleView.as_view(), name='community-post-bookmark'),
    path('posts/<slug:slug>/pin/', views.PostPinToggleView.as_view(), name='community-post-pin'),
    path('posts/<slug:slug>/lock/', views.PostLockToggleView.as_view(), name='community-post-lock'),
    path(
        'posts/<slug:slug>/attachments/',
        views.PostAttachmentCreateView.as_view(),
        name='community-post-attachments',
    ),
    path(
        'posts/<slug:slug>/attachments/<uuid:pk>/',
        views.PostAttachmentDeleteView.as_view(),
        name='community-post-attachment-delete',
    ),

    # Replies
    path('posts/<slug:slug>/replies/', views.ReplyCreateView.as_view(), name='community-reply-create'),
    path('replies/<uuid:pk>/update/', views.ReplyUpdateView.as_view(), name='community-reply-update'),
    path('replies/<uuid:pk>/delete/', views.ReplyDeleteView.as_view(), name='community-reply-delete'),
    path('replies/<uuid:pk>/like/', views.ReplyLikeToggleView.as_view(), name='community-reply-like'),
    path('replies/<uuid:pk>/solution/', views.MarkSolutionView.as_view(), name='community-reply-solution'),

    # User-specific
    path('my/posts/', views.MyPostsView.as_view(), name='community-my-posts'),
    path('my/bookmarks/', views.MyBookmarksView.as_view(), name='community-my-bookmarks'),

    # Stats & Leaderboard
    path('stats/', views.CommunityStatsView.as_view(), name='community-stats'),
    path('leaderboard/', views.LeaderboardView.as_view(), name='community-leaderboard'),

    # Reports & moderation
    path('reports/', views.ContentReportCreateView.as_view(), name='community-report-create'),
    path(
        'moderation/posts/pending/',
        views.ModerationPendingPostsView.as_view(),
        name='community-moderation-pending',
    ),
    path(
        'moderation/posts/<slug:slug>/approve/',
        views.ModerationPostApproveView.as_view(),
        name='community-moderation-approve',
    ),
    path(
        'moderation/posts/<slug:slug>/reject/',
        views.ModerationPostRejectView.as_view(),
        name='community-moderation-reject',
    ),
]
