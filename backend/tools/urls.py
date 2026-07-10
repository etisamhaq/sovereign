from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'tools'

router = DefaultRouter()
router.register(r'documents', views.DocumentViewSet, basename='document')
router.register(r'templates', views.TemplateViewSet, basename='template')
router.register(r'saved-results', views.SavedResultViewSet, basename='saved-result')

urlpatterns = [
    # Tool list
    path('', views.ToolListView.as_view(), name='tool_list'),
    path('marketplace/', views.MarketplaceToolListView.as_view(), name='marketplace_tool_list'),
    path('marketplace/submissions/', views.MarketplaceSubmissionView.as_view(), name='marketplace_submissions'),
    path('marketplace/<slug:slug>/', views.MarketplaceToolDetailView.as_view(), name='marketplace_tool_detail'),
    path('marketplace/<slug:slug>/click/', views.MarketplaceToolClickView.as_view(), name='marketplace_tool_click'),

    # AI-powered tools (specific endpoints must come before slug pattern)
    path('paraphrase/', views.ParaphraseView.as_view(), name='paraphrase'),
    path('grammar-check/', views.GrammarCheckView.as_view(), name='grammar_check'),
    path('essay-writer/', views.EssayGeneratorView.as_view(), name='essay_writer'),
    path('summarizer/', views.SummarizerView.as_view(), name='summarizer'),
    path('plagiarism-check/', views.PlagiarismCheckView.as_view(), name='plagiarism_check'),
    path('writing-improver/', views.WritingImproverView.as_view(), name='writing_improver'),
    path('outline-generator/', views.OutlineGeneratorView.as_view(), name='outline_generator'),
    path('translator/', views.TranslationView.as_view(), name='translator'),
    path('title-generator/', views.TitleGeneratorView.as_view(), name='title_generator'),
    path('tone-analyzer/', views.ToneAnalyzerView.as_view(), name='tone_analyzer'),
    path('citation-generator/', views.CitationGeneratorView.as_view(), name='citation_generator'),
    path('flashcard-creator/', views.FlashcardGeneratorView.as_view(), name='flashcard_creator'),
    path('quiz-generator/', views.QuizGeneratorView.as_view(), name='quiz_generator'),
    path('quiz-generator/evaluate/', views.QuizEvaluationView.as_view(), name='quiz_evaluate'),
    path('research-assistant/', views.ResearchAssistantView.as_view(), name='research_assistant'),
    path('meta-description-generator/', views.MetaDescriptionGeneratorView.as_view(), name='meta_description_generator'),
    path('content-calendar/', views.ContentCalendarView.as_view(), name='content_calendar'),
    path('course-outline-creator/', views.CourseOutlineCreatorView.as_view(), name='course_outline_creator'),
    path('linkedin-post-optimizer/', views.LinkedInPostOptimizerView.as_view(), name='linkedin_post_optimizer'),
    path('keyword-extractor/', views.KeywordExtractorView.as_view(), name='keyword_extractor'),
    path('email-writer/', views.EmailWriterView.as_view(), name='email_writer'),
    path('social-media-generator/', views.SocialMediaGeneratorView.as_view(), name='social_media_generator'),
    path('resume-builder/', views.ResumeBuilderView.as_view(), name='resume_builder'),
    path('code-generator/', views.CodeGeneratorView.as_view(), name='code_generator'),
    path('blog-post-generator/', views.BlogPostGeneratorView.as_view(), name='blog_post_generator'),
    path('youtube-script-writer/', views.YouTubeScriptWriterView.as_view(), name='youtube_script_writer'),
    path('cover-letter-writer/', views.CoverLetterWriterView.as_view(), name='cover_letter_writer'),
    path('ad-copy-generator/', views.AdCopyGeneratorView.as_view(), name='ad_copy_generator'),
    path('document-analyzer/', views.DocumentAnalyzerView.as_view(), name='document_analyzer'),
    path('roadmap-builder/', views.RoadmapBuilderView.as_view(), name='roadmap_builder'),
    path('roadmap-builder/saved/', views.SavedRoadmapListView.as_view(), name='saved_roadmap_list'),
    path('roadmap-builder/saved/<uuid:pk>/', views.SavedRoadmapDetailView.as_view(), name='saved_roadmap_detail'),
    path('decision-matrix-builder/', views.DecisionMatrixBuilderView.as_view(), name='decision_matrix_builder'),
    path('decision-matrix-builder/saved/', views.SavedDecisionMatrixListView.as_view(), name='saved_decision_matrix_list'),
    path('decision-matrix-builder/saved/<uuid:pk>/', views.SavedDecisionMatrixDetailView.as_view(), name='saved_decision_matrix_detail'),
    path('itinerary-planner/', views.ItineraryPlannerView.as_view(), name='itinerary_planner'),
    path('itinerary-planner/saved/', views.SavedItineraryListView.as_view(), name='saved_itinerary_list'),
    path('itinerary-planner/saved/<uuid:pk>/', views.SavedItineraryDetailView.as_view(), name='saved_itinerary_detail'),
    path('export/', views.DocumentExportView.as_view(), name='document_export'),

    # VisiSense AI endpoints
    path('visisense-ai/analyze/', views.VisiSenseAnalyzeView.as_view(), name='visisense_analyze'),
    path('visisense-ai/question/', views.VisiSenseQuestionView.as_view(), name='visisense_question'),
    path('visisense-ai/translate/', views.VisiSenseTranslateView.as_view(), name='visisense_translate'),
    path('visisense-ai/extract/', views.VisiSenseExtractView.as_view(), name='visisense_extract'),
    path('visisense-ai/summary/', views.VisiSenseSummaryView.as_view(), name='visisense_summary'),

    # Video Downloader endpoints
    path('video-download/info/', views.VideoInfoView.as_view(), name='video_info'),
    path('video-download/download/', views.VideoDownloadView.as_view(), name='video_download'),
    path('video-download/embed/', views.VideoEmbedView.as_view(), name='video_embed'),
    path('video-download/file/<str:file_id>/', views.VideoFileDownloadView.as_view(), name='video_file'),

    # Video Chat endpoints
    path('video-chat/chat/', views.VideoChatView.as_view(), name='video_chat'),
    path('video-chat/transcript/', views.VideoTranscriptView.as_view(), name='video_transcript'),
    path('video-chat/summary/', views.VideoSummaryView.as_view(), name='video_summary'),
    path('video-chat/key-moments/', views.VideoKeyMomentsView.as_view(), name='video_key_moments'),

    # Content Repurposer endpoints
    path('content-repurposer/process/', views.ContentRepurposerProcessView.as_view(), name='content_repurposer_process'),
    path('content-repurposer/generate/', views.ContentRepurposerGenerateView.as_view(), name='content_repurposer_generate'),
    path('content-repurposer/regenerate/', views.ContentRepurposerRegenerateView.as_view(), name='content_repurposer_regenerate'),

    # Image Comparison endpoints
    path('image-comparison/compare/', views.ImageComparisonView.as_view(), name='image_comparison'),

    # Usage history
    path('usage-history/', views.ToolUsageHistoryView.as_view(), name='usage_history'),

    # Include router URLs (must come before slug catch-all)
    path('', include(router.urls)),

    # Public (no-login) tool endpoints
    path('public/paraphrase/', views.PublicParaphraseView.as_view(), name='public_paraphrase'),
    path('public/grammar-check/', views.PublicGrammarCheckView.as_view(), name='public_grammar_check'),
    path('public/summarizer/', views.PublicSummarizerView.as_view(), name='public_summarizer'),

    # Shareable results
    path('share/', views.ShareResultView.as_view(), name='share_result'),
    path('shared/<uuid:share_id>/', views.SharedResultDetailView.as_view(), name='shared_result_detail'),

    # Tool detail (must come after all specific endpoints and router URLs)
    path('<slug:slug>/', views.ToolDetailView.as_view(), name='tool_detail'),
]