"""
Unit tests for research app serializers.
"""
import pytest
from django.utils import timezone

from research.models import (
    ResearchProject, ResearchSource, ResearchFact,
    KnowledgeNode, KnowledgeEdge,
)
from research.serializers import (
    ResearchSourceSerializer,
    ResearchFactSerializer,
    KnowledgeNodeSerializer,
    KnowledgeEdgeSerializer,
    ResearchProjectSerializer,
    ResearchProjectListSerializer,
    CreateResearchProjectSerializer,
    ResearchExportSerializer,
    StartResearchSerializer,
)

pytestmark = pytest.mark.django_db


# ── ResearchSourceSerializer ───────────────────────────────────────

class TestResearchSourceSerializer:
    def test_serializes_all_fields(self, research_project):
        source = ResearchSource.objects.create(
            project=research_project,
            url="https://example.com/article",
            title="Example Article",
            authors=["Author A"],
            content_summary="Summary of the article",
            key_points=["Point 1"],
            source_type="web",
            credibility_score=0.8,
            relevance_score=0.7,
            citation_text="Author A (2025). Example Article.",
        )
        data = ResearchSourceSerializer(source).data
        assert data["id"] == source.id
        assert data["url"] == "https://example.com/article"
        assert data["title"] == "Example Article"
        assert data["authors"] == ["Author A"]
        assert data["content_summary"] == "Summary of the article"
        assert data["key_points"] == ["Point 1"]
        assert data["source_type"] == "web"
        assert float(data["credibility_score"]) == 0.8
        assert float(data["relevance_score"]) == 0.7
        assert data["citation_text"] == "Author A (2025). Example Article."
        assert "created_at" in data


# ── ResearchFactSerializer ─────────────────────────────────────────

class TestResearchFactSerializer:
    def test_serializes_all_fields(self, research_project):
        source = ResearchSource.objects.create(
            project=research_project, url="https://ex.com", title="Src",
            content_summary="s", source_type="web",
        )
        fact = ResearchFact.objects.create(
            project=research_project,
            fact="Important finding about the topic",
            context="Additional context here",
            confidence_level="high",
            confidence_score=0.9,
            is_disputed=False,
            category="statistics",
            tags=["tag1", "tag2"],
        )
        fact.sources.add(source)
        data = ResearchFactSerializer(fact).data
        assert data["id"] == fact.id
        assert data["fact"] == "Important finding about the topic"
        assert data["context"] == "Additional context here"
        assert data["confidence_level"] == "high"
        assert float(data["confidence_score"]) == 0.9
        assert data["is_disputed"] is False
        assert data["category"] == "statistics"
        assert data["tags"] == ["tag1", "tag2"]
        assert len(data["sources"]) == 1
        assert data["sources"][0]["title"] == "Src"


# ── KnowledgeNodeSerializer ───────────────────────────────────────

class TestKnowledgeNodeSerializer:
    def test_serializes_all_fields(self, research_project):
        node = KnowledgeNode.objects.create(
            project=research_project,
            node_id="node-ser-1",
            label="AI Concept",
            node_type="concept",
            description="A concept node",
            importance_score=0.8,
            x_position=1.5,
            y_position=2.5,
            color="#ff0000",
            size=15,
        )
        data = KnowledgeNodeSerializer(node).data
        assert data["node_id"] == "node-ser-1"
        assert data["label"] == "AI Concept"
        assert data["node_type"] == "concept"
        assert data["description"] == "A concept node"
        assert float(data["importance_score"]) == 0.8
        assert float(data["x_position"]) == 1.5
        assert float(data["y_position"]) == 2.5
        assert data["color"] == "#ff0000"
        assert data["size"] == 15


# ── KnowledgeEdgeSerializer ───────────────────────────────────────

class TestKnowledgeEdgeSerializer:
    def test_serializes_all_fields(self, research_project):
        n1 = KnowledgeNode.objects.create(
            project=research_project, node_id="edge-ser-n1",
            label="Source Node", node_type="concept",
        )
        n2 = KnowledgeNode.objects.create(
            project=research_project, node_id="edge-ser-n2",
            label="Target Node", node_type="person",
        )
        edge = KnowledgeEdge.objects.create(
            project=research_project, source_node=n1, target_node=n2,
            relationship_type="causes", strength=0.7, description="Causes relationship",
        )
        data = KnowledgeEdgeSerializer(edge).data
        assert data["source_node"] == n1.id
        assert data["target_node"] == n2.id
        assert data["source_node_label"] == "Source Node"
        assert data["target_node_label"] == "Target Node"
        assert data["relationship_type"] == "causes"
        assert float(data["strength"]) == 0.7
        assert data["description"] == "Causes relationship"


# ── ResearchProjectSerializer ─────────────────────────────────────

class TestResearchProjectSerializer:
    def test_serializes_all_fields(self, research_project):
        data = ResearchProjectSerializer(research_project).data
        assert data["id"] == research_project.id
        assert data["title"] == research_project.title
        assert data["topic"] == research_project.topic
        assert data["depth_level"] == "standard"
        assert data["status"] == "completed"
        assert data["max_sources"] == 10
        assert data["include_academic"] is True
        assert data["include_news"] is True
        assert data["include_web"] is True
        assert data["summary"] == research_project.summary
        assert data["key_findings"] == research_project.key_findings
        assert "sources" in data
        assert "facts" in data
        assert "knowledge_nodes" in data
        assert "knowledge_edges" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "completed_at" in data

    def test_read_only_fields(self):
        serializer = ResearchProjectSerializer()
        read_only = serializer.Meta.read_only_fields
        assert "id" in read_only
        assert "status" in read_only
        assert "summary" in read_only
        assert "key_findings" in read_only
        assert "knowledge_map_data" in read_only
        assert "created_at" in read_only
        assert "updated_at" in read_only
        assert "completed_at" in read_only
        assert "processing_time" in read_only


# ── ResearchProjectListSerializer ─────────────────────────────────

class TestResearchProjectListSerializer:
    def test_serializes_lighter_fields(self, research_project):
        data = ResearchProjectListSerializer(research_project).data
        assert data["id"] == research_project.id
        assert data["title"] == research_project.title
        assert data["topic"] == research_project.topic
        assert data["depth_level"] == "standard"
        assert data["status"] == "completed"
        assert "created_at" in data
        assert "completed_at" in data
        # Should NOT include heavy nested data
        assert "sources" not in data
        assert "facts" not in data
        assert "knowledge_nodes" not in data

    def test_sources_count_and_facts_count(self, research_project):
        ResearchSource.objects.create(
            project=research_project, url="https://a.com", title="S1",
            content_summary="s", source_type="web",
        )
        ResearchFact.objects.create(
            project=research_project, fact="Fact1", confidence_level="high",
        )
        data = ResearchProjectListSerializer(research_project).data
        assert data["sources_count"] == 1
        assert data["facts_count"] == 1


# ── CreateResearchProjectSerializer ───────────────────────────────

class TestCreateResearchProjectSerializer:
    def test_valid_data(self):
        data = {
            "title": "AI Research",
            "topic": "Artificial Intelligence in Healthcare",
            "depth_level": "deep",
            "max_sources": 15,
            "include_academic": True,
            "include_news": False,
            "include_web": True,
        }
        serializer = CreateResearchProjectSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_topic_too_short(self):
        data = {
            "title": "AI",
            "topic": "short",
        }
        serializer = CreateResearchProjectSerializer(data=data)
        assert not serializer.is_valid()
        assert "topic" in serializer.errors

    def test_defaults(self):
        data = {
            "title": "Research",
            "topic": "A sufficiently long topic for validation",
        }
        serializer = CreateResearchProjectSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        # depth_level defaults to 'standard' via the model default,
        # so it may or may not appear in validated_data depending on
        # whether the serializer field has a default or the model field does.
        validated = serializer.validated_data
        assert validated.get("depth_level", "standard") == "standard"

    def test_missing_title(self):
        data = {"topic": "A sufficiently long topic for validation"}
        serializer = CreateResearchProjectSerializer(data=data)
        assert not serializer.is_valid()
        assert "title" in serializer.errors


# ── ResearchExportSerializer ──────────────────────────────────────

class TestResearchExportSerializer:
    def test_read_only_fields(self):
        serializer = ResearchExportSerializer()
        read_only = serializer.Meta.read_only_fields
        assert "id" in read_only
        assert "file_path" in read_only
        assert "file_size" in read_only
        assert "created_at" in read_only


# ── StartResearchSerializer ───────────────────────────────────────

class TestStartResearchSerializer:
    def test_valid_data(self):
        data = {
            "topic": "Machine Learning trends",
            "depth_level": "deep",
            "max_sources": 20,
            "include_academic": True,
            "include_news": False,
            "include_web": True,
        }
        serializer = StartResearchSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_defaults(self):
        data = {"topic": "Some research topic"}
        serializer = StartResearchSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        validated = serializer.validated_data
        assert validated["depth_level"] == "standard"
        assert validated["max_sources"] == 10
        assert validated["include_academic"] is True
        assert validated["include_news"] is True
        assert validated["include_web"] is True

    def test_invalid_depth_level(self):
        data = {"topic": "Topic", "depth_level": "ultra_deep"}
        serializer = StartResearchSerializer(data=data)
        assert not serializer.is_valid()
        assert "depth_level" in serializer.errors

    def test_max_sources_bounds(self):
        # Too low
        data = {"topic": "Topic", "max_sources": 0}
        serializer = StartResearchSerializer(data=data)
        assert not serializer.is_valid()
        assert "max_sources" in serializer.errors

        # Too high
        data = {"topic": "Topic", "max_sources": 100}
        serializer = StartResearchSerializer(data=data)
        assert not serializer.is_valid()
        assert "max_sources" in serializer.errors

    def test_missing_topic(self):
        data = {"depth_level": "quick"}
        serializer = StartResearchSerializer(data=data)
        assert not serializer.is_valid()
        assert "topic" in serializer.errors
