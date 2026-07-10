from rest_framework import serializers
from django.conf import settings
from .models import (
    Tool, ToolUsage, Document, Template, SavedResult,
    MarketplaceTool, MarketplaceSubmission
)


class ToolSerializer(serializers.ModelSerializer):
    user_has_access = serializers.SerializerMethodField()

    class Meta:
        model = Tool
        fields = [
            'id', 'name', 'slug', 'description', 'category',
            'icon', 'is_active', 'is_premium', 'is_implemented', 'usage_count',
            'external_url', 'user_has_access',
            'meta_title', 'meta_description', 'keywords', 'long_description',
        ]
        read_only_fields = ['id', 'usage_count', 'meta_title', 'meta_description', 'keywords', 'long_description']

    def get_user_has_access(self, obj):
        """Check if the current user has access to this tool."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            # Unauthenticated users only see free tools as accessible
            return not obj.is_premium
        user = request.user
        if user.is_pro:
            return True
        # Free users can access non-premium tools
        return not obj.is_premium


class ToolUsageSerializer(serializers.ModelSerializer):
    tool_name = serializers.CharField(source='tool.name', read_only=True)

    class Meta:
        model = ToolUsage
        fields = [
            'id', 'tool', 'tool_name', 'input_data', 'output_data',
            'processing_time', 'tokens_used', 'error_message', 'created_at'
        ]
        read_only_fields = ['id', 'processing_time', 'tokens_used', 'created_at']


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            'id', 'title', 'content', 'document_type', 'word_count',
            'language', 'is_public', 'version', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'word_count', 'version', 'created_at', 'updated_at']

    def create(self, validated_data):
        document = super().create(validated_data)
        document.calculate_word_count()
        return document


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = [
            'id', 'name', 'slug', 'description', 'category',
            'content', 'variables', 'is_premium', 'usage_count'
        ]
        read_only_fields = ['id', 'slug', 'usage_count']


class SavedResultSerializer(serializers.ModelSerializer):
    tool_usage = ToolUsageSerializer(read_only=True)
    tool_usage_id = serializers.PrimaryKeyRelatedField(
        queryset=ToolUsage.objects.all(), source='tool_usage', write_only=True,
    )

    class Meta:
        model = SavedResult
        fields = [
            'id', 'tool_usage', 'tool_usage_id', 'title', 'notes',
            'is_favorite', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MarketplaceToolSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    trust = serializers.SerializerMethodField()

    class Meta:
        model = MarketplaceTool
        fields = [
            'id', 'name', 'slug', 'description', 'category', 'external_url', 'icon',
            'is_free', 'is_featured', 'owner', 'trust', 'created_at',
        ]

    def get_owner(self, obj):
        return {
            'name': obj.owner_name or 'Unknown',
            'website': obj.owner_website or '',
        }

    def get_trust(self, obj):
        return {
            'verified': obj.verified,
            'last_reviewed_at': obj.last_reviewed_at,
            'uptime_percentage': float(obj.uptime_percentage) if obj.uptime_percentage is not None else None,
        }


class MarketplaceToolDetailSerializer(MarketplaceToolSerializer):
    clicks_count = serializers.IntegerField(read_only=True)

    class Meta(MarketplaceToolSerializer.Meta):
        fields = MarketplaceToolSerializer.Meta.fields + [
            'clicks_count',
            'updated_at',
        ]


class MarketplaceSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketplaceSubmission
        fields = [
            'id', 'tool_name', 'tool_url', 'category', 'description',
            'contact_email', 'moderation_status', 'moderation_notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'moderation_status', 'moderation_notes', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user if request else None
        return MarketplaceSubmission.objects.create(submitted_by=user, **validated_data)


class MarketplaceToolClickSerializer(serializers.Serializer):
    source = serializers.CharField(max_length=100, required=False, default='marketplace')


# Tool-specific serializers
class ParaphraseSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    mode = serializers.ChoiceField(
        choices=['standard', 'formal', 'creative', 'simple', 'expand', 'shorten'],
        default='standard'
    )


class GrammarCheckSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)


class EssayGeneratorSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=500)
    length = serializers.IntegerField(min_value=100, max_value=2000, default=500)
    essay_type = serializers.ChoiceField(
        choices=['argumentative', 'descriptive', 'narrative', 'expository', 'persuasive'],
        default='argumentative'
    )


class SummarizerSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=50000)
    length = serializers.ChoiceField(
        choices=['short', 'medium', 'long', 'bullets'],
        default='medium'
    )


class PlagiarismCheckSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=50000)


class WritingImproverSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    focus = serializers.ChoiceField(
        choices=['clarity', 'conciseness', 'engagement', 'academic', 'business'],
        default='clarity'
    )


class OutlineGeneratorSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=500)
    outline_type = serializers.ChoiceField(
        choices=['essay', 'article', 'report', 'story', 'presentation'],
        default='essay'
    )


class TranslationSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    target_language = serializers.CharField(max_length=50)


class TitleGeneratorSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=5000)
    style = serializers.ChoiceField(
        choices=['engaging', 'academic', 'seo', 'creative', 'professional'],
        default='engaging'
    )


class ToneAnalyzerSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)


class CitationGeneratorSerializer(serializers.Serializer):
    source_info = serializers.DictField(
        child=serializers.CharField(),
        help_text="Dictionary containing source information (title, author, year, url, etc.)"
    )
    style = serializers.ChoiceField(
        choices=['apa', 'mla', 'chicago', 'harvard'],
        default='apa'
    )


class FlashcardGeneratorSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    num_cards = serializers.IntegerField(min_value=1, max_value=50, default=10)


class QuizGeneratorSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    num_questions = serializers.IntegerField(min_value=1, max_value=20, default=5)


class VisiSenseUploadSerializer(serializers.Serializer):
    image = serializers.CharField(help_text="Base64 encoded image data")
    question = serializers.CharField(
        max_length=1000,
        required=False,
        help_text="Question about the image content"
    )
    context = serializers.CharField(
        max_length=500,
        required=False,
        help_text="Additional context about the image"
    )
    language = serializers.CharField(
        max_length=10,
        default='eng',
        required=False,
        help_text="OCR language code (eng, ara, urd, etc.)"
    )


class VisiSenseQuestionSerializer(serializers.Serializer):
    extracted_text = serializers.CharField(help_text="Previously extracted text from image")
    question = serializers.CharField(max_length=1000, help_text="Question about the content")
    chat_history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text="Previous chat messages"
    )


class VisiSenseTranslateSerializer(serializers.Serializer):
    text = serializers.CharField(help_text="Text to translate")
    target_language = serializers.CharField(
        max_length=50,
        default='English',
        help_text="Target language for translation"
    )


class VisiSenseExtractSerializer(serializers.Serializer):
    text = serializers.CharField(help_text="Text to extract information from")
    info_type = serializers.ChoiceField(
        choices=['general', 'definitions', 'numbers', 'names', 'actions', 'questions', 'code'],
        default='general',
        help_text="Type of information to extract"
    )


class VisiSenseSummarySerializer(serializers.Serializer):
    text = serializers.CharField(help_text="Text to summarize")
    summary_type = serializers.ChoiceField(
        choices=['concise', 'detailed', 'bullets', 'academic', 'simplified'],
        default='concise',
        help_text="Type of summary to generate"
    )


class MetaDescriptionSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=10000)
    keywords = serializers.ListField(
        child=serializers.CharField(max_length=50),
        allow_empty=True,
        required=False,
        help_text="List of keywords to include in the meta description"
    )
    tone = serializers.ChoiceField(
        choices=['professional', 'casual', 'urgent', 'informative', 'promotional'],
        default='professional'
    )
    target_length = serializers.IntegerField(
        min_value=120,
        max_value=160,
        default=155,
        help_text="Target character length for the meta description"
    )


# Video Chat Serializers
class VideoChatSerializer(serializers.Serializer):
    """Serializer for video chat interactions"""
    url = serializers.URLField(required=True)
    question = serializers.CharField(required=True, max_length=1000)
    context = serializers.CharField(required=False, max_length=5000)

    def validate_url(self, value):
        valid_domains = ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com']
        if not any(domain in value for domain in valid_domains):
            raise serializers.ValidationError(
                "Please provide a valid video URL from YouTube, Vimeo, or Dailymotion"
            )
        return value


class VideoTranscriptSerializer(serializers.Serializer):
    """Serializer for video transcript generation"""
    url = serializers.URLField(required=True)
    format = serializers.ChoiceField(
        choices=['text', 'segments', 'vtt'],
        default='text',
        required=False
    )


class VideoSummarySerializer(serializers.Serializer):
    """Serializer for video summary generation"""
    url = serializers.URLField(required=True)
    summary_type = serializers.ChoiceField(
        choices=['brief', 'detailed', 'bullet', 'academic'],
        default='brief',
        required=False
    )


class VideoKeyMomentsSerializer(serializers.Serializer):
    """Serializer for extracting key moments"""
    url = serializers.URLField(required=True)
    max_moments = serializers.IntegerField(default=5, min_value=1, max_value=10, required=False)


class LinkedInPostOptimizerSerializer(serializers.Serializer):
    """Serializer for LinkedIn post optimization"""
    content = serializers.CharField(max_length=10000)
    goal = serializers.ChoiceField(
        choices=['engagement', 'brand_awareness', 'lead_generation', 'thought_leadership', 'networking'],
        default='engagement',
        required=False
    )
    tone = serializers.ChoiceField(
        choices=['professional', 'conversational', 'inspirational', 'educational', 'storytelling'],
        default='professional',
        required=False
    )
    include_hashtags = serializers.BooleanField(default=True, required=False)
    include_cta = serializers.BooleanField(default=True, required=False)
    include_emoji = serializers.BooleanField(default=True, required=False)


class KeywordExtractorSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000)
    max_keywords = serializers.IntegerField(min_value=5, max_value=30, default=10)


# ---- Content Repurposer Serializers ---------------------------------

class ContentRepurposerProcessSerializer(serializers.Serializer):
    """Input: YouTube URL *or* audio file upload"""
    url = serializers.URLField(required=False, help_text="YouTube video URL")
    # audio_file handled via request.FILES in the view

    def validate_url(self, value):
        valid_domains = ['youtube.com', 'youtu.be', 'www.youtube.com']
        from urllib.parse import urlparse
        parsed = urlparse(value)
        if not any(domain in parsed.netloc for domain in valid_domains):
            raise serializers.ValidationError(
                "Only YouTube URLs are supported. Please provide a valid YouTube video URL."
            )
        return value

    def validate(self, attrs):
        # At least one input source must be present
        # (audio_file is checked in the view since it comes from request.FILES)
        return attrs


class ContentRepurposerGenerateSerializer(serializers.Serializer):
    """Generate platform-specific content from transcript + insights"""
    transcript = serializers.CharField(required=True)
    insights = serializers.JSONField(required=True)
    source_title = serializers.CharField(required=False, default="")
    platforms = serializers.ListField(
        child=serializers.ChoiceField(choices=['linkedin', 'twitter', 'newsletter']),
        required=False,
        default=['linkedin', 'twitter', 'newsletter'],
    )


class ContentRepurposerRegenerateSerializer(serializers.Serializer):
    """Re-generate content for a single platform"""
    platform = serializers.ChoiceField(
        choices=['linkedin', 'twitter', 'newsletter'],
        required=True,
    )
    transcript = serializers.CharField(required=True)
    insights = serializers.JSONField(required=True)
    source_title = serializers.CharField(required=False, default="")
    instructions = serializers.CharField(
        required=False, default="",
        max_length=500,
        help_text="Optional instructions for regeneration (e.g. 'make it shorter', 'more casual')"
    )


# ---- Email Writer Serializers ----------------------------------------

class EmailWriterSerializer(serializers.Serializer):
    """Generate professional emails"""
    email_type = serializers.ChoiceField(
        choices=[
            'professional', 'follow_up', 'cold_outreach', 'thank_you',
            'apology', 'introduction', 'meeting_request', 'resignation',
            'complaint', 'inquiry'
        ],
        default='professional',
    )
    recipient = serializers.CharField(max_length=200, help_text="Who the email is to (e.g. 'hiring manager', 'client', 'team')")
    subject_context = serializers.CharField(max_length=500, help_text="What the email is about")
    key_points = serializers.CharField(
        max_length=2000, required=False, default="",
        help_text="Key points to include in the email"
    )
    tone = serializers.ChoiceField(
        choices=['formal', 'friendly', 'assertive', 'empathetic', 'neutral'],
        default='formal',
    )
    sender_name = serializers.CharField(max_length=100, required=False, default="")


# ---- Social Media Generator Serializers ------------------------------

class SocialMediaGeneratorSerializer(serializers.Serializer):
    """Generate social media posts for multiple platforms"""
    topic = serializers.CharField(max_length=1000, help_text="Topic or idea for the posts")
    platforms = serializers.ListField(
        child=serializers.ChoiceField(
            choices=['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads']
        ),
        default=['twitter', 'linkedin', 'instagram'],
        help_text="Platforms to generate content for"
    )
    tone = serializers.ChoiceField(
        choices=['professional', 'casual', 'humorous', 'inspirational', 'educational', 'promotional'],
        default='casual',
    )
    include_hashtags = serializers.BooleanField(default=True)
    include_emojis = serializers.BooleanField(default=True)
    num_variations = serializers.IntegerField(min_value=1, max_value=5, default=2)


# ---- Resume Builder Serializers --------------------------------------

class ResumeBuilderSerializer(serializers.Serializer):
    """Build professional resumes"""
    full_name = serializers.CharField(max_length=200)
    target_role = serializers.CharField(max_length=200, help_text="Job title you're applying for")
    experience = serializers.CharField(max_length=5000, help_text="Your work experience (can be rough notes)")
    education = serializers.CharField(max_length=2000, help_text="Your education background")
    skills = serializers.CharField(max_length=2000, help_text="Your key skills (comma-separated or freeform)")
    job_description = serializers.CharField(
        max_length=5000, required=False, default="",
        help_text="Target job description to tailor the resume to"
    )
    style = serializers.ChoiceField(
        choices=['professional', 'creative', 'technical', 'executive', 'entry_level'],
        default='professional',
    )


# ---- Code Generator Serializers --------------------------------------

class CodeGeneratorSerializer(serializers.Serializer):
    """Generate code snippets and functions"""
    description = serializers.CharField(max_length=2000, help_text="What the code should do")
    language = serializers.ChoiceField(
        choices=[
            'python', 'javascript', 'typescript', 'java', 'csharp',
            'cpp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html_css'
        ],
        default='python',
    )
    complexity = serializers.ChoiceField(
        choices=['simple', 'intermediate', 'advanced'],
        default='intermediate',
    )
    include_comments = serializers.BooleanField(default=True)
    include_tests = serializers.BooleanField(default=False)


# ---- Blog Post Generator Serializers ---------------------------------

class BlogPostGeneratorSerializer(serializers.Serializer):
    """Generate complete blog posts"""
    topic = serializers.CharField(max_length=500, help_text="Blog post topic or title idea")
    tone = serializers.ChoiceField(
        choices=['informative', 'conversational', 'professional', 'witty', 'inspirational', 'technical'],
        default='informative',
    )
    length = serializers.ChoiceField(
        choices=['short', 'medium', 'long'],
        default='medium',
        help_text="short=800-1000, medium=1200-1800, long=2000-3000 words"
    )
    target_audience = serializers.CharField(
        max_length=200, required=False, default="",
        help_text="Who is this for? e.g. 'beginner developers', 'small business owners'"
    )
    keywords = serializers.CharField(
        max_length=500, required=False, default="",
        help_text="SEO keywords to weave into the content (comma-separated)"
    )


# ---- YouTube Script Writer Serializers --------------------------------

class YouTubeScriptWriterSerializer(serializers.Serializer):
    """Generate YouTube video scripts"""
    topic = serializers.CharField(max_length=500, help_text="Video topic or title idea")
    duration = serializers.ChoiceField(
        choices=['5', '10', '15', '20', '30'],
        default='10',
        help_text="Target video duration in minutes"
    )
    style = serializers.ChoiceField(
        choices=['educational', 'entertainment', 'tutorial', 'vlog', 'review', 'storytelling', 'listicle'],
        default='educational',
    )
    target_audience = serializers.CharField(
        max_length=200, required=False, default="",
        help_text="Who is this video for?"
    )
    include_hooks = serializers.BooleanField(default=True, help_text="Include attention hooks & pattern interrupts")


# ---- Cover Letter Writer Serializers ----------------------------------

class CoverLetterWriterSerializer(serializers.Serializer):
    """Generate tailored cover letters"""
    job_title = serializers.CharField(max_length=200, help_text="Position you're applying for")
    company_name = serializers.CharField(max_length=200, help_text="Company name")
    experience = serializers.CharField(max_length=5000, help_text="Your relevant experience (rough notes are fine)")
    skills = serializers.CharField(
        max_length=2000, required=False, default="",
        help_text="Your key skills"
    )
    job_description = serializers.CharField(
        max_length=5000, required=False, default="",
        help_text="Paste the job description to tailor the letter"
    )
    tone = serializers.ChoiceField(
        choices=['professional', 'enthusiastic', 'confident', 'humble', 'creative'],
        default='professional',
    )


# ---- Ad Copy Generator Serializers ------------------------------------

class AdCopyGeneratorSerializer(serializers.Serializer):
    """Generate ad copy for multiple platforms"""
    product_or_service = serializers.CharField(max_length=500, help_text="What you're advertising")
    platform = serializers.ChoiceField(
        choices=['google', 'facebook', 'instagram', 'linkedin', 'tiktok'],
        default='google',
    )
    target_audience = serializers.CharField(
        max_length=300, required=False, default="",
        help_text="Who are you targeting?"
    )
    unique_selling_points = serializers.CharField(
        max_length=1000, required=False, default="",
        help_text="What makes your product/service unique?"
    )
    tone = serializers.ChoiceField(
        choices=['persuasive', 'urgent', 'friendly', 'professional', 'playful', 'bold'],
        default='persuasive',
    )
    num_variations = serializers.IntegerField(min_value=1, max_value=5, default=3)


# ---- Document Analyzer Serializers ------------------------------------

class DocumentAnalyzerSerializer(serializers.Serializer):
    """Analyze documents / PDF text"""
    text = serializers.CharField(max_length=50000, help_text="Document text to analyze")
    analysis_type = serializers.ChoiceField(
        choices=['comprehensive', 'summary', 'qa', 'entities', 'action_items'],
        default='comprehensive',
    )
    questions = serializers.CharField(
        max_length=2000, required=False, default="",
        help_text="Specific questions to answer about the document"
    )
