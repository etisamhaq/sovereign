from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.viewsets import ModelViewSet
from rest_framework.throttling import AnonRateThrottle
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count
from django.conf import settings
import os
import time
import logging

from .models import (
    Tool, ToolUsage, Document, Template, SavedResult, SavedRoadmap, SavedDecisionMatrix, SavedItinerary,
    MarketplaceTool, MarketplaceSubmission, MarketplaceToolClick
)
from .serializers import (
    ToolSerializer, ToolUsageSerializer, DocumentSerializer,
    TemplateSerializer, SavedResultSerializer,
    ParaphraseSerializer, GrammarCheckSerializer, EssayGeneratorSerializer,
    SummarizerSerializer, PlagiarismCheckSerializer, WritingImproverSerializer,
    OutlineGeneratorSerializer, TranslationSerializer, TitleGeneratorSerializer,
    ToneAnalyzerSerializer, CitationGeneratorSerializer, FlashcardGeneratorSerializer,
    QuizGeneratorSerializer, MetaDescriptionSerializer, KeywordExtractorSerializer,
    MarketplaceToolSerializer, MarketplaceToolDetailSerializer,
    MarketplaceSubmissionSerializer, MarketplaceToolClickSerializer,
)
from research.serializers import StartResearchSerializer
from research.models import ResearchProject
from research.tasks import conduct_research_task
from .ai_service import AIService
from .permissions import HasUsageQuota

logger = logging.getLogger(__name__)
MARKETPLACE_TOOL_SLUGS = ['prepza', 'logiforge', 'vixora', 'slideo']


class ToolListView(generics.ListAPIView):
    """List all available tools"""
    serializer_class = ToolSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # Return all tools without pagination

    def get_queryset(self):
        queryset = Tool.objects.filter(is_active=True).exclude(slug__in=MARKETPLACE_TOOL_SLUGS)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ToolDetailView(generics.RetrieveAPIView):
    """Get details of a specific tool"""
    serializer_class = ToolSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        return Tool.objects.filter(is_active=True).exclude(slug__in=MARKETPLACE_TOOL_SLUGS)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class MarketplaceToolListView(APIView):
    """List approved marketplace tools with filtering for frontend discovery."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = MarketplaceTool.objects.filter(
            is_active=True,
            moderation_status='approved'
        )

        category = request.query_params.get('category')
        if category and category != 'all':
            queryset = queryset.filter(category=category)

        pricing = request.query_params.get('pricing', 'all')
        if pricing == 'free':
            queryset = queryset.filter(is_free=True)
        elif pricing == 'paid':
            queryset = queryset.filter(is_free=False)

        featured = request.query_params.get('featured')
        if featured in ('true', '1'):
            queryset = queryset.filter(is_featured=True)

        sort = request.query_params.get('sort', 'featured')
        if sort == 'newest':
            queryset = queryset.order_by('-created_at')
        elif sort == 'oldest':
            queryset = queryset.order_by('created_at')
        elif sort == 'name':
            queryset = queryset.order_by('name')
        else:
            queryset = queryset.order_by('-is_featured', 'sort_order', '-created_at')

        serializer = MarketplaceToolSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data,
            'can_submit_tools': bool(getattr(settings, 'MARKETPLACE_SUBMISSIONS_ENABLED', False)),
            'submission_status': 'coming_soon',
        })


class MarketplaceToolDetailView(APIView):
    """Get trust metadata and details before outbound redirect."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        queryset = MarketplaceTool.objects.filter(
            slug=slug,
            is_active=True,
            moderation_status='approved'
        ).annotate(clicks_count=Count('clicks'))
        tool = get_object_or_404(queryset)
        serializer = MarketplaceToolDetailSerializer(tool)
        return Response(serializer.data)


class MarketplaceToolClickView(APIView):
    """Track outbound click before redirecting user to external tool."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        tool = get_object_or_404(
            MarketplaceTool,
            slug=slug,
            is_active=True,
            moderation_status='approved'
        )
        serializer = MarketplaceToolClickSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        MarketplaceToolClick.objects.create(
            tool=tool,
            user=request.user if request.user.is_authenticated else None,
            source=serializer.validated_data.get('source', 'marketplace'),
            referrer_path=request.data.get('referrer_path', ''),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:1000],
        )

        return Response({'ok': True, 'external_url': tool.external_url})


class MarketplaceSubmissionView(APIView):
    """Create/list user submissions for future marketplace creator onboarding."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        submissions = MarketplaceSubmission.objects.filter(submitted_by=request.user).order_by('-created_at')
        serializer = MarketplaceSubmissionSerializer(submissions, many=True)
        return Response({
            'can_submit': bool(getattr(settings, 'MARKETPLACE_SUBMISSIONS_ENABLED', False)),
            'submission_status': 'coming_soon',
            'results': serializer.data,
        })

    def post(self, request):
        if not bool(getattr(settings, 'MARKETPLACE_SUBMISSIONS_ENABLED', False)):
            return Response(
                {
                    'error': 'Marketplace submissions are not open yet.',
                    'submission_status': 'coming_soon',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MarketplaceSubmissionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()
        return Response(MarketplaceSubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)


class BaseToolView(APIView):
    """Base view for AI tool endpoints"""
    permission_classes = [permissions.IsAuthenticated]
    tool_slug = None

    def get_tool(self):
        return get_object_or_404(Tool, slug=self.tool_slug, is_active=True)

    def handle_ai_error(self, error, tool_name):
        """Standardized error handling for AI service errors"""
        error_message = str(error)
        logger.error(f"{tool_name} error: {error}")

        # Provide specific error messages for common issues
        if "GROQ API key is not configured" in error_message:
            return Response(
                {'error': 'The AI service is not configured. Please contact support or configure your GROQ API key.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        elif "Invalid GROQ API key" in error_message:
            return Response(
                {'error': 'Invalid API key. Please check your GROQ API key configuration.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        elif "rate limit" in error_message.lower():
            return Response(
                {'error': 'API rate limit exceeded. Please try again in a few moments.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        elif "API key" in error_message or "not configured" in error_message:
            return Response(
                {'error': error_message},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(
            {'error': f'Failed to process {tool_name}. Please try again later.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    def check_permissions(self, request):
        super().check_permissions(request)
        tool = self.get_tool()
        user = request.user

        # Check if user has reached their usage limit
        if not user.can_use_tool(self.tool_slug):
            usage_info = user.get_usage_info()
            self.permission_denied(
                request,
                message=f"You have reached your monthly limit of {usage_info['monthly_limit']} uses. "
                        f"Upgrade to Pro for more uses."
            )

        # Check if this is a premium tool and user has access
        if tool.is_premium and not user.is_pro:
            self.permission_denied(
                request,
                message="This tool requires a Pro subscription. Upgrade to Pro to access all premium tools."
            )

    def create_usage_record(self, user, tool, input_data, output_data, processing_time, error_message=""):
        """Create a usage record and update user quota"""
        if not user.is_authenticated:
            return None

        usage = ToolUsage.objects.create(
            user=user,
            tool=tool,
            input_data=input_data,
            output_data=output_data if not error_message else None,
            processing_time=processing_time,
            error_message=error_message,
            tokens_used=len(str(input_data)) + len(str(output_data or ""))  # Simple estimation
        )

        # Only count successful requests toward usage limits
        if not error_message:
            user.increment_usage()
            tool.increment_usage()

            # Award coins via reward system
            try:
                from rewards.services import RewardService
                reward_data = RewardService.award_coins_for_tool_use(
                    user, tool, usage_id=usage.id
                )
                usage._reward_data = reward_data
                self._last_reward_data = reward_data  # for finalize_response
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f'Reward error: {e}')

        return usage

    def build_success_response(self, result, usage, processing_time, **extra):
        """Build a standard success response, including reward data if available."""
        data = {
            'result': result,
            'usage_id': usage.id if usage else None,
            'processing_time': processing_time,
            **extra,
        }
        # Attach reward info earned from this tool use
        reward_data = getattr(usage, '_reward_data', None) if usage else None
        if reward_data:
            data['rewards'] = reward_data
        return Response(data)

    def finalize_response(self, request, response, *args, **kwargs):
        """Auto-inject reward data into any 200 response that has a usage_id."""
        response = super().finalize_response(request, response, *args, **kwargs)
        if (hasattr(response, 'data') and isinstance(response.data, dict)
                and response.status_code == 200
                and 'rewards' not in response.data):
            reward_data = getattr(self, '_last_reward_data', None)
            if reward_data:
                response.data['rewards'] = reward_data
        return response


class ParaphraseView(BaseToolView):
    """Paraphrase text with different modes"""
    tool_slug = 'paraphrase'

    def post(self, request):
        serializer = ParaphraseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.paraphrase(
                text=serializer.validated_data['text'],
                mode=serializer.validated_data['mode']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'paraphrased_text': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e)
            )
            return self.handle_ai_error(e, "paraphrase")


class GrammarCheckView(BaseToolView):
    """Check grammar and provide corrections"""
    tool_slug = 'grammar-check'

    def post(self, request):
        serializer = GrammarCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.check_grammar(
                text=serializer.validated_data['text']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            return self.handle_ai_error(e, "grammar check")


class EssayGeneratorView(BaseToolView):
    """Generate essays on given topics"""
    tool_slug = 'essay-writer'

    def post(self, request):
        serializer = EssayGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_essay(
                topic=serializer.validated_data['topic'],
                length=serializer.validated_data['length'],
                essay_type=serializer.validated_data['essay_type']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'essay': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Essay generation error: {e}")
            return Response(
                {'error': 'Failed to generate essay'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SummarizerView(BaseToolView):
    """Summarize text content"""
    tool_slug = 'summarizer'

    def post(self, request):
        serializer = SummarizerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.summarize(
                text=serializer.validated_data['text'],
                length=serializer.validated_data['length']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'summary': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Summarization error: {e}")
            return Response(
                {'error': 'Failed to summarize text'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DocumentViewSet(ModelViewSet):
    """CRUD operations for user documents"""
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def create_version(self, request, pk=None):
        """Create a new version of a document"""
        document = self.get_object()
        new_version = document.create_version()
        serializer = self.get_serializer(new_version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def public(self, request):
        """Get public documents"""
        queryset = Document.objects.filter(is_public=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class TemplateViewSet(ModelViewSet):
    """CRUD operations for templates"""
    serializer_class = TemplateSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Template.objects.all()
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset

    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def use(self, request, pk=None):
        """Use a template"""
        template = self.get_object()
        template.increment_usage()
        return Response({'message': 'Template usage recorded'})


class SavedResultViewSet(ModelViewSet):
    """CRUD operations for saved results"""
    serializer_class = SavedResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SavedResult.objects.filter(user=self.request.user)
        is_favorite = self.request.query_params.get('is_favorite')
        if is_favorite:
            queryset = queryset.filter(is_favorite=True)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ToolUsageHistoryView(generics.ListAPIView):
    """Get user's tool usage history"""
    serializer_class = ToolUsageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ToolUsage.objects.filter(user=self.request.user)
        tool_id = self.request.query_params.get('tool_id')
        if tool_id:
            queryset = queryset.filter(tool_id=tool_id)
        return queryset


# Additional tool views
class PlagiarismCheckView(BaseToolView):
    tool_slug = 'plagiarism-check'

    def post(self, request):
        serializer = PlagiarismCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.check_plagiarism(
                text=serializer.validated_data['text']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Plagiarism check error: {e}")
            return Response(
                {'error': 'Failed to check plagiarism'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WritingImproverView(BaseToolView):
    tool_slug = 'writing-improver'

    def post(self, request):
        serializer = WritingImproverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.improve_writing(
                text=serializer.validated_data['text'],
                focus=serializer.validated_data['focus']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'improved_text': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Writing improvement error: {e}")
            return Response(
                {'error': 'Failed to improve writing'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OutlineGeneratorView(BaseToolView):
    tool_slug = 'outline-generator'

    def post(self, request):
        serializer = OutlineGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_outline(
                topic=serializer.validated_data['topic'],
                outline_type=serializer.validated_data['outline_type']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'outline': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Outline generation error: {e}")
            return Response(
                {'error': 'Failed to generate outline'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TranslationView(BaseToolView):
    tool_slug = 'translator'

    def post(self, request):
        serializer = TranslationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.translate(
                text=serializer.validated_data['text'],
                target_language=serializer.validated_data['target_language']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'translated_text': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Translation error: {e}")
            return Response(
                {'error': 'Failed to translate text'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TitleGeneratorView(BaseToolView):
    tool_slug = 'title-generator'

    def post(self, request):
        serializer = TitleGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_title(
                content=serializer.validated_data['content'],
                style=serializer.validated_data['style']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'titles': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Title generation error: {e}")
            return Response(
                {'error': 'Failed to generate titles'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ToneAnalyzerView(BaseToolView):
    tool_slug = 'tone-analyzer'

    def post(self, request):
        serializer = ToneAnalyzerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.analyze_tone(
                text=serializer.validated_data['text']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Tone analysis error: {e}")
            return Response(
                {'error': 'Failed to analyze tone'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CitationGeneratorView(BaseToolView):
    tool_slug = 'citation-generator'

    def post(self, request):
        serializer = CitationGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_citation(
                source_info=serializer.validated_data['source_info'],
                style=serializer.validated_data['style']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'citation': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Citation generation error: {e}")
            return Response(
                {'error': 'Failed to generate citation'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FlashcardGeneratorView(BaseToolView):
    tool_slug = 'flashcard-creator'

    def post(self, request):
        serializer = FlashcardGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.create_flashcards(
                text=serializer.validated_data['text'],
                num_cards=serializer.validated_data.get('num_cards', 10)
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'flashcards': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Flashcard generation error: {e}")
            return Response(
                {'error': 'Failed to generate flashcards'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class QuizGeneratorView(BaseToolView):
    tool_slug = 'quiz-generator'

    def post(self, request):
        serializer = QuizGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_quiz(
                text=serializer.validated_data['text'],
                num_questions=serializer.validated_data.get('num_questions', 5)
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data={'quiz': result},
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Quiz generation error: {e}")
            return Response(
                {'error': 'Failed to generate quiz'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class QuizEvaluationView(BaseToolView):
    """Evaluate quiz answers"""
    tool_slug = 'quiz-generator'

    def post(self, request):
        # Validate input
        questions = request.data.get('questions', [])
        user_answers = request.data.get('user_answers', [])

        if not questions or not isinstance(questions, list):
            return Response(
                {'error': 'Invalid questions format'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(user_answers, list):
            return Response(
                {'error': 'Invalid answers format'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.evaluate_quiz(questions, user_answers)
            processing_time = time.time() - start_time

            # Record usage
            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data={'num_questions': len(questions), 'num_answers': len(user_answers)},
                output_data=result,
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Quiz evaluation error: {e}")
            return Response(
                {'error': 'Failed to evaluate quiz'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ResearchAssistantView(BaseToolView):
    """Smart Research Assistant tool"""
    tool_slug = 'research-assistant'

    def post(self, request):
        serializer = StartResearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()

        # Create research project
        project = ResearchProject.objects.create(
            user=request.user,
            title=f"Research: {serializer.validated_data['topic'][:50]}",
            topic=serializer.validated_data['topic'],
            depth_level=serializer.validated_data['depth_level'],
            max_sources=serializer.validated_data.get('max_sources', 10),
            include_academic=serializer.validated_data.get('include_academic', True),
            include_news=serializer.validated_data.get('include_news', True),
            include_web=serializer.validated_data.get('include_web', True),
        )

        # Start research asynchronously
        conduct_research_task.delay(project.id)

        # Track usage
        usage = self.create_usage_record(
            user=request.user,
            tool=tool,
            input_data=serializer.validated_data,
            output_data={'project_id': str(project.id)},
            processing_time=0  # Async processing
        )

        return Response({
            'project_id': str(project.id),
            'status': 'processing',
            'message': 'Your research has started. Check back in a few minutes for results.',
            'usage_id': usage.id if usage else None,
        }, status=status.HTTP_202_ACCEPTED)


class MetaDescriptionGeneratorView(BaseToolView):
    """Generate SEO-optimized meta descriptions"""
    tool_slug = 'meta-description-generator'

    def post(self, request):
        serializer = MetaDescriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_meta_description(
                content=serializer.validated_data['content'],
                keywords=serializer.validated_data.get('keywords'),
                tone=serializer.validated_data['tone'],
                target_length=serializer.validated_data['target_length']
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            logger.error(f"Meta description generation error: {e}")
            return Response(
                {'error': 'Failed to generate meta descriptions'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )






class ContentCalendarView(BaseToolView):
    """Generate 30-day social media content calendar"""
    tool_slug = 'content-calendar'

    def post(self, request):
        from rest_framework import serializers

        # Define serializer inline for simplicity
        class ContentCalendarSerializer(serializers.Serializer):
            business_description = serializers.CharField(
                required=True,
                help_text="One-line description of your business"
            )

        serializer = ContentCalendarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()
        start_time = time.time()

        try:
            business_description = serializer.validated_data['business_description']

            # Generate content calendar using AI
            result = ai_service.generate_content_calendar(business_description)

            processing_time = time.time() - start_time

            # Create usage record if user is authenticated
            if request.user.is_authenticated:
                self.create_usage_record(
                    user=request.user,
                    tool=tool,
                    input_data={'business_description': business_description},
                    output_data=result,
                    processing_time=processing_time
                )

            return Response({
                'result': result,
                'processing_time': processing_time
            })

        except Exception as e:
            return self.handle_ai_error(e, "Content Calendar Generation")


class CourseOutlineCreatorView(BaseToolView):
    """Generate comprehensive course outlines"""
    tool_slug = 'course-outline-creator'

    def post(self, request):
        from rest_framework import serializers

        # Define serializer for course outline input
        class CourseOutlineSerializer(serializers.Serializer):
            topic = serializers.CharField(
                required=True,
                help_text="Course topic or subject"
            )
            target_audience = serializers.CharField(
                required=True,
                help_text="Target audience for the course"
            )
            duration = serializers.CharField(
                required=True,
                help_text="Course duration (e.g., '8 weeks', '3 months')"
            )
            level = serializers.ChoiceField(
                choices=['beginner', 'intermediate', 'advanced'],
                required=True,
                help_text="Course difficulty level"
            )
            format = serializers.ChoiceField(
                choices=['video', 'text', 'mixed', 'workshop'],
                required=True,
                help_text="Course delivery format"
            )
            learning_goals = serializers.CharField(
                required=False,
                allow_blank=True,
                help_text="Specific learning goals (optional)"
            )
            prerequisites = serializers.CharField(
                required=False,
                allow_blank=True,
                help_text="Course prerequisites (optional)"
            )

        serializer = CourseOutlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()
        start_time = time.time()

        try:
            # Generate course outline using AI
            result = ai_service.generate_course_outline(
                topic=serializer.validated_data['topic'],
                target_audience=serializer.validated_data['target_audience'],
                duration=serializer.validated_data['duration'],
                level=serializer.validated_data['level'],
                format=serializer.validated_data['format'],
                learning_goals=serializer.validated_data.get('learning_goals', ''),
                prerequisites=serializer.validated_data.get('prerequisites', '')
            )

            processing_time = time.time() - start_time

            # Create usage record if user is authenticated
            if request.user.is_authenticated:
                self.create_usage_record(
                    user=request.user,
                    tool=tool,
                    input_data=serializer.validated_data,
                    output_data=result,
                    processing_time=processing_time
                )

            return Response({
                'result': result,
                'processing_time': processing_time
            })

        except Exception as e:
            return self.handle_ai_error(e, "Course Outline Generation")


class VisiSenseAnalyzeView(BaseToolView):
    """Analyze screen content with OCR and AI"""
    tool_slug = 'visisense-ai'

    def post(self, request):
        from .serializers import VisiSenseUploadSerializer

        serializer = VisiSenseUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()

        try:
            result = ai_service.analyze_screen_content(
                image_data=serializer.validated_data['image'],
                question=serializer.validated_data.get('question'),
                context=serializer.validated_data.get('context')
            )

            processing_time = time.time() - start_time

            # Create usage record if user is authenticated
            if request.user.is_authenticated:
                self.create_usage_record(
                    user=request.user,
                    tool=tool,
                    input_data={'question': serializer.validated_data.get('question', 'General analysis')},
                    output_data=result,
                    processing_time=processing_time
                )

            return Response({
                'result': result,
                'processing_time': processing_time
            })

        except Exception as e:
            return self.handle_ai_error(e, "VisiSense Analysis")


class VisiSenseQuestionView(BaseToolView):
    """Answer questions about previously extracted screen content"""
    tool_slug = 'visisense-ai'

    def post(self, request):
        from .serializers import VisiSenseQuestionSerializer

        serializer = VisiSenseQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_service = AIService()

        try:
            response = ai_service.answer_screen_question(
                extracted_text=serializer.validated_data['extracted_text'],
                question=serializer.validated_data['question'],
                chat_history=serializer.validated_data.get('chat_history', [])
            )

            return Response({
                'result': {
                    'answer': response,
                    'question': serializer.validated_data['question']
                }
            })

        except Exception as e:
            return self.handle_ai_error(e, "VisiSense Q&A")


class VisiSenseTranslateView(BaseToolView):
    """Translate extracted screen text"""
    tool_slug = 'visisense-ai'

    def post(self, request):
        from .serializers import VisiSenseTranslateSerializer

        serializer = VisiSenseTranslateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_service = AIService()

        try:
            translation = ai_service.translate_screen_text(
                text=serializer.validated_data['text'],
                target_language=serializer.validated_data['target_language']
            )

            return Response({
                'result': {
                    'original_text': serializer.validated_data['text'],
                    'translation': translation,
                    'target_language': serializer.validated_data['target_language']
                }
            })

        except Exception as e:
            return self.handle_ai_error(e, "VisiSense Translation")


class VisiSenseExtractView(BaseToolView):
    """Extract specific information from screen text"""
    tool_slug = 'visisense-ai'

    def post(self, request):
        from .serializers import VisiSenseExtractSerializer

        serializer = VisiSenseExtractSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_service = AIService()

        try:
            extracted_info = ai_service.extract_key_information(
                text=serializer.validated_data['text'],
                info_type=serializer.validated_data['info_type']
            )

            return Response({
                'result': extracted_info
            })

        except Exception as e:
            return self.handle_ai_error(e, "VisiSense Extraction")


class VisiSenseSummaryView(BaseToolView):
    """Generate summaries of screen content"""
    tool_slug = 'visisense-ai'

    def post(self, request):
        from .serializers import VisiSenseSummarySerializer

        serializer = VisiSenseSummarySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_service = AIService()

        try:
            summary = ai_service.generate_screen_summary(
                text=serializer.validated_data['text'],
                summary_type=serializer.validated_data['summary_type']
            )

            return Response({
                'result': {
                    'summary': summary,
                    'summary_type': serializer.validated_data['summary_type']
                }
            })

        except Exception as e:
            return self.handle_ai_error(e, "VisiSense Summary")


# Video Downloader Views
class VideoInfoView(BaseToolView):
    """Get video information without downloading"""
    tool_slug = 'video-downloader'

    def post(self, request):
        from .video_download_serializers import VideoInfoRequestSerializer, VideoInfoResponseSerializer
        from .video_download_service import VideoDownloadService

        serializer = VideoInfoRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = VideoDownloadService()
            info = service.get_video_info(serializer.validated_data['url'])

            if 'error' in info:
                return Response({
                    'success': False,
                    'error': info['error']
                }, status=status.HTTP_400_BAD_REQUEST)

            response_serializer = VideoInfoResponseSerializer(info)
            return Response(response_serializer.data)

        except Exception as e:
            logger.error(f"Video info error: {e}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VideoDownloadView(BaseToolView):
    """Download video from YouTube or Instagram"""
    tool_slug = 'video-downloader'

    def post(self, request):
        from .video_download_serializers import VideoDownloadRequestSerializer, VideoDownloadResponseSerializer
        from .video_download_service import VideoDownloadService
        from django.http import FileResponse
        import mimetypes
        import time

        serializer = VideoDownloadRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tool = self.get_tool()
        start_time = time.time()

        try:
            service = VideoDownloadService()

            # Download the video
            result = service.download_video(
                url=serializer.validated_data['url'],
                quality=serializer.validated_data.get('quality', 'best'),
                format=serializer.validated_data.get('format', 'mp4')
            )

            if not result.get('success'):
                return Response({
                    'success': False,
                    'error': result.get('error', 'Download failed')
                }, status=status.HTTP_400_BAD_REQUEST)

            # Track usage
            processing_time = time.time() - start_time
            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time
            )

            # Prepare download URL
            file_id = result['file_id']
            download_url = f"/api/tools/video-download/file/{file_id}/"

            response_data = {
                'success': True,
                'file_id': file_id,
                'file_name': result['file_name'],
                'file_size': result['file_size'],
                'title': result['title'],
                'duration': result['duration'],
                'format': result['format'],
                'quality': result['quality'],
                'download_url': download_url
            }

            response_serializer = VideoDownloadResponseSerializer(response_data)
            return Response(response_serializer.data)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e)
            )
            logger.error(f"Video download error: {e}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VideoEmbedView(BaseToolView):
    """Get video embed code instead of downloading"""
    tool_slug = 'video-downloader'

    def post(self, request):
        from .video_download_serializers import VideoInfoRequestSerializer
        from .video_embed_service import VideoEmbedService

        serializer = VideoInfoRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = VideoEmbedService()
            result = service.get_embed_info(serializer.validated_data['url'])

            if result.get('success'):
                return Response(result)
            else:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Video embed error: {e}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VideoFileDownloadView(APIView):
    """Serve downloaded video file"""
    permission_classes = [permissions.AllowAny]  # Allow download without auth for simplicity

    def get(self, request, file_id):
        from .video_download_service import VideoDownloadService
        from django.http import FileResponse, Http404
        import mimetypes

        try:
            service = VideoDownloadService()
            file_path = service.get_download_path(file_id)

            if not file_path or not file_path.exists():
                raise Http404("File not found")

            # Determine content type
            content_type, _ = mimetypes.guess_type(str(file_path))
            if not content_type:
                content_type = 'application/octet-stream'

            # Create file response
            response = FileResponse(
                open(file_path, 'rb'),
                content_type=content_type,
                as_attachment=True,
                filename=file_path.name
            )

            # Clean up old files
            service.clean_old_files(max_age_hours=1)

            return response

        except Http404:
            raise
        except Exception as e:
            logger.error(f"File download error: {e}")
            return Response({
                'error': 'Failed to download file'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Video Chat Views
class VideoChatView(BaseToolView):
    """Chat with video content using AI"""
    tool_slug = 'video-chat'

    def post(self, request):
        from .serializers import VideoChatSerializer
        from .video_chat_service import VideoChatService
        import time

        serializer = VideoChatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tool = self.get_tool()
        start_time = time.time()

        try:
            service = VideoChatService()
            result = service.chat_about_video(
                video_url=serializer.validated_data['url'],
                question=serializer.validated_data['question'],
                context=serializer.validated_data.get('context')
            )

            processing_time = time.time() - start_time

            if result.get('success'):
                response_data = {
                    'success': True,
                    'answer': result['answer'],
                    'video_info': result.get('video_info', {}),
                    'has_transcript': result.get('has_transcript', False)
                }

                # Track usage (only for authenticated users)
                if request.user.is_authenticated:
                    self.create_usage_record(
                        user=request.user,
                        tool=tool,
                        input_data=serializer.validated_data,
                        output_data=response_data,
                        processing_time=processing_time
                    )

                return Response(response_data)
            else:
                return Response({
                    'error': result.get('error', 'Failed to process video chat')
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Video chat error: {e}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VideoTranscriptView(BaseToolView):
    """Generate transcript from video"""
    tool_slug = 'video-chat'

    def post(self, request):
        from .serializers import VideoTranscriptSerializer
        from .video_chat_service import VideoChatService
        import time

        serializer = VideoTranscriptSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tool = self.get_tool()
        start_time = time.time()

        try:
            service = VideoChatService()
            result = service.generate_transcript(
                video_url=serializer.validated_data['url']
            )

            processing_time = time.time() - start_time

            if result.get('success'):
                # Format based on requested format
                format_type = serializer.validated_data.get('format', 'text')

                if format_type == 'segments':
                    response_data = {
                        'success': True,
                        'segments': result.get('segments', []),
                        'word_count': result.get('word_count', 0),
                        'language': result.get('language', 'en')
                    }
                else:
                    response_data = {
                        'success': True,
                        'transcript': result.get('transcript', ''),
                        'word_count': result.get('word_count', 0),
                        'language': result.get('language', 'en')
                    }

                # Track usage (only for authenticated users)
                if request.user.is_authenticated:
                    self.create_usage_record(
                        user=request.user,
                        tool=tool,
                        input_data=serializer.validated_data,
                        output_data=response_data,
                        processing_time=processing_time
                    )

                return Response(response_data)
            else:
                return Response({
                    'error': result.get('error', 'Failed to generate transcript')
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Video transcript error: {e}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VideoSummaryView(BaseToolView):
    """Generate summary of video content"""
    tool_slug = 'video-chat'

    def post(self, request):
        from .serializers import VideoSummarySerializer
        from .video_chat_service import VideoChatService
        import time

        serializer = VideoSummarySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tool = self.get_tool()
        start_time = time.time()

        try:
            service = VideoChatService()
            result = service.generate_summary(
                video_url=serializer.validated_data['url'],
                summary_type=serializer.validated_data.get('summary_type', 'brief')
            )

            processing_time = time.time() - start_time

            if result.get('success'):
                response_data = {
                    'success': True,
                    'summary': result['summary'],
                    'summary_type': result['summary_type'],
                    'word_count': result.get('word_count', 0)
                }

                # Track usage (only for authenticated users)
                if request.user.is_authenticated:
                    self.create_usage_record(
                        user=request.user,
                        tool=tool,
                        input_data=serializer.validated_data,
                        output_data=response_data,
                        processing_time=processing_time
                    )

                return Response(response_data)
            else:
                return Response({
                    'error': result.get('error', 'Failed to generate summary')
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Video summary error: {e}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VideoKeyMomentsView(BaseToolView):
    """Extract key moments from video"""
    tool_slug = 'video-chat'

    def post(self, request):
        from .serializers import VideoKeyMomentsSerializer
        from .video_chat_service import VideoChatService
        import time

        serializer = VideoKeyMomentsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tool = self.get_tool()
        start_time = time.time()

        try:
            service = VideoChatService()
            result = service.extract_key_moments(
                video_url=serializer.validated_data['url']
            )

            processing_time = time.time() - start_time

            if result.get('success'):
                response_data = {
                    'success': True,
                    'key_moments': result.get('key_moments', result.get('segments', [])),
                    'total_segments': result.get('total_segments', 0)
                }

                # Track usage (only for authenticated users)
                if request.user.is_authenticated:
                    self.create_usage_record(
                        user=request.user,
                        tool=tool,
                        input_data=serializer.validated_data,
                        output_data=response_data,
                        processing_time=processing_time
                    )

                return Response(response_data)
            else:
                return Response({
                    'error': result.get('error', 'Failed to extract key moments')
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Video key moments error: {e}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ImageComparisonView(BaseToolView):
    """Compare JPEG/PNG images for identical and similar matches"""
    tool_slug = 'image-comparison'

    def post(self, request):
        from .image_comparison_serializers import ImageUploadSerializer, ImageComparisonResponseSerializer
        # Try to import full version, fallback to lite version
        try:
            from .image_comparison_service import ImageComparisonService
        except ImportError:
            from .image_comparison_service_lite import ImageComparisonServiceLite as ImageComparisonService
        import tempfile
        import os

        serializer = ImageUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tool = self.get_tool()
        start_time = time.time()

        # Create temporary directories for storing uploaded images
        temp_dir = tempfile.mkdtemp()
        folder_a_dir = os.path.join(temp_dir, 'folder_a')
        folder_b_dir = os.path.join(temp_dir, 'folder_b')
        folder_c_dir = os.path.join(temp_dir, 'folder_c')

        os.makedirs(folder_a_dir)
        os.makedirs(folder_b_dir)
        os.makedirs(folder_c_dir)

        try:
            # Save uploaded images to temporary directories
            folder_a_paths = []
            folder_b_paths = []
            folder_c_paths = []

            for idx, img in enumerate(serializer.validated_data['folder_a']):
                path = os.path.join(folder_a_dir, f'a_{idx}_{img.name}')
                with open(path, 'wb') as f:
                    for chunk in img.chunks():
                        f.write(chunk)
                folder_a_paths.append(path)

            for idx, img in enumerate(serializer.validated_data['folder_b']):
                path = os.path.join(folder_b_dir, f'b_{idx}_{img.name}')
                with open(path, 'wb') as f:
                    for chunk in img.chunks():
                        f.write(chunk)
                folder_b_paths.append(path)

            for idx, img in enumerate(serializer.validated_data['folder_c']):
                path = os.path.join(folder_c_dir, f'c_{idx}_{img.name}')
                with open(path, 'wb') as f:
                    for chunk in img.chunks():
                        f.write(chunk)
                folder_c_paths.append(path)

            # Perform image comparison
            service = ImageComparisonService()
            result = service.compare_images(
                folder_a_paths=folder_a_paths,
                folder_b_paths=folder_b_paths,
                folder_c_paths=folder_c_paths
            )

            processing_time = time.time() - start_time

            # Create usage record if user is authenticated
            if request.user.is_authenticated:
                self.create_usage_record(
                    user=request.user,
                    tool=tool,
                    input_data={
                        'folder_a_count': len(folder_a_paths),
                        'folder_b_count': len(folder_b_paths),
                        'folder_c_count': len(folder_c_paths),
                        'threshold': serializer.validated_data['similarity_threshold']
                    },
                    output_data=result,
                    processing_time=processing_time
                )

            # Clean up temporary files
            import shutil
            shutil.rmtree(temp_dir)

            response_serializer = ImageComparisonResponseSerializer(result)
            return Response(response_serializer.data)

        except Exception as e:
            # Clean up on error
            import shutil
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

            logger.error(f"Image comparison error: {e}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LinkedInPostOptimizerView(BaseToolView):
    """Optimize content for LinkedIn posts"""
    tool_slug = 'linkedin-post-optimizer'

    def post(self, request):
        from .serializers import LinkedInPostOptimizerSerializer

        serializer = LinkedInPostOptimizerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.optimize_linkedin_post(
                content=serializer.validated_data['content'],
                goal=serializer.validated_data.get('goal', 'engagement'),
                tone=serializer.validated_data.get('tone', 'professional'),
                include_hashtags=serializer.validated_data.get('include_hashtags', True),
                include_cta=serializer.validated_data.get('include_cta', True),
                include_emoji=serializer.validated_data.get('include_emoji', True)
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e)
            )
            return self.handle_ai_error(e, "LinkedIn Post Optimizer")


class KeywordExtractorView(BaseToolView):
    """Extract keywords from text"""
    tool_slug = 'keyword-extractor'

    def post(self, request):
        serializer = KeywordExtractorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.extract_keywords(
                text=serializer.validated_data['text'],
                max_keywords=serializer.validated_data.get('max_keywords', 10)
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time
            )

            return Response({
                'result': result,
                'usage_id': usage.id if usage else None,
                'processing_time': processing_time
            })

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e)
            )
            return self.handle_ai_error(e, "Keyword Extractor")


# ==================================================================
#  Content Repurposer Views
# ==================================================================

class ContentRepurposerProcessView(BaseToolView):
    """
    Step 1: Accept YouTube URL or audio file upload → transcribe → extract insights.
    Multipart form: either `url` field or `audio_file` file upload.
    """
    tool_slug = 'content-repurposer'

    def post(self, request):
        from .serializers import ContentRepurposerProcessSerializer
        from .content_repurposer_service import ContentRepurposerService
        from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
        import time

        serializer = ContentRepurposerProcessSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        youtube_url = serializer.validated_data.get('url')
        audio_file = request.FILES.get('audio_file')

        if not youtube_url and not audio_file:
            return Response(
                {'error': 'Please provide either a YouTube URL or an audio file.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate audio file type if provided
        if audio_file:
            allowed_types = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav',
                             'audio/wave', 'audio/mp4', 'audio/ogg', 'video/mp4']
            allowed_extensions = ['.mp3', '.wav', '.m4a', '.ogg', '.mp4']
            ext = os.path.splitext(audio_file.name)[1].lower()
            if audio_file.content_type not in allowed_types and ext not in allowed_extensions:
                return Response(
                    {'error': f'Unsupported audio format: {audio_file.content_type}. Supported: MP3, WAV, M4A, OGG.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if audio_file.size > 25 * 1024 * 1024:
                return Response(
                    {'error': 'Audio file too large. Maximum size is 25 MB.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        tool = self.get_tool()
        start_time = time.time()

        try:
            service = ContentRepurposerService()
            result = service.process(youtube_url=youtube_url, audio_file=audio_file)
            processing_time = time.time() - start_time

            if result.get('success'):
                usage = self.create_usage_record(
                    user=request.user,
                    tool=tool,
                    input_data={
                        'url': youtube_url or '',
                        'audio_file_name': audio_file.name if audio_file else '',
                    },
                    output_data={
                        'source_title': result.get('source_title', ''),
                        'word_count': result.get('word_count', 0),
                        'insights_keys': list(result.get('insights', {}).keys()),
                    },
                    processing_time=processing_time,
                )

                response_data = {
                    'success': True,
                    'source_title': result['source_title'],
                    'source_meta': result.get('source_meta', {}),
                    'transcript': result['transcript'],
                    'word_count': result['word_count'],
                    'insights': result['insights'],
                    'usage_id': usage.id if usage else None,
                    'processing_time': processing_time,
                }

                # Attach reward data
                reward_data = getattr(self, '_last_reward_data', None)
                if reward_data:
                    response_data['rewards'] = reward_data

                return Response(response_data)
            else:
                return Response(
                    {'error': result.get('error', 'Processing failed')},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data={'url': youtube_url or '', 'audio_file_name': audio_file.name if audio_file else ''},
                output_data=None, processing_time=processing_time, error_message=str(e),
            )
            return self.handle_ai_error(e, "Content Repurposer")


class ContentRepurposerGenerateView(BaseToolView):
    """
    Step 2: Generate platform-specific content from transcript + insights.
    Does NOT count as an extra usage (process step already counted).
    """
    tool_slug = 'content-repurposer'

    def post(self, request):
        from .serializers import ContentRepurposerGenerateSerializer
        from .content_repurposer_service import ContentRepurposerService
        import time

        serializer = ContentRepurposerGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        start_time = time.time()

        try:
            service = ContentRepurposerService()
            result = service.generate(
                transcript=serializer.validated_data['transcript'],
                insights=serializer.validated_data['insights'],
                source_title=serializer.validated_data.get('source_title', ''),
                platforms=serializer.validated_data.get('platforms'),
            )
            processing_time = time.time() - start_time

            if result.get('success'):
                return Response({
                    'success': True,
                    'content': result['content'],
                    'processing_time': processing_time,
                })
            else:
                return Response(
                    {'error': result.get('error', 'Generation failed')},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        except Exception as e:
            return self.handle_ai_error(e, "Content Repurposer Generate")


class ContentRepurposerRegenerateView(BaseToolView):
    """
    Step 3: Regenerate content for a single platform.
    Does NOT count as an extra usage.
    """
    tool_slug = 'content-repurposer'

    def post(self, request):
        from .serializers import ContentRepurposerRegenerateSerializer
        from .content_repurposer_service import ContentRepurposerService
        import time

        serializer = ContentRepurposerRegenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        start_time = time.time()

        try:
            service = ContentRepurposerService()
            result = service.regenerate_section(
                platform=serializer.validated_data['platform'],
                transcript=serializer.validated_data['transcript'],
                insights=serializer.validated_data['insights'],
                source_title=serializer.validated_data.get('source_title', ''),
                instructions=serializer.validated_data.get('instructions', ''),
            )
            processing_time = time.time() - start_time

            if result.get('success'):
                return Response({
                    'success': True,
                    'platform': result['platform'],
                    'content': result['content'],
                    'processing_time': processing_time,
                })
            else:
                return Response(
                    {'error': result.get('error', 'Regeneration failed')},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        except Exception as e:
            return self.handle_ai_error(e, "Content Repurposer Regenerate")


# ==================================================================
#  Email Writer View
# ==================================================================

class EmailWriterView(BaseToolView):
    tool_slug = 'email-writer'

    def post(self, request):
        from .serializers import EmailWriterSerializer

        serializer = EmailWriterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_email(
                email_type=serializer.validated_data['email_type'],
                recipient=serializer.validated_data['recipient'],
                subject_context=serializer.validated_data['subject_context'],
                key_points=serializer.validated_data.get('key_points', ''),
                tone=serializer.validated_data.get('tone', 'formal'),
                sender_name=serializer.validated_data.get('sender_name', ''),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Email Writer")


# ==================================================================
#  Social Media Post Generator View
# ==================================================================

class SocialMediaGeneratorView(BaseToolView):
    tool_slug = 'social-media-generator'

    def post(self, request):
        from .serializers import SocialMediaGeneratorSerializer

        serializer = SocialMediaGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_social_media_posts(
                topic=serializer.validated_data['topic'],
                platforms=serializer.validated_data.get('platforms', ['twitter', 'linkedin', 'instagram']),
                tone=serializer.validated_data.get('tone', 'casual'),
                include_hashtags=serializer.validated_data.get('include_hashtags', True),
                include_emojis=serializer.validated_data.get('include_emojis', True),
                num_variations=serializer.validated_data.get('num_variations', 2),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Social Media Generator")


# ==================================================================
#  Resume Builder View
# ==================================================================

class ResumeBuilderView(BaseToolView):
    tool_slug = 'resume-builder'

    def post(self, request):
        from .serializers import ResumeBuilderSerializer

        serializer = ResumeBuilderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.build_resume(
                full_name=serializer.validated_data['full_name'],
                target_role=serializer.validated_data['target_role'],
                experience=serializer.validated_data['experience'],
                education=serializer.validated_data['education'],
                skills=serializer.validated_data['skills'],
                job_description=serializer.validated_data.get('job_description', ''),
                style=serializer.validated_data.get('style', 'professional'),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data={k: v for k, v in serializer.validated_data.items() if k != 'job_description'},
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Resume Builder")


# ==================================================================
#  Code Generator View
# ==================================================================

class CodeGeneratorView(BaseToolView):
    tool_slug = 'code-generator'

    def post(self, request):
        from .serializers import CodeGeneratorSerializer

        serializer = CodeGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_code(
                description=serializer.validated_data['description'],
                language=serializer.validated_data.get('language', 'python'),
                complexity=serializer.validated_data.get('complexity', 'intermediate'),
                include_comments=serializer.validated_data.get('include_comments', True),
                include_tests=serializer.validated_data.get('include_tests', False),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Code Generator")


# ==================================================================
#  Blog Post Generator View
# ==================================================================

class BlogPostGeneratorView(BaseToolView):
    """Generate complete, publish-ready blog posts"""
    tool_slug = 'blog-post-generator'

    def post(self, request):
        from .serializers import BlogPostGeneratorSerializer

        serializer = BlogPostGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_blog_post(
                topic=serializer.validated_data['topic'],
                tone=serializer.validated_data.get('tone', 'informative'),
                length=serializer.validated_data.get('length', 'medium'),
                target_audience=serializer.validated_data.get('target_audience', ''),
                keywords=serializer.validated_data.get('keywords', ''),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Blog Post Generator")


# ==================================================================
#  YouTube Script Writer View
# ==================================================================

class YouTubeScriptWriterView(BaseToolView):
    """Generate structured YouTube video scripts"""
    tool_slug = 'youtube-script-writer'

    def post(self, request):
        from .serializers import YouTubeScriptWriterSerializer

        serializer = YouTubeScriptWriterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_youtube_script(
                topic=serializer.validated_data['topic'],
                duration=serializer.validated_data.get('duration', '10'),
                style=serializer.validated_data.get('style', 'educational'),
                target_audience=serializer.validated_data.get('target_audience', ''),
                include_hooks=serializer.validated_data.get('include_hooks', True),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "YouTube Script Writer")


# ==================================================================
#  Cover Letter Writer View
# ==================================================================

class CoverLetterWriterView(BaseToolView):
    """Generate tailored cover letters"""
    tool_slug = 'cover-letter-writer'

    def post(self, request):
        from .serializers import CoverLetterWriterSerializer

        serializer = CoverLetterWriterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_cover_letter(
                job_title=serializer.validated_data['job_title'],
                company_name=serializer.validated_data['company_name'],
                experience=serializer.validated_data['experience'],
                skills=serializer.validated_data.get('skills', ''),
                job_description=serializer.validated_data.get('job_description', ''),
                tone=serializer.validated_data.get('tone', 'professional'),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Cover Letter Writer")


# ==================================================================
#  Ad Copy Generator View
# ==================================================================

class AdCopyGeneratorView(BaseToolView):
    """Generate high-converting ad copy for multiple platforms"""
    tool_slug = 'ad-copy-generator'

    def post(self, request):
        from .serializers import AdCopyGeneratorSerializer

        serializer = AdCopyGeneratorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.generate_ad_copy(
                product_or_service=serializer.validated_data['product_or_service'],
                platform=serializer.validated_data.get('platform', 'google'),
                target_audience=serializer.validated_data.get('target_audience', ''),
                unique_selling_points=serializer.validated_data.get('unique_selling_points', ''),
                tone=serializer.validated_data.get('tone', 'persuasive'),
                num_variations=serializer.validated_data.get('num_variations', 3),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Ad Copy Generator")


# ==================================================================
#  Document Analyzer View
# ==================================================================

class DocumentAnalyzerView(BaseToolView):
    """Analyze documents — summarize, extract insights, answer questions"""
    tool_slug = 'document-analyzer'

    def post(self, request):
        from .serializers import DocumentAnalyzerSerializer

        serializer = DocumentAnalyzerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()

        start_time = time.time()
        try:
            result = ai_service.analyze_document(
                text=serializer.validated_data['text'],
                analysis_type=serializer.validated_data.get('analysis_type', 'comprehensive'),
                questions=serializer.validated_data.get('questions', ''),
            )
            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user, tool=tool,
                input_data={'text_length': len(serializer.validated_data['text']),
                            'analysis_type': serializer.validated_data.get('analysis_type')},
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user, tool=tool,
                input_data={'text_length': len(serializer.validated_data.get('text', ''))},
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Document Analyzer")


# ==================================================================
#  Roadmap Builder View
# ==================================================================

class RoadmapBuilderView(BaseToolView):
    """Generate structured learning roadmaps"""
    tool_slug = 'roadmap-builder'

    def post(self, request):
        from rest_framework import serializers as drf_serializers

        class RoadmapSerializer(drf_serializers.Serializer):
            goal = drf_serializers.CharField(
                required=True,
                max_length=500,
                help_text="What the user wants to learn"
            )
            skill_level = drf_serializers.ChoiceField(
                choices=['beginner', 'intermediate', 'advanced'],
                required=True,
            )
            hours_per_week = drf_serializers.IntegerField(
                required=True,
                min_value=1,
                max_value=80,
            )
            preferred_style = drf_serializers.ChoiceField(
                choices=['videos', 'books', 'projects', 'mixed'],
                required=True,
            )
            timeline = drf_serializers.CharField(
                required=False,
                allow_blank=True,
                max_length=200,
                help_text="Desired timeline (e.g., '3 months', '1 year')"
            )
            constraints = drf_serializers.CharField(
                required=False,
                allow_blank=True,
                max_length=1000,
                help_text="Budget constraints, specific focus areas, etc."
            )

        serializer = RoadmapSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()
        start_time = time.time()

        try:
            result = ai_service.generate_learning_roadmap(
                goal=serializer.validated_data['goal'],
                skill_level=serializer.validated_data['skill_level'],
                hours_per_week=serializer.validated_data['hours_per_week'],
                preferred_style=serializer.validated_data['preferred_style'],
                timeline=serializer.validated_data.get('timeline', ''),
                constraints=serializer.validated_data.get('constraints', ''),
            )

            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Roadmap Builder")


class SavedRoadmapListView(APIView):
    """List and create saved roadmaps for the current user"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List all saved roadmaps for the current user"""
        roadmaps = SavedRoadmap.objects.filter(user=request.user)
        data = []
        for rm in roadmaps:
            data.append({
                'id': str(rm.id),
                'title': rm.title,
                'goal': rm.goal,
                'skill_level': rm.skill_level,
                'total_phases': rm.total_phases,
                'completed_phases': rm.completed_phases,
                'is_favorite': rm.is_favorite,
                'created_at': rm.created_at.isoformat(),
                'updated_at': rm.updated_at.isoformat(),
            })
        return Response(data)

    def post(self, request):
        """Save a new roadmap"""
        roadmap_data = request.data.get('roadmap_data')
        if not roadmap_data:
            return Response({'error': 'roadmap_data is required'}, status=status.HTTP_400_BAD_REQUEST)

        title = roadmap_data.get('title', 'Untitled Roadmap')
        phases = roadmap_data.get('phases', [])

        roadmap = SavedRoadmap.objects.create(
            user=request.user,
            title=title,
            goal=roadmap_data.get('overview', ''),
            skill_level=roadmap_data.get('skillLevel', ''),
            roadmap_data=roadmap_data,
            total_phases=len(phases),
            completed_phases=0,
        )

        return Response({
            'id': str(roadmap.id),
            'title': roadmap.title,
            'message': 'Roadmap saved successfully',
        }, status=status.HTTP_201_CREATED)


class SavedRoadmapDetailView(APIView):
    """Get, update or delete a saved roadmap"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        roadmap = get_object_or_404(SavedRoadmap, pk=pk, user=request.user)
        return Response({
            'id': str(roadmap.id),
            'title': roadmap.title,
            'goal': roadmap.goal,
            'skill_level': roadmap.skill_level,
            'roadmap_data': roadmap.roadmap_data,
            'total_phases': roadmap.total_phases,
            'completed_phases': roadmap.completed_phases,
            'phase_progress': roadmap.phase_progress,
            'is_favorite': roadmap.is_favorite,
            'created_at': roadmap.created_at.isoformat(),
            'updated_at': roadmap.updated_at.isoformat(),
        })

    def patch(self, request, pk):
        roadmap = get_object_or_404(SavedRoadmap, pk=pk, user=request.user)

        if 'is_favorite' in request.data:
            roadmap.is_favorite = request.data['is_favorite']
        if 'completed_phases' in request.data:
            roadmap.completed_phases = min(
                int(request.data['completed_phases']), roadmap.total_phases
            )
        if 'phase_progress' in request.data:
            roadmap.phase_progress = request.data['phase_progress']
        if 'title' in request.data:
            roadmap.title = request.data['title']

        roadmap.save()
        return Response({'message': 'Roadmap updated successfully'})

    def delete(self, request, pk):
        roadmap = get_object_or_404(SavedRoadmap, pk=pk, user=request.user)
        roadmap.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==================================================================
#  Decision Matrix Builder Views
# ==================================================================

class DecisionMatrixBuilderView(BaseToolView):
    """Generate a comprehensive AI-powered decision matrix"""
    tool_slug = 'decision-matrix-builder'

    def post(self, request):
        from rest_framework import serializers as drf_serializers

        class DecisionMatrixSerializer(drf_serializers.Serializer):
            topic = drf_serializers.CharField(
                required=True,
                max_length=500,
                help_text="The decision topic"
            )
            options = drf_serializers.ListField(
                child=drf_serializers.CharField(max_length=200),
                min_length=2,
                max_length=8,
                help_text="List of options to compare"
            )
            criteria = drf_serializers.ListField(
                child=drf_serializers.CharField(max_length=200),
                min_length=2,
                max_length=10,
                help_text="List of evaluation criteria"
            )
            weights = drf_serializers.ListField(
                child=drf_serializers.IntegerField(min_value=1, max_value=10),
                min_length=2,
                max_length=10,
                help_text="Weights for each criterion (1-10)"
            )
            context = drf_serializers.CharField(
                required=False,
                allow_blank=True,
                max_length=1000,
                help_text="Additional context or constraints"
            )

            def validate(self, data):
                if len(data['criteria']) != len(data['weights']):
                    raise drf_serializers.ValidationError(
                        "Number of criteria must match number of weights."
                    )
                return data

        serializer = DecisionMatrixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()
        start_time = time.time()

        try:
            result = ai_service.generate_decision_matrix(
                topic=serializer.validated_data['topic'],
                options=serializer.validated_data['options'],
                criteria=serializer.validated_data['criteria'],
                weights=serializer.validated_data['weights'],
                context=serializer.validated_data.get('context', ''),
            )

            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Decision Matrix Builder")


class SavedDecisionMatrixListView(APIView):
    """List and create saved decision matrices"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        matrices = SavedDecisionMatrix.objects.filter(user=request.user)
        data = []
        for m in matrices:
            data.append({
                'id': str(m.id),
                'title': m.title,
                'topic': m.topic,
                'winner': m.winner,
                'options_count': m.options_count,
                'criteria_count': m.criteria_count,
                'is_favorite': m.is_favorite,
                'created_at': m.created_at.isoformat(),
                'updated_at': m.updated_at.isoformat(),
            })
        return Response(data)

    def post(self, request):
        matrix_data = request.data.get('matrix_data')
        if not matrix_data:
            return Response({'error': 'matrix_data is required'}, status=status.HTTP_400_BAD_REQUEST)

        title = matrix_data.get('title', 'Untitled Decision')
        recommendation = matrix_data.get('recommendation', {})

        matrix = SavedDecisionMatrix.objects.create(
            user=request.user,
            title=title,
            topic=matrix_data.get('overview', ''),
            matrix_data=matrix_data,
            winner=recommendation.get('winner', ''),
            options_count=len(matrix_data.get('options', [])),
            criteria_count=len(matrix_data.get('criteria', [])),
        )

        return Response({
            'id': str(matrix.id),
            'title': matrix.title,
            'message': 'Decision matrix saved successfully',
        }, status=status.HTTP_201_CREATED)


class SavedDecisionMatrixDetailView(APIView):
    """Get, update or delete a saved decision matrix"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        matrix = get_object_or_404(SavedDecisionMatrix, pk=pk, user=request.user)
        return Response({
            'id': str(matrix.id),
            'title': matrix.title,
            'topic': matrix.topic,
            'matrix_data': matrix.matrix_data,
            'winner': matrix.winner,
            'options_count': matrix.options_count,
            'criteria_count': matrix.criteria_count,
            'is_favorite': matrix.is_favorite,
            'notes': matrix.notes,
            'created_at': matrix.created_at.isoformat(),
            'updated_at': matrix.updated_at.isoformat(),
        })

    def patch(self, request, pk):
        matrix = get_object_or_404(SavedDecisionMatrix, pk=pk, user=request.user)

        if 'is_favorite' in request.data:
            matrix.is_favorite = request.data['is_favorite']
        if 'notes' in request.data:
            matrix.notes = request.data['notes']
        if 'title' in request.data:
            matrix.title = request.data['title']

        matrix.save()
        return Response({'message': 'Decision matrix updated successfully'})

    def delete(self, request, pk):
        matrix = get_object_or_404(SavedDecisionMatrix, pk=pk, user=request.user)
        matrix.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==================================================================
#  Itinerary Planner Views
# ==================================================================

class ItineraryPlannerView(BaseToolView):
    """Generate a comprehensive AI-powered travel itinerary"""
    tool_slug = 'itinerary-planner'

    def post(self, request):
        from rest_framework import serializers as drf_serializers

        class ItinerarySerializer(drf_serializers.Serializer):
            destination = drf_serializers.CharField(
                required=True,
                max_length=300,
                help_text="Travel destination"
            )
            duration = drf_serializers.CharField(
                required=True,
                max_length=50,
                help_text="Trip duration e.g. '5 days'"
            )
            budget = drf_serializers.CharField(
                required=True,
                max_length=100,
                help_text="Budget level e.g. 'Budget ($50/day)', 'Mid-range', 'Luxury'"
            )
            interests = drf_serializers.ListField(
                child=drf_serializers.CharField(max_length=100),
                min_length=1,
                max_length=10,
                help_text="List of interests/activities"
            )
            group_size = drf_serializers.CharField(
                required=True,
                max_length=50,
                help_text="Group size e.g. 'Solo', '2 people', 'Family of 4'"
            )
            travel_style = drf_serializers.CharField(
                required=False,
                allow_blank=True,
                max_length=200,
                help_text="Travel style preferences"
            )
            special_requirements = drf_serializers.CharField(
                required=False,
                allow_blank=True,
                max_length=500,
                help_text="Special requirements or notes"
            )

        serializer = ItinerarySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = self.get_tool()
        ai_service = AIService()
        start_time = time.time()

        try:
            result = ai_service.generate_itinerary(
                destination=serializer.validated_data['destination'],
                duration=serializer.validated_data['duration'],
                budget=serializer.validated_data['budget'],
                interests=serializer.validated_data['interests'],
                group_size=serializer.validated_data['group_size'],
                travel_style=serializer.validated_data.get('travel_style', ''),
                special_requirements=serializer.validated_data.get('special_requirements', ''),
            )

            processing_time = time.time() - start_time

            usage = self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=result,
                processing_time=processing_time,
            )

            return self.build_success_response(result, usage, processing_time)

        except Exception as e:
            processing_time = time.time() - start_time
            self.create_usage_record(
                user=request.user,
                tool=tool,
                input_data=serializer.validated_data,
                output_data=None,
                processing_time=processing_time,
                error_message=str(e),
            )
            return self.handle_ai_error(e, "Itinerary Planner")


class SavedItineraryListView(APIView):
    """List and create saved itineraries"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        itineraries = SavedItinerary.objects.filter(user=request.user)
        data = []
        for it in itineraries:
            data.append({
                'id': str(it.id),
                'title': it.title,
                'destination': it.destination,
                'duration': it.duration,
                'budget': it.budget,
                'total_days': it.total_days,
                'is_favorite': it.is_favorite,
                'created_at': it.created_at.isoformat(),
                'updated_at': it.updated_at.isoformat(),
            })
        return Response(data)

    def post(self, request):
        itinerary_data = request.data.get('itinerary_data')
        if not itinerary_data:
            return Response({'error': 'itinerary_data is required'}, status=status.HTTP_400_BAD_REQUEST)

        title = itinerary_data.get('title', 'Untitled Itinerary')
        daily_plans = itinerary_data.get('dailyPlans', [])

        itinerary = SavedItinerary.objects.create(
            user=request.user,
            title=title,
            destination=itinerary_data.get('destination', ''),
            itinerary_data=itinerary_data,
            duration=itinerary_data.get('duration', ''),
            budget=str(itinerary_data.get('totalEstimatedBudget', {}).get('min', '')) + '-' +
                   str(itinerary_data.get('totalEstimatedBudget', {}).get('max', '')) + ' ' +
                   str(itinerary_data.get('totalEstimatedBudget', {}).get('currency', 'USD')),
            total_days=len(daily_plans),
        )

        return Response({
            'id': str(itinerary.id),
            'title': itinerary.title,
            'message': 'Itinerary saved successfully',
        }, status=status.HTTP_201_CREATED)


class SavedItineraryDetailView(APIView):
    """Get, update or delete a saved itinerary"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        itinerary = get_object_or_404(SavedItinerary, pk=pk, user=request.user)
        return Response({
            'id': str(itinerary.id),
            'title': itinerary.title,
            'destination': itinerary.destination,
            'itinerary_data': itinerary.itinerary_data,
            'duration': itinerary.duration,
            'budget': itinerary.budget,
            'total_days': itinerary.total_days,
            'is_favorite': itinerary.is_favorite,
            'notes': itinerary.notes,
            'created_at': itinerary.created_at.isoformat(),
            'updated_at': itinerary.updated_at.isoformat(),
        })

    def patch(self, request, pk):
        itinerary = get_object_or_404(SavedItinerary, pk=pk, user=request.user)

        if 'is_favorite' in request.data:
            itinerary.is_favorite = request.data['is_favorite']
        if 'notes' in request.data:
            itinerary.notes = request.data['notes']
        if 'title' in request.data:
            itinerary.title = request.data['title']

        itinerary.save()
        return Response({'message': 'Itinerary updated successfully'})

    def delete(self, request, pk):
        itinerary = get_object_or_404(SavedItinerary, pk=pk, user=request.user)
        itinerary.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==================================================================
#  Document Export View
# ==================================================================

class DocumentExportView(APIView):
    """Export tool output as PDF, DOCX, or Markdown"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        export_format = request.data.get('format', 'markdown')
        title = request.data.get('title', 'Sovereign Export')
        content = request.data.get('content', '')
        sections = request.data.get('sections', [])

        if not content and not sections:
            return Response(
                {'error': 'Please provide content or sections to export.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if export_format == 'pdf':
                return self._export_pdf(title, content, sections)
            elif export_format == 'docx':
                return self._export_docx(title, content, sections)
            else:
                return self._export_markdown(title, content, sections)
        except Exception as e:
            logger.error(f"Export error: {e}")
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _export_markdown(self, title, content, sections):
        """Export as Markdown text"""
        md_lines = [f"# {title}\n"]
        if content:
            md_lines.append(content)
        for section in sections:
            md_lines.append(f"\n## {section.get('heading', '')}\n")
            md_lines.append(section.get('body', ''))
        md_text = "\n".join(md_lines)

        from django.http import HttpResponse
        response = HttpResponse(md_text, content_type='text/markdown')
        response['Content-Disposition'] = f'attachment; filename="{title.replace(" ", "_")}.md"'
        return response

    def _export_pdf(self, title, content, sections):
        """Export as PDF using reportlab"""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        import io as _io

        buffer = _io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                topMargin=0.75 * inch, bottomMargin=0.75 * inch)
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=20, spaceAfter=20)
        heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, spaceAfter=10)
        body_style = ParagraphStyle('CustomBody', parent=styles['Normal'], fontSize=11, leading=16, spaceAfter=8)

        story = []
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 0.25 * inch))

        if content:
            for para in content.split('\n\n'):
                if para.strip():
                    safe_para = para.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    story.append(Paragraph(safe_para, body_style))

        for section in sections:
            heading = section.get('heading', '')
            body = section.get('body', '')
            if heading:
                safe_heading = heading.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                story.append(Spacer(1, 0.15 * inch))
                story.append(Paragraph(safe_heading, heading_style))
            if body:
                for para in body.split('\n\n'):
                    if para.strip():
                        safe_para = para.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        story.append(Paragraph(safe_para, body_style))

        doc.build(story)
        buffer.seek(0)

        from django.http import HttpResponse
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{title.replace(" ", "_")}.pdf"'
        return response

    def _export_docx(self, title, content, sections):
        """Export as DOCX using python-docx"""
        from docx import Document as DocxDocument
        from docx.shared import Pt
        import io as _io

        doc = DocxDocument()
        doc.add_heading(title, level=0)

        if content:
            for para in content.split('\n\n'):
                if para.strip():
                    p = doc.add_paragraph(para.strip())
                    for run in p.runs:
                        run.font.size = Pt(11)

        for section in sections:
            heading = section.get('heading', '')
            body = section.get('body', '')
            if heading:
                doc.add_heading(heading, level=2)
            if body:
                for para in body.split('\n\n'):
                    if para.strip():
                        p = doc.add_paragraph(para.strip())
                        for run in p.runs:
                            run.font.size = Pt(11)

        buffer = _io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        from django.http import HttpResponse
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        response['Content-Disposition'] = f'attachment; filename="{title.replace(" ", "_")}.docx"'
        return response


# ── Public (anonymous) tool endpoints ─────────────────────────────

class PublicToolThrottle(AnonRateThrottle):
    """Limit anonymous users to 5 tool uses per day."""
    rate = '5/day'
    scope = 'public_tools'


class PublicToolView(APIView):
    """Base view for public (no-login) AI tool endpoints."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PublicToolThrottle]
    tool_slug = None

    def get_tool(self):
        return get_object_or_404(Tool, slug=self.tool_slug, is_active=True)


class PublicParaphraseView(PublicToolView):
    """Public paraphrase — limited to 5 per day for anonymous users."""
    tool_slug = 'paraphrase'

    def post(self, request):
        serializer = ParaphraseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_service = AIService()
        start_time = time.time()
        try:
            result = ai_service.paraphrase(
                text=serializer.validated_data['text'],
                mode=serializer.validated_data['mode'],
            )
            processing_time = time.time() - start_time
            return Response({
                'result': result,
                'processing_time': processing_time,
            })
        except Exception as e:
            return Response(
                {'error': 'Failed to paraphrase text. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PublicGrammarCheckView(PublicToolView):
    """Public grammar check — limited to 5 per day for anonymous users."""
    tool_slug = 'grammar-check'

    def post(self, request):
        serializer = GrammarCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_service = AIService()
        start_time = time.time()
        try:
            result = ai_service.check_grammar(
                text=serializer.validated_data['text'],
            )
            processing_time = time.time() - start_time
            return Response({
                'result': result,
                'processing_time': processing_time,
            })
        except Exception as e:
            return Response(
                {'error': 'Failed to check grammar. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PublicSummarizerView(PublicToolView):
    """Public summarizer — limited to 5 per day for anonymous users."""
    tool_slug = 'summarizer'

    def post(self, request):
        serializer = SummarizerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_service = AIService()
        start_time = time.time()
        try:
            result = ai_service.summarize(
                text=serializer.validated_data['text'],
                length=serializer.validated_data['length'],
            )
            processing_time = time.time() - start_time
            return Response({
                'result': result,
                'processing_time': processing_time,
            })
        except Exception as e:
            return Response(
                {'error': 'Failed to summarize text. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ── Shareable results ─────────────────────────────────────────────

class ShareResultView(APIView):
    """Create a shareable public link for a tool result."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .models import SharedResult
        content = request.data.get('content', '')
        title = request.data.get('title', 'Sovereign Result')
        tool_name = request.data.get('tool_name', '')

        if not content:
            return Response({'error': 'Content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        shared = SharedResult.objects.create(
            user=request.user,
            title=title,
            tool_name=tool_name,
            content=content,
        )
        share_url = f"{getattr(settings, 'FRONTEND_URL', 'https://sovereign.com')}/shared/{shared.share_id}"
        return Response({
            'share_id': str(shared.share_id),
            'share_url': share_url,
        }, status=status.HTTP_201_CREATED)


class SharedResultDetailView(APIView):
    """Retrieve a shared result by its public share_id."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, share_id):
        from .models import SharedResult
        shared = get_object_or_404(SharedResult, share_id=share_id)
        shared.view_count += 1
        shared.save(update_fields=['view_count'])

        return Response({
            'share_id': str(shared.share_id),
            'title': shared.title,
            'tool_name': shared.tool_name,
            'content': shared.content,
            'created_at': shared.created_at,
            'author': shared.user.get_short_name(),
            'view_count': shared.view_count,
        })