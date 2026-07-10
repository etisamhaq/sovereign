from django.contrib import admin
from django.utils import timezone
from .models import (
    Tool, ToolUsage, Document, Template, SavedResult, SavedRoadmap, SavedDecisionMatrix, SavedItinerary,
    MarketplaceTool, MarketplaceSubmission, MarketplaceToolClick
)


@admin.register(Tool)
class ToolAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'is_active', 'is_premium', 'is_implemented', 'usage_count', 'updated_at')
    list_filter = ('category', 'is_active', 'is_premium', 'is_implemented')
    search_fields = ('name', 'slug', 'description')
    list_editable = ('is_active', 'is_premium', 'is_implemented')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('id', 'usage_count', 'created_at', 'updated_at')
    ordering = ('category', 'name')
    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'slug', 'description', 'category', 'icon')
        }),
        ('Status', {
            'fields': ('is_active', 'is_premium', 'is_implemented', 'external_url')
        }),
        ('SEO', {
            'fields': ('meta_title', 'meta_description', 'keywords', 'long_description'),
            'classes': ('collapse',),
            'description': 'SEO fields for tool landing pages. Run `manage.py populate_tool_seo` to auto-fill.',
        }),
        ('Config & Stats', {
            'fields': ('config', 'usage_count', 'created_at', 'updated_at')
        }),
    )


@admin.register(ToolUsage)
class ToolUsageAdmin(admin.ModelAdmin):
    list_display = ('user', 'tool', 'processing_time', 'tokens_used', 'has_error', 'created_at')
    list_filter = ('tool__category', 'created_at')
    search_fields = ('user__email', 'tool__name', 'error_message')
    readonly_fields = ('id', 'user', 'tool', 'input_data', 'output_data', 'processing_time', 'tokens_used', 'error_message', 'created_at')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    def has_error(self, obj):
        return bool(obj.error_message)
    has_error.boolean = True
    has_error.short_description = 'Error?'


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'document_type', 'word_count', 'language', 'is_public', 'version', 'updated_at')
    list_filter = ('document_type', 'language', 'is_public')
    search_fields = ('title', 'user__email', 'content')
    readonly_fields = ('id', 'created_at', 'updated_at')
    date_hierarchy = 'updated_at'
    ordering = ('-updated_at',)


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'is_premium', 'usage_count', 'updated_at')
    list_filter = ('category', 'is_premium')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('id', 'usage_count', 'created_at', 'updated_at')
    ordering = ('category', 'name')


@admin.register(SavedResult)
class SavedResultAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_favorite', 'created_at')
    list_filter = ('is_favorite', 'created_at')
    search_fields = ('title', 'user__email', 'notes')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(SavedRoadmap)
class SavedRoadmapAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'skill_level', 'total_phases', 'completed_phases', 'is_favorite', 'updated_at')
    list_filter = ('skill_level', 'is_favorite', 'created_at')
    search_fields = ('title', 'user__email', 'goal')
    readonly_fields = ('id', 'created_at', 'updated_at')
    date_hierarchy = 'created_at'
    ordering = ('-updated_at',)


@admin.register(SavedDecisionMatrix)
class SavedDecisionMatrixAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'winner', 'options_count', 'criteria_count', 'is_favorite', 'updated_at')
    list_filter = ('is_favorite', 'created_at')
    search_fields = ('title', 'user__email', 'topic', 'winner')
    readonly_fields = ('id', 'created_at', 'updated_at')
    date_hierarchy = 'created_at'
    ordering = ('-updated_at',)


@admin.register(SavedItinerary)
class SavedItineraryAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'destination', 'duration', 'total_days', 'is_favorite', 'updated_at')
    list_filter = ('is_favorite', 'created_at')
    search_fields = ('title', 'user__email', 'destination')
    readonly_fields = ('id', 'created_at', 'updated_at')
    date_hierarchy = 'created_at'
    ordering = ('-updated_at',)


@admin.action(description='Approve selected marketplace tools')
def approve_marketplace_tools(modeladmin, request, queryset):
    queryset.update(moderation_status='approved', reviewed_by=request.user, reviewed_at=timezone.now())


@admin.action(description='Reject selected marketplace tools')
def reject_marketplace_tools(modeladmin, request, queryset):
    queryset.update(moderation_status='rejected', reviewed_by=request.user, reviewed_at=timezone.now())


@admin.register(MarketplaceTool)
class MarketplaceToolAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'slug', 'category', 'is_free', 'is_featured', 'verified',
        'moderation_status', 'last_reviewed_at', 'updated_at'
    )
    list_filter = ('category', 'is_free', 'is_featured', 'verified', 'moderation_status', 'is_active')
    search_fields = ('name', 'slug', 'description', 'owner_name', 'owner_email')
    list_editable = ('is_featured', 'verified')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('id', 'created_at', 'updated_at', 'reviewed_at')
    actions = [approve_marketplace_tools, reject_marketplace_tools]
    ordering = ('sort_order', '-is_featured', '-created_at')
    fieldsets = (
        ('Core', {
            'fields': ('id', 'name', 'slug', 'description', 'category', 'external_url', 'icon')
        }),
        ('Visibility & Pricing', {
            'fields': ('is_free', 'is_featured', 'sort_order', 'is_active')
        }),
        ('Trust Metadata', {
            'fields': ('owner_name', 'owner_website', 'owner_email', 'verified', 'uptime_percentage', 'last_reviewed_at')
        }),
        ('Moderation', {
            'fields': ('moderation_status', 'moderation_notes', 'reviewed_by', 'reviewed_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.action(description='Approve selected submissions')
def approve_submissions(modeladmin, request, queryset):
    queryset.update(moderation_status='approved', reviewed_by=request.user, reviewed_at=timezone.now())


@admin.action(description='Reject selected submissions')
def reject_submissions(modeladmin, request, queryset):
    queryset.update(moderation_status='rejected', reviewed_by=request.user, reviewed_at=timezone.now())


@admin.register(MarketplaceSubmission)
class MarketplaceSubmissionAdmin(admin.ModelAdmin):
    list_display = ('tool_name', 'submitted_by', 'category', 'moderation_status', 'created_at')
    list_filter = ('category', 'moderation_status', 'created_at')
    search_fields = ('tool_name', 'tool_url', 'description', 'submitted_by__email')
    readonly_fields = ('id', 'submitted_by', 'created_at', 'updated_at', 'reviewed_at')
    actions = [approve_submissions, reject_submissions]
    ordering = ('-created_at',)


@admin.register(MarketplaceToolClick)
class MarketplaceToolClickAdmin(admin.ModelAdmin):
    list_display = ('tool', 'user', 'source', 'referrer_path', 'created_at')
    list_filter = ('tool', 'source', 'created_at')
    search_fields = ('tool__name', 'user__email', 'referrer_path')
    readonly_fields = ('id', 'tool', 'user', 'source', 'referrer_path', 'user_agent', 'created_at')
    ordering = ('-created_at',)
