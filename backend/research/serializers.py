from rest_framework import serializers
from .models import (
    ResearchProject, ResearchSource, ResearchFact,
    KnowledgeNode, KnowledgeEdge, ResearchExport
)


class ResearchSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResearchSource
        fields = [
            'id', 'url', 'title', 'authors', 'publication_date',
            'content_summary', 'key_points', 'source_type',
            'credibility_score', 'relevance_score', 'citation_text',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ResearchFactSerializer(serializers.ModelSerializer):
    sources = ResearchSourceSerializer(many=True, read_only=True)
    
    class Meta:
        model = ResearchFact
        fields = [
            'id', 'fact', 'context', 'sources', 'confidence_level',
            'confidence_score', 'is_disputed', 'dispute_details',
            'category', 'tags', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class KnowledgeNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeNode
        fields = [
            'id', 'node_id', 'label', 'node_type', 'description',
            'importance_score', 'x_position', 'y_position',
            'color', 'size'
        ]
        read_only_fields = ['id']


class KnowledgeEdgeSerializer(serializers.ModelSerializer):
    source_node_label = serializers.CharField(source='source_node.label', read_only=True)
    target_node_label = serializers.CharField(source='target_node.label', read_only=True)
    
    class Meta:
        model = KnowledgeEdge
        fields = [
            'id', 'source_node', 'target_node', 'source_node_label',
            'target_node_label', 'relationship_type', 'strength', 'description'
        ]
        read_only_fields = ['id']


class ResearchProjectSerializer(serializers.ModelSerializer):
    sources = ResearchSourceSerializer(many=True, read_only=True)
    facts = ResearchFactSerializer(many=True, read_only=True)
    knowledge_nodes = KnowledgeNodeSerializer(many=True, read_only=True)
    knowledge_edges = KnowledgeEdgeSerializer(many=True, read_only=True)
    
    class Meta:
        model = ResearchProject
        fields = [
            'id', 'title', 'topic', 'depth_level', 'status',
            'max_sources', 'include_academic', 'include_news', 'include_web',
            'summary', 'key_findings', 'knowledge_map_data',
            'sources', 'facts', 'knowledge_nodes', 'knowledge_edges',
            'created_at', 'updated_at', 'completed_at', 'processing_time'
        ]
        read_only_fields = [
            'id', 'status', 'summary', 'key_findings', 'knowledge_map_data',
            'created_at', 'updated_at', 'completed_at', 'processing_time'
        ]


class ResearchProjectListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list view"""
    sources_count = serializers.IntegerField(source='sources.count', read_only=True)
    facts_count = serializers.IntegerField(source='facts.count', read_only=True)
    
    class Meta:
        model = ResearchProject
        fields = [
            'id', 'title', 'topic', 'depth_level', 'status',
            'sources_count', 'facts_count', 'created_at', 'completed_at'
        ]
        read_only_fields = ['id', 'status', 'created_at', 'completed_at']


class CreateResearchProjectSerializer(serializers.ModelSerializer):
    """Serializer for creating new research projects"""
    class Meta:
        model = ResearchProject
        fields = [
            'title', 'topic', 'depth_level', 'max_sources',
            'include_academic', 'include_news', 'include_web'
        ]
        
    def validate_topic(self, value):
        if len(value) < 10:
            raise serializers.ValidationError("Topic must be at least 10 characters long")
        return value


class ResearchExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResearchExport
        fields = [
            'id', 'format', 'file_path', 'file_size',
            'include_sources', 'include_knowledge_map',
            'include_facts', 'include_citations', 'created_at'
        ]
        read_only_fields = ['id', 'file_path', 'file_size', 'created_at']


class StartResearchSerializer(serializers.Serializer):
    """Serializer for starting research via tools API"""
    topic = serializers.CharField(max_length=500)
    depth_level = serializers.ChoiceField(
        choices=['quick', 'standard', 'deep'],
        default='standard'
    )
    max_sources = serializers.IntegerField(default=10, min_value=1, max_value=50)
    include_academic = serializers.BooleanField(default=True)
    include_news = serializers.BooleanField(default=True)
    include_web = serializers.BooleanField(default=True)