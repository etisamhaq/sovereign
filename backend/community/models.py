import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, db_index=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Emoji or icon name")
    color = models.CharField(max_length=7, default='#6366f1', help_text="Hex color")
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'community_categories'
        ordering = ['order', 'name']
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Post(models.Model):
    class ModerationState(models.TextChoices):
        PUBLISHED = 'published', 'Published'
        PENDING = 'pending', 'Pending review'
        REMOVED = 'removed', 'Removed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='community_posts'
    )
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name='posts'
    )
    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=350, unique=True, db_index=True)
    content = models.TextField()
    tags = models.JSONField(default=list, blank=True)

    moderation_state = models.CharField(
        max_length=20,
        choices=ModerationState.choices,
        default=ModerationState.PUBLISHED,
        db_index=True,
    )

    is_pinned = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    views_count = models.IntegerField(default=0)
    likes_count = models.IntegerField(default=0)
    replies_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'community_posts'
        ordering = ['-is_pinned', '-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['category', '-created_at']),
            models.Index(fields=['-likes_count']),
            models.Index(fields=['author']),
            models.Index(fields=['moderation_state', '-created_at']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title)[:300]
            slug = base_slug
            counter = 1
            while Post.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def update_counts(self):
        self.replies_count = self.replies.filter(is_deleted=False).count()
        self.likes_count = self.post_likes.count()
        self.save(update_fields=['replies_count', 'likes_count'])


class Reply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='replies'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='community_replies'
    )
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children'
    )
    content = models.TextField()
    is_solution = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    likes_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'community_replies'
        ordering = ['-is_solution', 'created_at']
        indexes = [
            models.Index(fields=['post', 'created_at']),
        ]

    def __str__(self):
        return f"Reply by {self.author.email} on {self.post.title[:50]}"

    def update_likes_count(self):
        self.likes_count = self.reply_likes.count()
        self.save(update_fields=['likes_count'])


class PostLike(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='post_likes'
    )
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='post_likes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'community_post_likes'
        unique_together = ('user', 'post')

    def __str__(self):
        return f"{self.user.email} likes {self.post.title[:50]}"


class ReplyLike(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='reply_likes'
    )
    reply = models.ForeignKey(
        Reply, on_delete=models.CASCADE, related_name='reply_likes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'community_reply_likes'
        unique_together = ('user', 'reply')

    def __str__(self):
        return f"{self.user.email} likes reply {self.reply.id}"


class Bookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='bookmarks'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'community_bookmarks'
        unique_together = ('user', 'post')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} bookmarked {self.post.title[:50]}"


def community_attachment_upload_to(instance, filename):
    import os
    import uuid as uuid_lib
    name = os.path.basename(filename)
    pk = instance.pk or uuid_lib.uuid4()
    return f'community/posts/{instance.post_id}/{pk}/{name}'


class PostAttachment(models.Model):
    class Kind(models.TextChoices):
        IMAGE = 'image', 'Image'
        VIDEO = 'video', 'Video'

    class ProcessingStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        READY = 'ready', 'Ready'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='attachments'
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    file = models.FileField(upload_to=community_attachment_upload_to, max_length=512)
    thumbnail = models.ImageField(
        upload_to=community_attachment_upload_to,
        null=True,
        blank=True,
        max_length=512,
    )
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    byte_size = models.PositiveBigIntegerField(default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)
    alt_text = models.CharField(max_length=500, blank=True)
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'community_post_attachments'
        ordering = ['sort_order', 'created_at']
        indexes = [
            models.Index(fields=['post', 'sort_order']),
        ]

    def __str__(self):
        return f'{self.kind} for {self.post_id}'


class ContentReport(models.Model):
    class TargetType(models.TextChoices):
        POST = 'post', 'Post'
        REPLY = 'reply', 'Reply'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_content_reports',
    )
    target_type = models.CharField(max_length=10, choices=TargetType.choices)
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, null=True, blank=True,
        related_name='content_reports',
    )
    reply = models.ForeignKey(
        Reply, on_delete=models.CASCADE, null=True, blank=True,
        related_name='content_reports',
    )
    reason = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_content_reports',
    )

    class Meta:
        db_table = 'community_content_reports'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['post']),
            models.Index(fields=['reply']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(target_type='post', post__isnull=False, reply__isnull=True)
                    | models.Q(
                        target_type='reply',
                        reply__isnull=False,
                        post__isnull=True,
                    )
                ),
                name='community_report_post_xor_reply',
            ),
        ]
