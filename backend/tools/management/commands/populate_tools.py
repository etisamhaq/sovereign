from django.core.management.base import BaseCommand
from tools.models import Tool


class Command(BaseCommand):
    help = 'Populate initial tools data'

    def handle(self, *args, **options):
        tools_data = [
            {
                'name': 'AI Paraphrasing Tool',
                'slug': 'paraphrase',
                'description': 'Rewrite any text instantly with multiple modes including formal, creative, and simple styles.',
                'category': 'writing',
                'icon': 'DocumentTextIcon',
                'is_premium': False,
                'config': {'max_length': 5000}
            },
            {
                'name': 'Grammar & Style Checker',
                'slug': 'grammar-check',
                'description': 'Fix grammar errors and improve your writing style with AI-powered suggestions.',
                'category': 'writing',
                'icon': 'CheckCircleIcon',
                'is_premium': False,
                'config': {'max_length': 5000}
            },
            {
                'name': 'Essay Generator',
                'slug': 'essay-generator',
                'description': 'Generate high-quality essays on any topic with customizable length and style.',
                'category': 'education',
                'icon': 'DocumentIcon',
                'is_premium': True,
                'config': {'max_length': 10000}
            },
            {
                'name': 'Text Summarizer',
                'slug': 'summarizer',
                'description': 'Condense long texts into concise summaries while preserving key information.',
                'category': 'utility',
                'icon': 'DocumentDuplicateIcon',
                'is_premium': False,
                'config': {'max_length': 10000}
            },
            {
                'name': 'Plagiarism Checker',
                'slug': 'plagiarism-check',
                'description': 'Check your content for potential plagiarism and ensure originality.',
                'category': 'education',
                'icon': 'ShieldCheckIcon',
                'is_premium': True,
                'config': {'max_length': 10000}
            },
            {
                'name': 'Writing Improver',
                'slug': 'writing-improver',
                'description': 'Enhance your writing with AI suggestions for clarity, engagement, and impact.',
                'category': 'writing',
                'icon': 'SparklesIcon',
                'is_premium': False,
                'config': {'max_length': 5000}
            },
            {
                'name': 'Outline Generator',
                'slug': 'outline-generator',
                'description': 'Create structured outlines for essays, articles, and research papers.',
                'category': 'education',
                'icon': 'ListBulletIcon',
                'is_premium': False,
                'config': {'max_length': 1000}
            },
            {
                'name': 'Language Translator',
                'slug': 'translator',
                'description': 'Translate text between multiple languages with high accuracy.',
                'category': 'utility',
                'icon': 'LanguageIcon',
                'is_premium': False,
                'config': {'max_length': 5000}
            },
            {
                'name': 'Title Generator',
                'slug': 'title-generator',
                'description': 'Generate catchy and SEO-friendly titles for your content.',
                'category': 'seo',
                'icon': 'HashtagIcon',
                'is_premium': False,
                'config': {'max_suggestions': 10}
            },
            {
                'name': 'Tone Analyzer',
                'slug': 'tone-analyzer',
                'description': 'Analyze the tone and emotion of your text to ensure it matches your intent.',
                'category': 'writing',
                'icon': 'FaceSmileIcon',
                'is_premium': True,
                'config': {'max_length': 5000}
            },
            {
                'name': 'Citation Generator',
                'slug': 'citation-generator',
                'description': 'Generate properly formatted citations in APA, MLA, Chicago, and other styles.',
                'category': 'education',
                'icon': 'BookOpenIcon',
                'is_premium': False,
                'config': {}
            },
            {
                'name': 'Flashcard Generator',
                'slug': 'flashcard-generator',
                'description': 'Create study flashcards from your notes or text automatically.',
                'category': 'education',
                'icon': 'RectangleStackIcon',
                'is_premium': False,
                'config': {'max_cards': 50}
            },
            {
                'name': 'Quiz Generator',
                'slug': 'quiz-generator',
                'description': 'Generate quizzes and practice tests from your study material.',
                'category': 'education',
                'icon': 'ClipboardDocumentListIcon',
                'is_premium': True,
                'config': {'max_questions': 30}
            },
            {
                'name': 'Keyword Extractor',
                'slug': 'keyword-extractor',
                'description': 'Extract important keywords and phrases from your content for SEO.',
                'category': 'seo',
                'icon': 'KeyIcon',
                'is_premium': False,
                'config': {'max_keywords': 20}
            },
            {
                'name': 'Meta Description Generator',
                'slug': 'meta-description',
                'description': 'Create compelling meta descriptions for better search engine visibility.',
                'category': 'seo',
                'icon': 'MagnifyingGlassIcon',
                'is_premium': False,
                'config': {'max_length': 160}
            },
            {
                'name': 'Smart Research Assistant',
                'slug': 'research-assistant',
                'description': 'AI-powered research tool that automatically finds sources, extracts facts, and creates comprehensive research reports with visual knowledge maps.',
                'category': 'education',
                'icon': 'AcademicCapIcon',
                'is_premium': True,
                'config': {
                    'max_sources': 20,
                    'depth_levels': ['quick', 'standard', 'deep'],
                    'export_formats': ['pdf', 'docx', 'md', 'html']
                }
            },
            {
                'name': 'Prepza',
                'slug': 'prepza',
                'description': 'Data preprocessing tool for ML models. Prepare and transform your data for machine learning applications with ease.',
                'category': 'utility',
                'icon': 'CubeTransparentIcon',
                'is_premium': True,
                'is_implemented': True,
                'external_url': 'https://prepza.onrender.com/',
                'config': {
                    'external_tool': True,
                    'features': ['data_cleaning', 'transformation', 'normalization']
                }
            },
            {
                'name': 'Logiforge',
                'slug': 'logiforge',
                'description': 'Educational tool for learning Data Structures and Algorithms (DSA) visually. Master Linked Lists, Trees, Heaps, Hashing, and Discrete Math concepts with interactive visualizations and quizzes.',
                'category': 'education',
                'icon': 'CubeIcon',
                'is_premium': True,
                'is_implemented': True,
                'external_url': 'https://logiforge-frontend.onrender.com/',
                'config': {
                    'external_tool': False,
                    'topics': ['linked_list', 'trees', 'heap', 'hashing', 'discrete_math'],
                    'features': ['visualization', 'quiz', 'step_by_step']
                }
            },
            {
                'name': 'AI Blog Post Generator',
                'slug': 'blog-post-generator',
                'description': 'Generate complete, SEO-optimized blog posts with structured sections, meta descriptions, tags, and social media snippets on any topic.',
                'category': 'writing',
                'icon': 'newspaper',
                'is_premium': True,
                'is_implemented': True,
                'config': {'max_length': 10000}
            },
            {
                'name': 'YouTube Script Writer',
                'slug': 'youtube-script-writer',
                'description': 'Create engaging YouTube video scripts with hooks, intros, visual cue notes, segment breakdowns, outros, and optimized descriptions with tags.',
                'category': 'writing',
                'icon': 'film',
                'is_premium': True,
                'is_implemented': True,
                'config': {'max_duration': 30}
            },
            {
                'name': 'AI Cover Letter Writer',
                'slug': 'cover-letter-writer',
                'description': 'Craft personalized, job-specific cover letters that highlight your strengths and match the role — complete with email subject lines and customization tips.',
                'category': 'writing',
                'icon': 'envelope-open',
                'is_premium': False,
                'is_implemented': True,
                'config': {'max_length': 5000}
            },
            {
                'name': 'Ad Copy Generator',
                'slug': 'ad-copy-generator',
                'description': 'Generate high-converting ad copy for Google, Facebook, Instagram, LinkedIn, and TikTok with multiple variations, targeting suggestions, and A/B testing tips.',
                'category': 'seo',
                'icon': 'megaphone',
                'is_premium': True,
                'is_implemented': True,
                'config': {'max_variations': 5}
            },
            {
                'name': 'AI Document Analyzer',
                'slug': 'document-analyzer',
                'description': 'Analyze any document or text — get summaries, key findings, themes, entity extraction, action items, sentiment analysis, and Q&A answers powered by AI.',
                'category': 'utility',
                'icon': 'document-magnifying-glass',
                'is_premium': True,
                'is_implemented': True,
                'config': {'max_length': 50000}
            },
        ]

        created_count = 0
        for tool_data in tools_data:
            tool, created = Tool.objects.get_or_create(
                slug=tool_data['slug'],
                defaults=tool_data
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created tool: {tool.name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Tool already exists: {tool.name}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} tools')
        )