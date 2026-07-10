from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid
import json

User = get_user_model()


class Tool(models.Model):
    TOOL_CATEGORIES = (
        ('writing', 'Writing Tools'),
        ('education', 'Education Tools'),
        ('seo', 'SEO Tools'),
        ('utility', 'Utility Tools'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=TOOL_CATEGORIES)
    icon = models.CharField(max_length=50, help_text="Icon class name")

    is_active = models.BooleanField(default=True)
    is_premium = models.BooleanField(default=False)
    is_implemented = models.BooleanField(default=True, help_text="Whether the tool has been implemented")
    external_url = models.URLField(max_length=500, blank=True, null=True, help_text="External URL for third-party tools")

    # SEO fields
    meta_title = models.CharField(max_length=70, blank=True, default='', help_text="SEO title (max 70 chars). Leave blank to auto-generate.")
    meta_description = models.TextField(max_length=160, blank=True, default='', help_text="SEO meta description (max 160 chars)")
    keywords = models.CharField(max_length=500, blank=True, default='', help_text="Comma-separated SEO keywords")
    long_description = models.TextField(blank=True, default='', help_text="Extended description for SEO landing pages (supports markdown)")

    # Configuration
    config = models.JSONField(default=dict, blank=True)

    # Stats
    usage_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tools'
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return self.name

    def increment_usage(self):
        from django.db.models import F
        Tool.objects.filter(pk=self.pk).update(usage_count=F('usage_count') + 1)
        self.refresh_from_db(fields=['usage_count'])


class ToolUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tool_usages')
    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name='usages')

    # Input/Output
    input_data = models.JSONField()
    output_data = models.JSONField(null=True, blank=True)

    # Metadata
    processing_time = models.FloatField(null=True, blank=True, help_text="Processing time in seconds")
    tokens_used = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tool_usages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['tool', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.tool.name} - {self.created_at}"


class Document(models.Model):
    DOCUMENT_TYPES = (
        ('text', 'Text'),
        ('essay', 'Essay'),
        ('article', 'Article'),
        ('report', 'Report'),
        ('email', 'Email'),
        ('other', 'Other'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')

    title = models.CharField(max_length=500)
    content = models.TextField()
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES, default='text')

    # Metadata
    word_count = models.IntegerField(default=0)
    language = models.CharField(max_length=10, default='en')
    is_public = models.BooleanField(default=False)

    # Related tool usage
    tool_usage = models.ForeignKey(ToolUsage, on_delete=models.SET_NULL, null=True, blank=True)

    # Version control
    version = models.IntegerField(default=1)
    parent_document = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='versions')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'documents'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'updated_at']),
            models.Index(fields=['document_type']),
        ]

    def __str__(self):
        return f"{self.title} - {self.user.email}"

    def calculate_word_count(self):
        self.word_count = len(self.content.split())
        self.save(update_fields=['word_count'])

    def create_version(self):
        new_version = Document.objects.create(
            user=self.user,
            title=self.title,
            content=self.content,
            document_type=self.document_type,
            word_count=self.word_count,
            language=self.language,
            is_public=self.is_public,
            version=self.version + 1,
            parent_document=self if not self.parent_document else self.parent_document
        )
        return new_version


class Template(models.Model):
    TEMPLATE_CATEGORIES = (
        ('business', 'Business'),
        ('academic', 'Academic'),
        ('creative', 'Creative'),
        ('marketing', 'Marketing'),
        ('personal', 'Personal'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=TEMPLATE_CATEGORIES)

    # Template content with placeholders
    content = models.TextField()
    variables = models.JSONField(default=list, help_text="List of variable names in the template")

    # Metadata
    is_premium = models.BooleanField(default=False)
    usage_count = models.IntegerField(default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'templates'
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return self.name

    def increment_usage(self):
        from django.db.models import F
        Template.objects.filter(pk=self.pk).update(usage_count=F('usage_count') + 1)
        self.refresh_from_db(fields=['usage_count'])


class SavedResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_results')
    tool_usage = models.ForeignKey(ToolUsage, on_delete=models.CASCADE)

    title = models.CharField(max_length=500)
    notes = models.TextField(blank=True)
    is_favorite = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'saved_results'
        ordering = ['-created_at']
        unique_together = ['user', 'tool_usage']

    def __str__(self):
        return f"{self.title} - {self.user.email}"


class SavedRoadmap(models.Model):
    """Saved learning roadmaps that users can track progress on"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_roadmaps')

    title = models.CharField(max_length=500)
    goal = models.TextField(blank=True)
    skill_level = models.CharField(max_length=20, blank=True)
    roadmap_data = models.JSONField(default=dict, help_text="Full roadmap JSON data")

    # Progress tracking
    total_phases = models.IntegerField(default=0)
    completed_phases = models.IntegerField(default=0)
    phase_progress = models.JSONField(default=dict, blank=True, help_text="Per-phase completion status")

    is_favorite = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'saved_roadmaps'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'updated_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.user.email}"

    @property
    def progress_percentage(self):
        if self.total_phases == 0:
            return 0
        return int((self.completed_phases / self.total_phases) * 100)


class SavedDecisionMatrix(models.Model):
    """Saved decision matrices that users can revisit and compare"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_matrices')

    title = models.CharField(max_length=500)
    topic = models.TextField(blank=True)
    matrix_data = models.JSONField(default=dict, help_text="Full decision matrix JSON data")

    # Quick-access metadata
    winner = models.CharField(max_length=300, blank=True)
    options_count = models.IntegerField(default=0)
    criteria_count = models.IntegerField(default=0)

    is_favorite = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'saved_decision_matrices'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'updated_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.user.email}"


class SavedItinerary(models.Model):
    """Saved travel itineraries that users can revisit and share"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_itineraries')

    title = models.CharField(max_length=500)
    destination = models.CharField(max_length=300, blank=True)
    itinerary_data = models.JSONField(default=dict, help_text="Full itinerary JSON data")

    # Quick-access metadata
    duration = models.CharField(max_length=50, blank=True)
    budget = models.CharField(max_length=100, blank=True)
    total_days = models.IntegerField(default=0)

    is_favorite = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'saved_itineraries'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'updated_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.user.email}"


class SharedResult(models.Model):
    """Publicly shareable tool results via a unique URL."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_results')

    title = models.CharField(max_length=500, default='Sovereign Result')
    tool_name = models.CharField(max_length=200, blank=True)
    content = models.TextField()
    view_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shared_results'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['share_id']),
        ]

    def __str__(self):
        return f"{self.title} — shared by {self.user.email}"


class MarketplaceTool(models.Model):
    """External tools listed in Sovereign Marketplace."""
    MODERATION_STATUS = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField()
    category = models.CharField(max_length=50, default='general')
    external_url = models.URLField(max_length=500)
    icon = models.CharField(max_length=50, default='sparkles')

    # Pricing / merchandising
    is_free = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)

    # Trust metadata
    owner_name = models.CharField(max_length=200, blank=True)
    owner_website = models.URLField(max_length=500, blank=True)
    owner_email = models.EmailField(blank=True)
    verified = models.BooleanField(default=False)
    uptime_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)

    # Moderation
    moderation_status = models.CharField(max_length=20, choices=MODERATION_STATUS, default='pending')
    moderation_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_marketplace_tools'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketplace_tools'
        ordering = ['sort_order', '-is_featured', '-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['moderation_status', 'is_active']),
            models.Index(fields=['category']),
            models.Index(fields=['is_featured']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.name


class MarketplaceSubmission(models.Model):
    """Future user-submitted marketplace tools (moderated)."""
    MODERATION_STATUS = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='marketplace_submissions')

    tool_name = models.CharField(max_length=200)
    tool_url = models.URLField(max_length=500)
    category = models.CharField(max_length=50, default='general')
    description = models.TextField()
    contact_email = models.EmailField(blank=True)

    moderation_status = models.CharField(max_length=20, choices=MODERATION_STATUS, default='pending')
    moderation_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_marketplace_submissions'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketplace_submissions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['submitted_by', '-created_at']),
            models.Index(fields=['moderation_status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.tool_name} ({self.moderation_status})"


class MarketplaceToolClick(models.Model):
    """Tracks outbound clicks from marketplace to external tools."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tool = models.ForeignKey(MarketplaceTool, on_delete=models.CASCADE, related_name='clicks')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='marketplace_clicks')

    source = models.CharField(max_length=100, blank=True, default='marketplace')
    referrer_path = models.CharField(max_length=255, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'marketplace_tool_clicks'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tool', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.tool.name} click by {self.user.email if self.user else 'anonymous'}"