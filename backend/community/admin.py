from django.contrib import admin

from .models import (
    Bookmark,
    Category,
    ContentReport,
    Post,
    PostAttachment,
    PostLike,
    Reply,
    ReplyLike,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'is_active', 'get_post_count')
    list_filter = ('is_active',)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('order',)

    @admin.display(description='Posts')
    def get_post_count(self, obj):
        return obj.posts.filter(is_deleted=False).count()


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'author',
        'category',
        'moderation_state',
        'is_pinned',
        'is_locked',
        'views_count',
        'likes_count',
        'replies_count',
        'created_at',
    )
    list_filter = (
        'category',
        'moderation_state',
        'is_pinned',
        'is_locked',
        'is_deleted',
        'created_at',
    )
    search_fields = ('title', 'content', 'author__email')
    prepopulated_fields = {'slug': ('title',)}
    raw_id_fields = ('author',)
    readonly_fields = ('views_count', 'likes_count', 'replies_count')
    list_editable = ('is_pinned', 'is_locked')
    date_hierarchy = 'created_at'


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'post', 'author', 'is_solution', 'is_deleted',
                    'likes_count', 'created_at')
    list_filter = ('is_solution', 'is_deleted', 'created_at')
    search_fields = ('content', 'author__email', 'post__title')
    raw_id_fields = ('author', 'post', 'parent')


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'created_at')
    raw_id_fields = ('user', 'post')


@admin.register(ReplyLike)
class ReplyLikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'reply', 'created_at')
    raw_id_fields = ('user', 'reply')


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'created_at')
    raw_id_fields = ('user', 'post')


@admin.register(PostAttachment)
class PostAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'kind', 'processing_status', 'byte_size', 'created_at')
    list_filter = ('kind', 'processing_status')
    raw_id_fields = ('post',)


@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'target_type', 'reporter', 'post', 'reply', 'created_at', 'resolved_at')
    list_filter = ('target_type', 'created_at')
    raw_id_fields = ('reporter', 'post', 'reply', 'resolved_by')
