"""
Unit tests for research app models.
"""
import pytest
from datetime import date
from django.utils import timezone

from research.models import (
    ResearchProject, ResearchSource, ResearchFact,
    KnowledgeNode, KnowledgeEdge, ResearchExport,
)

pytestmark = pytest.mark.django_db


# ── ResearchProject ────────────────────────────────────────────────

class TestResearchProject:
    def test_create_project(self, user):
        project = ResearchProject.objects.create(
            user=user,
            title="AI Research",
            topic="Artificial Intelligence in Healthcare",
            depth_level="standard",
        )
        assert project.title == "AI Research"
        assert project.topic == "Artificial Intelligence in Healthcare"
        assert project.depth_level == "standard"
        assert project.status == "pending"
        assert project.max_sources == 10
        assert project.include_academic is True
        assert project.include_news is True
        assert project.include_web is True
        assert project.summary == ""
        assert project.key_findings == []
        assert project.knowledge_map_data == {}
        assert project.completed_at is None
        assert project.processing_time is None

    def test_str_representation(self, research_project):
        expected = f"{research_project.title} - {research_project.user.email}"
        assert str(research_project) == expected

    def test_mark_completed(self, user):
        project = ResearchProject.objects.create(
            user=user,
            title="Research",
            topic="A topic for testing mark completed",
            status="processing",
        )
        assert project.status == "processing"
        assert project.completed_at is None

        project.mark_completed()
        project.refresh_from_db()

        assert project.status == "completed"
        assert project.completed_at is not None

    def test_ordering_by_created_at(self, user):
        p1 = ResearchProject.objects.create(user=user, title="First", topic="Topic one is long enough")
        p2 = ResearchProject.objects.create(user=user, title="Second", topic="Topic two is long enough")
        projects = list(ResearchProject.objects.filter(user=user).order_by('-created_at'))
        assert projects[0].title == "Second"
        assert projects[1].title == "First"

    def test_depth_choices(self, user):
        for depth, _ in ResearchProject.DEPTH_CHOICES:
            p = ResearchProject.objects.create(
                user=user, title=f"Depth {depth}", topic=f"Testing depth level {depth}", depth_level=depth
            )
            assert p.depth_level == depth

    def test_status_choices(self, user):
        for status, _ in ResearchProject.STATUS_CHOICES:
            p = ResearchProject.objects.create(
                user=user, title=f"Status {status}", topic=f"Testing status {status}", status=status
            )
            assert p.status == status

    def test_key_findings_json_field(self, user):
        findings = ["Finding 1", "Finding 2", "Finding 3"]
        project = ResearchProject.objects.create(
            user=user, title="Findings", topic="Test key findings JSON field",
            key_findings=findings,
        )
        project.refresh_from_db()
        assert project.key_findings == findings

    def test_knowledge_map_data_json_field(self, user):
        data = {"nodes": [{"id": "1", "label": "AI"}], "edges": []}
        project = ResearchProject.objects.create(
            user=user, title="Map", topic="Test knowledge map data JSON field",
            knowledge_map_data=data,
        )
        project.refresh_from_db()
        assert project.knowledge_map_data == data


# ── ResearchSource ─────────────────────────────────────────────────

class TestResearchSource:
    def test_create_source(self, research_project):
        source = ResearchSource.objects.create(
            project=research_project,
            url="https://example.com/article",
            title="Example Article",
            content_summary="Summary of the article",
            source_type="web",
        )
        assert source.project == research_project
        assert source.url == "https://example.com/article"
        assert source.title == "Example Article"
        assert source.content_summary == "Summary of the article"
        assert source.source_type == "web"
        assert source.credibility_score == 0.5
        assert source.relevance_score == 0.5
        assert source.authors == []
        assert source.key_points == []

    def test_str_representation(self, research_project):
        source = ResearchSource.objects.create(
            project=research_project,
            url="https://example.com",
            title="Test Source",
            content_summary="summary",
            source_type="academic",
        )
        assert str(source) == "Test Source (academic)"

    def test_source_types(self, research_project):
        for stype, _ in ResearchSource.SOURCE_TYPES:
            source = ResearchSource.objects.create(
                project=research_project,
                url=f"https://example.com/{stype}",
                title=f"Source {stype}",
                content_summary="summary",
                source_type=stype,
            )
            assert source.source_type == stype

    def test_authors_json_field(self, research_project):
        authors = ["Author A", "Author B"]
        source = ResearchSource.objects.create(
            project=research_project,
            url="https://example.com/authors",
            title="Authored Article",
            content_summary="summary",
            source_type="academic",
            authors=authors,
        )
        source.refresh_from_db()
        assert source.authors == authors

    def test_key_points_json_field(self, research_project):
        points = ["Point 1", "Point 2"]
        source = ResearchSource.objects.create(
            project=research_project,
            url="https://example.com/points",
            title="Key Points Article",
            content_summary="summary",
            source_type="web",
            key_points=points,
        )
        source.refresh_from_db()
        assert source.key_points == points

    def test_ordering(self, research_project):
        s1 = ResearchSource.objects.create(
            project=research_project, url="https://a.com", title="Low",
            content_summary="s", source_type="web",
            credibility_score=0.3, relevance_score=0.2,
        )
        s2 = ResearchSource.objects.create(
            project=research_project, url="https://b.com", title="High",
            content_summary="s", source_type="web",
            credibility_score=0.9, relevance_score=0.8,
        )
        sources = list(research_project.sources.all())
        assert sources[0].title == "High"

    def test_cascade_delete(self, research_project):
        ResearchSource.objects.create(
            project=research_project, url="https://ex.com", title="Delete Me",
            content_summary="s", source_type="web",
        )
        project_id = research_project.id
        assert ResearchSource.objects.filter(project_id=project_id).count() >= 1
        research_project.delete()
        assert ResearchSource.objects.filter(project_id=project_id).count() == 0


# ── ResearchFact ───────────────────────────────────────────────────

class TestResearchFact:
    def test_create_fact(self, research_project):
        fact = ResearchFact.objects.create(
            project=research_project,
            fact="AI can diagnose diseases with high accuracy.",
            confidence_level="high",
            confidence_score=0.9,
        )
        assert fact.project == research_project
        assert fact.fact == "AI can diagnose diseases with high accuracy."
        assert fact.confidence_level == "high"
        assert fact.confidence_score == 0.9
        assert fact.is_disputed is False
        assert fact.dispute_details == ""
        assert fact.category == ""
        assert fact.tags == []

    def test_str_representation(self, research_project):
        fact = ResearchFact.objects.create(
            project=research_project,
            fact="A very interesting fact about the world and everything in it that is long enough to truncate.",
            confidence_level="medium",
        )
        expected = f"{fact.fact[:100]}... ({fact.confidence_level})"
        assert str(fact) == expected

    def test_confidence_levels(self, research_project):
        for level, _ in ResearchFact.CONFIDENCE_LEVELS:
            fact = ResearchFact.objects.create(
                project=research_project,
                fact=f"Fact at confidence {level}",
                confidence_level=level,
            )
            assert fact.confidence_level == level

    def test_many_to_many_sources(self, research_project):
        source = ResearchSource.objects.create(
            project=research_project, url="https://ex.com", title="Source",
            content_summary="s", source_type="web",
        )
        fact = ResearchFact.objects.create(
            project=research_project, fact="Fact", confidence_level="high",
        )
        fact.sources.add(source)
        assert source in fact.sources.all()
        assert fact in source.facts.all()

    def test_disputed_fact(self, research_project):
        fact = ResearchFact.objects.create(
            project=research_project,
            fact="Disputed claim",
            confidence_level="disputed",
            is_disputed=True,
            dispute_details="Contradicts other facts",
        )
        assert fact.is_disputed is True
        assert fact.dispute_details == "Contradicts other facts"


# ── KnowledgeNode ──────────────────────────────────────────────────

class TestKnowledgeNode:
    def test_create_node(self, research_project):
        node = KnowledgeNode.objects.create(
            project=research_project,
            node_id="node-001",
            label="Artificial Intelligence",
            node_type="concept",
        )
        assert node.label == "Artificial Intelligence"
        assert node.node_type == "concept"
        assert node.importance_score == 0.5
        assert node.color == "#6366f1"
        assert node.size == 10
        assert node.x_position is None
        assert node.y_position is None

    def test_str_representation(self, research_project):
        node = KnowledgeNode.objects.create(
            project=research_project, node_id="node-str",
            label="Test Node", node_type="person",
        )
        assert str(node) == "Test Node (person)"

    def test_node_types(self, research_project):
        for idx, (ntype, _) in enumerate(KnowledgeNode.NODE_TYPES):
            node = KnowledgeNode.objects.create(
                project=research_project,
                node_id=f"node-type-{idx}",
                label=f"Node {ntype}",
                node_type=ntype,
            )
            assert node.node_type == ntype

    def test_unique_node_id(self, research_project):
        KnowledgeNode.objects.create(
            project=research_project, node_id="unique-1", label="N1", node_type="concept",
        )
        with pytest.raises(Exception):
            KnowledgeNode.objects.create(
                project=research_project, node_id="unique-1", label="N2", node_type="concept",
            )

    def test_related_facts_m2m(self, research_project):
        node = KnowledgeNode.objects.create(
            project=research_project, node_id="node-m2m",
            label="M2M Node", node_type="concept",
        )
        fact = ResearchFact.objects.create(
            project=research_project, fact="A related fact", confidence_level="high",
        )
        node.related_facts.add(fact)
        assert fact in node.related_facts.all()

    def test_related_sources_m2m(self, research_project):
        node = KnowledgeNode.objects.create(
            project=research_project, node_id="node-src-m2m",
            label="Src Node", node_type="concept",
        )
        source = ResearchSource.objects.create(
            project=research_project, url="https://ex.com", title="Src",
            content_summary="s", source_type="web",
        )
        node.related_sources.add(source)
        assert source in node.related_sources.all()


# ── KnowledgeEdge ──────────────────────────────────────────────────

class TestKnowledgeEdge:
    def _make_nodes(self, project):
        n1 = KnowledgeNode.objects.create(
            project=project, node_id="edge-n1", label="Node A", node_type="concept",
        )
        n2 = KnowledgeNode.objects.create(
            project=project, node_id="edge-n2", label="Node B", node_type="concept",
        )
        return n1, n2

    def test_create_edge(self, research_project):
        n1, n2 = self._make_nodes(research_project)
        edge = KnowledgeEdge.objects.create(
            project=research_project,
            source_node=n1,
            target_node=n2,
            relationship_type="related_to",
        )
        assert edge.source_node == n1
        assert edge.target_node == n2
        assert edge.relationship_type == "related_to"
        assert edge.strength == 0.5

    def test_str_representation(self, research_project):
        n1, n2 = self._make_nodes(research_project)
        edge = KnowledgeEdge.objects.create(
            project=research_project, source_node=n1, target_node=n2,
            relationship_type="causes",
        )
        assert str(edge) == "Node A -causes-> Node B"

    def test_relationship_types(self, research_project):
        for idx, (rtype, _) in enumerate(KnowledgeEdge.RELATIONSHIP_TYPES):
            n1 = KnowledgeNode.objects.create(
                project=research_project, node_id=f"rt-s-{idx}",
                label=f"S{idx}", node_type="concept",
            )
            n2 = KnowledgeNode.objects.create(
                project=research_project, node_id=f"rt-t-{idx}",
                label=f"T{idx}", node_type="concept",
            )
            edge = KnowledgeEdge.objects.create(
                project=research_project, source_node=n1, target_node=n2,
                relationship_type=rtype,
            )
            assert edge.relationship_type == rtype

    def test_unique_together(self, research_project):
        n1, n2 = self._make_nodes(research_project)
        KnowledgeEdge.objects.create(
            project=research_project, source_node=n1, target_node=n2,
            relationship_type="related_to",
        )
        with pytest.raises(Exception):
            KnowledgeEdge.objects.create(
                project=research_project, source_node=n1, target_node=n2,
                relationship_type="related_to",
            )


# ── ResearchExport ─────────────────────────────────────────────────

class TestResearchExport:
    def test_create_export(self, research_project):
        export = ResearchExport.objects.create(
            project=research_project,
            format="pdf",
            file_path="/exports/research_1.pdf",
            file_size=12345,
        )
        assert export.project == research_project
        assert export.format == "pdf"
        assert export.file_path == "/exports/research_1.pdf"
        assert export.file_size == 12345
        assert export.include_sources is True
        assert export.include_knowledge_map is True
        assert export.include_facts is True
        assert export.include_citations is True

    def test_str_representation(self, research_project):
        export = ResearchExport.objects.create(
            project=research_project, format="docx",
            file_path="/exports/r.docx", file_size=100,
        )
        assert str(export) == f"{research_project.title} - DOCX"

    def test_format_choices(self, research_project):
        for fmt, _ in ResearchExport.FORMAT_CHOICES:
            export = ResearchExport.objects.create(
                project=research_project, format=fmt,
                file_path=f"/exports/r.{fmt}", file_size=100,
            )
            assert export.format == fmt

    def test_ordering(self, research_project):
        e1 = ResearchExport.objects.create(
            project=research_project, format="pdf",
            file_path="/first.pdf", file_size=100,
        )
        e2 = ResearchExport.objects.create(
            project=research_project, format="json",
            file_path="/second.json", file_size=200,
        )
        exports = list(ResearchExport.objects.filter(project=research_project))
        assert exports[0].format == "json"  # Second created is first (most recent)
