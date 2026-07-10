"""
Unit tests for tools.views — ToolListView, ToolDetailView, BaseToolView subclasses,
DocumentViewSet, TemplateViewSet, SavedResultViewSet.
"""
import pytest
from unittest.mock import patch, MagicMock
from rest_framework import status
from django.contrib.auth import get_user_model
from tools.models import Tool, Document, Template, SavedResult, ToolUsage

User = get_user_model()


# ── Tool listing / detail ──────────────────────────────────────────

@pytest.mark.django_db
class TestToolListView:
    url = "/api/tools/"

    def test_list_active_tools(self, api_client, tool, inactive_tool):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        slugs = [t["slug"] for t in resp.data]
        assert tool.slug in slugs
        assert inactive_tool.slug not in slugs

    def test_filter_by_category(self, api_client, tool):
        resp = api_client.get(self.url, {"category": "writing"})
        assert resp.status_code == status.HTTP_200_OK
        assert all(t["category"] == "writing" for t in resp.data)

    def test_empty_when_no_active_tools(self, api_client, inactive_tool):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 0


@pytest.mark.django_db
class TestToolDetailView:
    def test_get_detail(self, auth_client, db):
        # Use a slug that doesn't conflict with any specific tool endpoint URL
        detail_tool = Tool.objects.create(
            name="Keyword Density",
            slug="keyword-density",
            description="Analyze keyword density",
            category="seo",
            icon="bar-chart",
            is_active=True,
        )
        resp = auth_client.get(f"/api/tools/{detail_tool.slug}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["slug"] == detail_tool.slug

    def test_inactive_tool_404(self, auth_client, inactive_tool):
        resp = auth_client.get(f"/api/tools/{inactive_tool.slug}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_allowed(self, api_client, db):
        """ToolDetailView uses AllowAny — unauthenticated users can view tool details."""
        detail_tool = Tool.objects.create(
            name="Keyword Density",
            slug="keyword-density",
            description="Analyze keyword density",
            category="seo",
            icon="bar-chart",
            is_active=True,
        )
        resp = api_client.get(f"/api/tools/{detail_tool.slug}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["slug"] == detail_tool.slug


# ── AI-powered tool endpoints ──────────────────────────────────────

@pytest.mark.django_db
class TestParaphraseView:
    url = "/api/tools/paraphrase/"

    @patch("tools.views.AIService")
    def test_paraphrase_success(self, MockAI, auth_client, tool):
        mock_instance = MockAI.return_value
        mock_instance.paraphrase.return_value = "Paraphrased text"
        resp = auth_client.post(self.url, {"text": "Hello world", "mode": "standard"})
        assert resp.status_code == status.HTTP_200_OK
        assert "result" in resp.data or "paraphrased_text" in resp.data or "output" in resp.data

    def test_paraphrase_unauthenticated(self, api_client, tool):
        resp = api_client.post(self.url, {"text": "Hello"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestGrammarCheckView:
    url = "/api/tools/grammar-check/"

    @patch("tools.views.AIService")
    def test_grammar_check_success(self, MockAI, auth_client):
        # Create the tool
        Tool.objects.create(
            name="Grammar Check", slug="grammar-check",
            description="Check grammar", category="writing", icon="check",
        )
        mock_instance = MockAI.return_value
        mock_instance.check_grammar.return_value = {
            "corrected_text": "Hello world.",
            "errors": [],
            "suggestions": [],
        }
        resp = auth_client.post(self.url, {"text": "Hello world"})
        assert resp.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestSummarizerView:
    url = "/api/tools/summarizer/"

    @patch("tools.views.AIService")
    def test_summarize_success(self, MockAI, auth_client):
        Tool.objects.create(
            name="Summarizer", slug="summarizer",
            description="Summarize text", category="writing", icon="compress",
        )
        mock_instance = MockAI.return_value
        mock_instance.summarize.return_value = "Short summary."
        resp = auth_client.post(self.url, {"text": "A very long text " * 50, "length": "short"})
        assert resp.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTitleGeneratorView:
    url = "/api/tools/title-generator/"

    @patch("tools.views.AIService")
    def test_title_generator_success(self, MockAI, auth_client):
        Tool.objects.create(
            name="Title Generator", slug="title-generator",
            description="Generate titles", category="writing", icon="heading",
        )
        mock_instance = MockAI.return_value
        mock_instance.generate_title.return_value = ["Title 1", "Title 2", "Title 3"]
        resp = auth_client.post(self.url, {"content": "Some long content about AI"})
        assert resp.status_code == status.HTTP_200_OK


# ── Document CRUD ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestDocumentViewSet:
    base_url = "/api/tools/documents/"

    def test_list_documents(self, auth_client, document):
        resp = auth_client.get(self.base_url)
        assert resp.status_code == status.HTTP_200_OK

    def test_create_document(self, auth_client):
        data = {
            "title": "New Doc",
            "content": "Some content",
            "document_type": "text",
        }
        resp = auth_client.post(self.base_url, data)
        assert resp.status_code == status.HTTP_201_CREATED
        assert Document.objects.filter(title="New Doc").exists()

    def test_retrieve_document(self, auth_client, document):
        resp = auth_client.get(f"{self.base_url}{document.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["title"] == document.title

    def test_update_document(self, auth_client, document):
        resp = auth_client.patch(f"{self.base_url}{document.id}/", {"title": "Updated"})
        assert resp.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert document.title == "Updated"

    def test_delete_document(self, auth_client, document):
        resp = auth_client.delete(f"{self.base_url}{document.id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not Document.objects.filter(id=document.id).exists()

    def test_other_user_cannot_access(self, api_client, document, second_user):
        api_client.force_authenticate(user=second_user)
        resp = api_client.get(f"{self.base_url}{document.id}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_denied(self, api_client):
        resp = api_client.get(self.base_url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Template CRUD ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestTemplateViewSet:
    base_url = "/api/tools/templates/"

    def test_list_templates(self, auth_client, template):
        resp = auth_client.get(self.base_url)
        assert resp.status_code == status.HTTP_200_OK

    def test_retrieve_template(self, auth_client, template):
        resp = auth_client.get(f"{self.base_url}{template.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["name"] == template.name


# ── Saved Results CRUD ─────────────────────────────────────────────

@pytest.mark.django_db
class TestSavedResultViewSet:
    base_url = "/api/tools/saved-results/"

    def test_list_saved_results(self, auth_client, user, tool_usage):
        SavedResult.objects.create(user=user, tool_usage=tool_usage, title="Saved")
        resp = auth_client.get(self.base_url)
        assert resp.status_code == status.HTTP_200_OK

    def test_create_saved_result(self, auth_client, user, tool_usage):
        data = {
            "tool_usage_id": str(tool_usage.id),
            "title": "My saved result",
        }
        resp = auth_client.post(self.base_url, data, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert SavedResult.objects.filter(title="My saved result").exists()

    def test_create_saved_result_missing_tool_usage(self, auth_client, user):
        data = {"title": "Missing tool usage"}
        resp = auth_client.post(self.base_url, data, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_denied(self, api_client):
        resp = api_client.get(self.base_url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Usage History ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestToolUsageHistoryView:
    url = "/api/tools/usage-history/"

    def test_usage_history_authenticated(self, auth_client, tool_usage):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK

    def test_usage_history_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED
