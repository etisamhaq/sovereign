from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

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
from .utils import absolute_media_url
from .validators import assert_file_size, assert_kind_matches_file


class AuthorSerializer(serializers.Serializer):
    """Lightweight author representation for community posts/replies."""
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    avatar = serializers.ImageField(read_only=True)
    is_pro = serializers.BooleanField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Build display name
        full_name = f"{instance.first_name} {instance.last_name}".strip()
        data['display_name'] = full_name or instance.email.split('@')[0]
        data['post_count'] = instance.community_posts.filter(
            is_deleted=False,
            moderation_state=Post.ModerationState.PUBLISHED,
        ).count()
        return data


class CategorySerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'icon', 'color',
                  'order', 'post_count']
        read_only_fields = ['id', 'slug', 'post_count']


class ReplySerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = Reply
        fields = ['id', 'post', 'author', 'parent', 'content', 'is_solution',
                  'is_deleted', 'likes_count', 'is_liked', 'children',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'is_solution', 'is_deleted',
                           'likes_count', 'created_at', 'updated_at']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return ReplyLike.objects.filter(user=request.user, reply=obj).exists()
        return False

    def get_children(self, obj):
        if obj.parent is not None:
            return []
        children = obj.children.filter(is_deleted=False).select_related('author')
        return ReplySerializer(children, many=True, context=self.context).data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            data['content'] = '[This reply has been deleted]'
            data['author'] = None
        return data


class CreateReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = Reply
        fields = ['content', 'parent']

    def validate_parent(self, value):
        if value and value.parent is not None:
            raise serializers.ValidationError("Cannot nest replies more than one level deep.")
        return value


class PostAttachmentReadSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = PostAttachment
        fields = [
            'id', 'kind', 'url', 'thumbnail_url', 'width', 'height',
            'duration_seconds', 'byte_size', 'sort_order', 'alt_text',
            'processing_status', 'created_at',
        ]
        read_only_fields = fields

    def get_url(self, obj):
        return absolute_media_url(self.context.get('request'), obj.file)

    def get_thumbnail_url(self, obj):
        return absolute_media_url(self.context.get('request'), obj.thumbnail)


def _ordered_attachments(post):
    if hasattr(post, '_prefetched_objects_cache') and 'attachments' in post._prefetched_objects_cache:
        return sorted(
            post.attachments.all(),
            key=lambda a: (a.sort_order, a.created_at),
        )
    return list(
        post.attachments.order_by('sort_order', 'created_at')
    )


class PostListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for post listings."""
    author = AuthorSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    excerpt = serializers.SerializerMethodField()
    cover_thumbnail_url = serializers.SerializerMethodField()
    media_count = serializers.SerializerMethodField()
    primary_media_type = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()
    moderation_state = serializers.CharField(read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'author', 'category', 'title', 'slug', 'excerpt',
                  'tags', 'is_pinned', 'is_locked', 'views_count',
                  'likes_count', 'replies_count', 'is_liked', 'is_bookmarked',
                  'cover_thumbnail_url', 'media_count', 'primary_media_type',
                  'has_video', 'moderation_state',
                  'created_at', 'updated_at']
        read_only_fields = fields

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return PostLike.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return Bookmark.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_excerpt(self, obj):
        if len(obj.content) > 200:
            return obj.content[:200] + '...'
        return obj.content

    def get_cover_thumbnail_url(self, obj):
        request = self.context.get('request')
        for att in _ordered_attachments(obj):
            if att.processing_status == PostAttachment.ProcessingStatus.FAILED:
                continue
            if att.thumbnail:
                return absolute_media_url(request, att.thumbnail)
            if att.kind == PostAttachment.Kind.IMAGE and att.file:
                return absolute_media_url(request, att.file)
        return None

    def get_media_count(self, obj):
        return len(_ordered_attachments(obj))

    def get_primary_media_type(self, obj):
        atts = _ordered_attachments(obj)
        return atts[0].kind if atts else None

    def get_has_video(self, obj):
        return any(
            a.kind == PostAttachment.Kind.VIDEO for a in _ordered_attachments(obj)
        )


class PostDetailSerializer(serializers.ModelSerializer):
    """Full serializer for single post view."""
    author = AuthorSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    cover_thumbnail_url = serializers.SerializerMethodField()
    media_count = serializers.SerializerMethodField()
    primary_media_type = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()
    moderation_state = serializers.CharField(read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'author', 'category', 'title', 'slug', 'content',
                  'tags', 'is_pinned', 'is_locked', 'views_count',
                  'likes_count', 'replies_count', 'is_liked', 'is_bookmarked',
                  'replies', 'attachments', 'cover_thumbnail_url',
                  'media_count', 'primary_media_type', 'has_video',
                  'moderation_state',
                  'created_at', 'updated_at']
        read_only_fields = fields

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return PostLike.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return Bookmark.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_replies(self, obj):
        # Only top-level replies (children are nested inside each)
        top_level = obj.replies.filter(
            parent__isnull=True, is_deleted=False
        ).select_related('author')
        return ReplySerializer(top_level, many=True, context=self.context).data

    def get_attachments(self, obj):
        atts = _ordered_attachments(obj)
        return PostAttachmentReadSerializer(
            atts, many=True, context=self.context
        ).data

    def get_cover_thumbnail_url(self, obj):
        request = self.context.get('request')
        for att in _ordered_attachments(obj):
            if att.processing_status == PostAttachment.ProcessingStatus.FAILED:
                continue
            if att.thumbnail:
                return absolute_media_url(request, att.thumbnail)
            if att.kind == PostAttachment.Kind.IMAGE and att.file:
                return absolute_media_url(request, att.file)
        return None

    def get_media_count(self, obj):
        return len(_ordered_attachments(obj))

    def get_primary_media_type(self, obj):
        atts = _ordered_attachments(obj)
        return atts[0].kind if atts else None

    def get_has_video(self, obj):
        return any(
            a.kind == PostAttachment.Kind.VIDEO for a in _ordered_attachments(obj)
        )


class CreatePostSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(write_only=True)
    id = serializers.UUIDField(read_only=True)
    slug = serializers.SlugField(read_only=True)
    moderation_state = serializers.CharField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id',
            'slug',
            'title',
            'content',
            'tags',
            'category_id',
            'moderation_state',
        ]
        read_only_fields = ['id', 'slug', 'moderation_state']

    def validate_category_id(self, value):
        try:
            Category.objects.get(id=value, is_active=True)
        except Category.DoesNotExist:
            raise serializers.ValidationError("Invalid category.")
        return value

    def validate_title(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError("Title must be at least 5 characters.")
        return value.strip()

    def validate_content(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Content must be at least 10 characters.")
        return value.strip()

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user

        # Free users: max 3 posts per day
        if not user.is_pro and not user.is_staff:
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_count = Post.objects.filter(
                author=user, created_at__gte=today_start, is_deleted=False
            ).count()
            if today_count >= 3:
                raise serializers.ValidationError(
                    "Free users can create up to 3 posts per day. Upgrade to Pro for unlimited posts."
                )
        return attrs

    def create(self, validated_data):
        category_id = validated_data.pop('category_id')
        category = Category.objects.get(id=category_id)
        validated_data['category'] = category
        validated_data['author'] = self.context['request'].user
        if getattr(settings, 'COMMUNITY_MODERATION_NEW_POSTS', False):
            validated_data['moderation_state'] = Post.ModerationState.PENDING
        else:
            validated_data['moderation_state'] = Post.ModerationState.PUBLISHED
        return super().create(validated_data)


class UpdatePostSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(write_only=True, required=False)
    id = serializers.UUIDField(read_only=True)
    slug = serializers.SlugField(read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'slug', 'title', 'content', 'tags', 'category_id']
        read_only_fields = ['id', 'slug']

    def validate_category_id(self, value):
        try:
            Category.objects.get(id=value, is_active=True)
        except Category.DoesNotExist:
            raise serializers.ValidationError("Invalid category.")
        return value

    def update(self, instance, validated_data):
        category_id = validated_data.pop('category_id', None)
        if category_id:
            instance.category = Category.objects.get(id=category_id)
        return super().update(instance, validated_data)


class CreatePostAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostAttachment
        fields = ['file', 'kind', 'alt_text', 'sort_order']

    def validate(self, attrs):
        file_obj = attrs.get('file')
        kind = attrs.get('kind')
        if file_obj and kind:
            assert_file_size(kind, file_obj.size)
            assert_kind_matches_file(kind, file_obj)
            file_obj.seek(0)
        return attrs

    def create(self, validated_data):
        validated_data['byte_size'] = validated_data['file'].size
        att = super().create(validated_data)
        from django.conf import settings
        from .tasks import process_community_attachment

        if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
            process_community_attachment.run(str(att.pk))
        else:
            process_community_attachment.delay(str(att.pk))
        return att


class CreateContentReportSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)
    post_slug = serializers.SlugField(required=False, allow_blank=True)
    reply_id = serializers.UUIDField(required=False)

    def validate(self, attrs):
        slug = (attrs.get('post_slug') or '').strip() or None
        rid = attrs.get('reply_id')
        if bool(slug) == bool(rid):
            raise serializers.ValidationError(
                'Provide exactly one of post_slug or reply_id.'
            )
        if slug:
            try:
                post = Post.objects.get(slug=slug, is_deleted=False)
            except Post.DoesNotExist:
                raise serializers.ValidationError({'post_slug': 'Invalid post.'})
            attrs['_post'] = post
            attrs['_reply'] = None
            attrs['_target_type'] = ContentReport.TargetType.POST
        else:
            try:
                reply = Reply.objects.select_related('post').get(pk=rid, is_deleted=False)
            except Reply.DoesNotExist:
                raise serializers.ValidationError({'reply_id': 'Invalid reply.'})
            attrs['_reply'] = reply
            attrs['_post'] = None
            attrs['_target_type'] = ContentReport.TargetType.REPLY
        return attrs

    def create(self, validated_data):
        return ContentReport.objects.create(
            reporter=self.context['request'].user,
            target_type=validated_data['_target_type'],
            post=validated_data['_post'],
            reply=validated_data['_reply'],
            reason=validated_data['reason'],
        )


class LeaderboardSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()
    avatar = serializers.CharField(allow_null=True)
    is_pro = serializers.BooleanField()
    post_count = serializers.IntegerField()
    reply_count = serializers.IntegerField()
    likes_received = serializers.IntegerField()
    total_score = serializers.IntegerField()
