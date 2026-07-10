from django.contrib import admin
from .models import (
    ResearchProject, ResearchSource, ResearchFact, 
    KnowledgeNode, KnowledgeEdge, ResearchExport
)


@admin.register(ResearchProject)
class ResearchProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'depth_level', 'created_at', 'completed_at']
    list_filter = ['status', 'depth_level', 'created_at']
    search_fields = ['title', 'topic', 'user__email']
    readonly_fields = ['created_at', 'updated_at', 'completed_at', 'processing_time']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'title', 'topic', 'depth_level', 'status')
        }),
        ('Research Settings', {
            'fields': ('max_sources', 'include_academic', 'include_news', 'include_web')
        }),
        ('Results', {
            'fields': ('summary', 'key_findings', 'knowledge_map_data'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at', 'completed_at', 'processing_time'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ResearchSource)
class ResearchSourceAdmin(admin.ModelAdmin):
    list_display = ['title', 'source_type', 'credibility_score', 'relevance_score', 'project']
    list_filter = ['source_type', 'credibility_score']
    search_fields = ['title', 'url', 'content_summary']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('project', 'title', 'url', 'source_type')
        }),
        ('Authors & Date', {
            'fields': ('authors', 'publication_date')
        }),
        ('Content', {
            'fields': ('content_summary', 'key_points')
        }),
        ('Scores', {
            'fields': ('credibility_score', 'relevance_score')
        }),
        ('Citation', {
            'fields': ('citation_text', 'bibtex'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ResearchFact)
class ResearchFactAdmin(admin.ModelAdmin):
    list_display = ['fact_preview', 'confidence_level', 'confidence_score', 'is_disputed', 'project']
    list_filter = ['confidence_level', 'is_disputed', 'category']
    search_fields = ['fact', 'context', 'category']
    filter_horizontal = ['sources']
    readonly_fields = ['created_at']
    
    def fact_preview(self, obj):
        return obj.fact[:100] + '...' if len(obj.fact) > 100 else obj.fact
    fact_preview.short_description = 'Fact'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('project', 'fact', 'context')
        }),
        ('Verification', {
            'fields': ('sources', 'confidence_level', 'confidence_score', 'is_disputed', 'dispute_details')
        }),
        ('Categorization', {
            'fields': ('category', 'tags')
        }),
    )


@admin.register(KnowledgeNode)
class KnowledgeNodeAdmin(admin.ModelAdmin):
    list_display = ['label', 'node_type', 'importance_score', 'project']
    list_filter = ['node_type', 'importance_score']
    search_fields = ['label', 'description']
    filter_horizontal = ['related_facts', 'related_sources']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('project', 'node_id', 'label', 'node_type', 'description')
        }),
        ('Scoring', {
            'fields': ('importance_score',)
        }),
        ('Visual Properties', {
            'fields': ('x_position', 'y_position', 'color', 'size'),
            'classes': ('collapse',)
        }),
        ('Relations', {
            'fields': ('related_facts', 'related_sources')
        }),
    )


@admin.register(KnowledgeEdge)
class KnowledgeEdgeAdmin(admin.ModelAdmin):
    list_display = ['source_node', 'relationship_type', 'target_node', 'strength', 'project']
    list_filter = ['relationship_type', 'strength']
    search_fields = ['description', 'source_node__label', 'target_node__label']
    readonly_fields = ['created_at']


@admin.register(ResearchExport)
class ResearchExportAdmin(admin.ModelAdmin):
    list_display = ['project', 'format', 'file_size', 'created_at']
    list_filter = ['format', 'created_at']
    readonly_fields = ['created_at']