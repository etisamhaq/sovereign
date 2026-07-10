"""
Unit tests for tools.models — Tool, ToolUsage, Document, Template, SavedResult.
"""
import pytest
from django.contrib.auth import get_user_model
from tools.models import Tool, ToolUsage, Document, Template, SavedResult

User = get_user_model()


@pytest.mark.django_db
class TestToolModel:
    def test_str(self, tool):
        assert str(tool) == "Paraphraser"

    def test_increment_usage(self, tool):
        initial = tool.usage_count
        tool.increment_usage()
        assert tool.usage_count == initial + 1

    def test_tool_defaults(self, tool):
        assert tool.is_active is True
        assert tool.is_premium is False
        assert tool.usage_count == 0

    def test_tool_categories(self, db):
        for cat, _ in Tool.TOOL_CATEGORIES:
            t = Tool.objects.create(
                name=f"Tool {cat}", slug=f"tool-{cat}",
                description="test", category=cat, icon="x",
            )
            assert t.category == cat


@pytest.mark.django_db
class TestToolUsageModel:
    def test_str(self, tool_usage):
        assert tool_usage.user.email in str(tool_usage)
        assert tool_usage.tool.name in str(tool_usage)

    def test_fields(self, tool_usage):
        assert tool_usage.input_data == {"text": "Hello world"}
        assert tool_usage.output_data == {"result": "Hi world"}
        assert tool_usage.processing_time == 1.5
        assert tool_usage.tokens_used == 100


@pytest.mark.django_db
class TestDocumentModel:
    def test_str(self, document):
        assert document.title in str(document)

    def test_calculate_word_count(self, document):
        document.content = "one two three four five"
        document.save()
        document.calculate_word_count()
        assert document.word_count == 5

    def test_create_version(self, document):
        new_ver = document.create_version()
        assert new_ver.version == document.version + 1
        assert new_ver.parent_document == document
        assert new_ver.title == document.title

    def test_document_types(self, user):
        for dtype, _ in Document.DOCUMENT_TYPES:
            d = Document.objects.create(
                user=user, title=f"Doc {dtype}",
                content="test", document_type=dtype,
            )
            assert d.document_type == dtype


@pytest.mark.django_db
class TestTemplateModel:
    def test_str(self, template):
        assert str(template) == "Business Email"

    def test_increment_usage(self, template):
        initial = template.usage_count
        template.increment_usage()
        assert template.usage_count == initial + 1

    def test_variables_stored(self, template):
        assert "name" in template.variables
        assert "body" in template.variables


@pytest.mark.django_db
class TestSavedResultModel:
    def test_str(self, user, tool_usage):
        sr = SavedResult.objects.create(
            user=user, tool_usage=tool_usage,
            title="My saved result",
        )
        assert "My saved result" in str(sr)
        assert user.email in str(sr)

    def test_is_favorite_default(self, user, tool_usage):
        sr = SavedResult.objects.create(
            user=user, tool_usage=tool_usage,
            title="Result",
        )
        assert sr.is_favorite is False

    def test_unique_together(self, user, tool_usage):
        SavedResult.objects.create(user=user, tool_usage=tool_usage, title="First")
        with pytest.raises(Exception):
            SavedResult.objects.create(user=user, tool_usage=tool_usage, title="Dup")
