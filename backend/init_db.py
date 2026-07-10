#!/usr/bin/env python
"""
Initialize database with sample data
"""
import os
import sys
import django

# Add the project directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from tools.models import Tool, Template, MarketplaceTool

User = get_user_model()


def create_tools():
    """Create initial tools"""
    # List of implemented tools
    implemented_slugs = [
        'paraphrase', 'grammar-check', 'essay-writer', 'summarizer',
        'plagiarism-check', 'writing-improver', 'outline-generator',
        'translator', 'title-generator', 'tone-analyzer',
        'citation-generator', 'flashcard-creator', 'quiz-generator',
        'meta-description-generator', 'content-calendar',
        'course-outline-creator', 'roadmap-builder', 'decision-matrix-builder',
        'itinerary-planner',
        'visisense-ai', 'video-downloader',
        'image-comparison', 'research-assistant', 'linkedin-post-optimizer',
        'keyword-extractor', 'prepza', 'logiforge',
        'blog-post-generator', 'youtube-script-writer',
        'cover-letter-writer', 'ad-copy-generator', 'document-analyzer',
    ]

    tools = [
        {
            'name': 'AI Paraphrasing Tool',
            'slug': 'paraphrase',
            'description': 'Rewrite any text instantly with multiple modes including formal, creative, and simple styles.',
            'category': 'writing',
            'icon': 'pencil-square',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'Grammar & Style Checker',
            'slug': 'grammar-check',
            'description': 'Fix grammar errors and improve your writing style with AI-powered suggestions.',
            'category': 'writing',
            'icon': 'check-badge',
            'is_premium': False,
        },
        {
            'name': 'AI Essay Writer',
            'slug': 'essay-writer',
            'description': 'Generate well-structured essays on any topic with proper introduction, body, and conclusion.',
            'category': 'writing',
            'icon': 'document-text',
            'is_premium': True,
        },
        {
            'name': 'Text Summarizer',
            'slug': 'summarizer',
            'description': 'Condense long texts into concise summaries while preserving key information.',
            'category': 'education',
            'icon': 'document-text',
            'is_premium': False,
        },
        {
            'name': 'Plagiarism Checker',
            'slug': 'plagiarism-check',
            'description': 'Check your text for potential plagiarism and ensure originality.',
            'category': 'writing',
            'icon': 'magnifying-glass',
            'is_premium': True,
        },
        {
            'name': 'Writing Improver',
            'slug': 'writing-improver',
            'description': 'Enhance your writing with focus on clarity, engagement, or professional tone.',
            'category': 'writing',
            'icon': 'sparkles',
            'is_premium': False,
        },
        {
            'name': 'Content Outline Generator',
            'slug': 'outline-generator',
            'description': 'Create detailed outlines for essays, articles, reports, and presentations.',
            'category': 'writing',
            'icon': 'chart-bar',
            'is_premium': False,
        },
        {
            'name': 'Language Translator',
            'slug': 'translator',
            'description': 'Translate text between 20+ languages while preserving context and meaning.',
            'category': 'utility',
            'icon': 'language',
            'is_premium': False,
        },
        {
            'name': 'Title Generator',
            'slug': 'title-generator',
            'description': 'Generate catchy titles for your content with various styles.',
            'category': 'writing',
            'icon': 'sparkles',
            'is_premium': False,
        },
        {
            'name': 'Tone Analyzer',
            'slug': 'tone-analyzer',
            'description': 'Analyze the tone and emotion of your text with detailed insights.',
            'category': 'writing',
            'icon': 'chart-bar',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'Citation Generator',
            'slug': 'citation-generator',
            'description': 'Generate accurate citations in APA, MLA, Chicago, and Harvard styles.',
            'category': 'education',
            'icon': 'academic-cap',
            'is_premium': False,
        },
        {
            'name': 'Flashcard Creator',
            'slug': 'flashcard-creator',
            'description': 'Convert your study material into interactive flashcards.',
            'category': 'education',
            'icon': 'academic-cap',
            'is_premium': False,
        },
        {
            'name': 'Quiz Generator',
            'slug': 'quiz-generator',
            'description': 'Create multiple-choice quizzes from any text content.',
            'category': 'education',
            'icon': 'academic-cap',
            'is_premium': True,
        },
        {
            'name': 'Meta Description Generator',
            'slug': 'meta-description-generator',
            'description': 'Create compelling meta descriptions for better search engine visibility.',
            'category': 'writing',
            'icon': 'magnifying-glass',
            'is_premium': False,
        },
        {
            'name': 'Code Generator',
            'slug': 'code-generator',
            'description': 'Generate code snippets and functions in multiple programming languages with explanations and tests.',
            'category': 'utility',
            'icon': 'sparkles',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'Email Writer',
            'slug': 'email-writer',
            'description': 'Create professional emails for business, marketing, follow-ups, and personal communication with AI-powered suggestions.',
            'category': 'writing',
            'icon': 'pencil-square',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'Social Media Post Generator',
            'slug': 'social-media-generator',
            'description': 'Create engaging posts for Twitter, LinkedIn, Instagram, Facebook, TikTok, and Threads with hashtags and strategy tips.',
            'category': 'writing',
            'icon': 'sparkles',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'Resume Builder',
            'slug': 'resume-builder',
            'description': 'Build professional resumes with AI-powered suggestions, ATS optimization, and tailored formatting for any role.',
            'category': 'writing',
            'icon': 'document-text',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'Social Media Content Calendar',
            'slug': 'content-calendar',
            'description': 'Generate a complete 30-day content calendar for all social media platforms with hooks, captions, hashtags, and optimal posting times.',
            'category': 'seo',
            'icon': 'calendar',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'AI Course Outline Creator',
            'slug': 'course-outline-creator',
            'description': 'Generate comprehensive course outlines with modules, lessons, learning objectives, and assessments for any subject or skill.',
            'category': 'education',
            'icon': 'academic-cap',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'AI Roadmap Builder',
            'slug': 'roadmap-builder',
            'description': 'Generate personalized learning roadmaps with phases, resources, milestone projects, and progress tracking for any skill or topic.',
            'category': 'education',
            'icon': 'map',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'AI Decision Matrix Builder',
            'slug': 'decision-matrix-builder',
            'description': 'Make smarter decisions with AI-powered decision matrices. Compare options across weighted criteria with scores, visual analysis, recommendations, and sensitivity insights.',
            'category': 'utility',
            'icon': 'table-cells',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'AI Itinerary Planner',
            'slug': 'itinerary-planner',
            'description': 'Plan your perfect trip with AI-powered itineraries. Get personalized daily plans, restaurant picks, budget breakdowns, packing lists, and local tips for any destination.',
            'category': 'utility',
            'icon': 'globe-alt',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'VisiSense AI - Screen Analyzer',
            'slug': 'visisense-ai',
            'description': 'Intelligent real-time screen companion that analyzes screenshots, extracts text in multiple languages, and provides instant AI-powered insights and answers about any content on your screen.',
            'category': 'utility',
            'icon': 'eye',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'Video Downloader',
            'slug': 'video-downloader',
            'description': 'Download videos from YouTube and Instagram with multiple quality options and format choices including MP4, WebM, and MP3 audio.',
            'category': 'utility',
            'icon': 'video-camera',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'Video Chat AI',
            'slug': 'video-chat',
            'description': 'Have intelligent conversations about any video content. Ask questions, get transcripts, generate summaries, and extract key insights from YouTube, Vimeo, and other video platforms.',
            'category': 'utility',
            'icon': 'chat-bubble-left-right',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'Image Comparison Tool',
            'slug': 'image-comparison',
            'description': 'Compare JPEG and PNG images across folders to identify identical and similar matches using advanced ML algorithms for shape, design, and geometric characteristics.',
            'category': 'utility',
            'icon': 'photograph',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'AI Content Repurposer',
            'slug': 'content-repurposer',
            'description': 'Transform any YouTube video or audio file into platform-ready content. Automatically transcribe, extract key insights, and generate LinkedIn posts, Twitter/X threads, and newsletter drafts in one click.',
            'category': 'seo',
            'icon': 'sparkles',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'Research Assistant',
            'slug': 'research-assistant',
            'description': 'Get comprehensive research summaries, source analysis, and key insights on any topic with AI-powered research assistance.',
            'category': 'education',
            'icon': 'magnifying-glass',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'LinkedIn Post Optimizer',
            'slug': 'linkedin-post-optimizer',
            'description': 'Optimize your LinkedIn posts for maximum engagement with AI-powered suggestions for hooks, hashtags, and formatting.',
            'category': 'seo',
            'icon': 'sparkles',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'Keyword Extractor',
            'slug': 'keyword-extractor',
            'description': 'Extract relevant keywords and phrases from any text for SEO optimization and content analysis.',
            'category': 'seo',
            'icon': 'magnifying-glass',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'AI Blog Post Generator',
            'slug': 'blog-post-generator',
            'description': 'Generate complete, SEO-optimized blog posts with structured sections, meta descriptions, tags, and social media snippets on any topic.',
            'category': 'writing',
            'icon': 'newspaper',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'YouTube Script Writer',
            'slug': 'youtube-script-writer',
            'description': 'Create engaging YouTube video scripts with hooks, intros, visual cue notes, segment breakdowns, outros, and optimized descriptions with tags.',
            'category': 'writing',
            'icon': 'film',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'AI Cover Letter Writer',
            'slug': 'cover-letter-writer',
            'description': 'Craft personalized, job-specific cover letters that highlight your strengths and match the role — complete with email subject lines and customization tips.',
            'category': 'writing',
            'icon': 'envelope-open',
            'is_premium': False,
            'is_implemented': True,
        },
        {
            'name': 'Ad Copy Generator',
            'slug': 'ad-copy-generator',
            'description': 'Generate high-converting ad copy for Google, Facebook, Instagram, LinkedIn, and TikTok with multiple variations, targeting suggestions, and A/B testing tips.',
            'category': 'seo',
            'icon': 'megaphone',
            'is_premium': True,
            'is_implemented': True,
        },
        {
            'name': 'AI Document Analyzer',
            'slug': 'document-analyzer',
            'description': 'Analyze any document or text — get summaries, key findings, themes, entity extraction, action items, sentiment analysis, and Q&A answers powered by AI.',
            'category': 'utility',
            'icon': 'document-magnifying-glass',
            'is_premium': True,
            'is_implemented': True,
        },
    ]

    for tool_data in tools:
        # Set is_implemented based on the list if not explicitly set
        if 'is_implemented' not in tool_data:
            tool_data['is_implemented'] = tool_data['slug'] in implemented_slugs

        Tool.objects.update_or_create(
            slug=tool_data['slug'],
            defaults=tool_data
        )

    print(f"Created {len(tools)} tools")


def create_templates():
    """Create initial templates"""
    templates = [
        {
            'name': 'Business Email Template',
            'slug': 'business-email',
            'description': 'Professional email template for business communication',
            'category': 'business',
            'content': '''Subject: {subject}

Dear {recipient_name},

I hope this email finds you well.

{main_content}

Best regards,
{sender_name}
{sender_title}
{company_name}''',
            'variables': ['subject', 'recipient_name', 'main_content', 'sender_name', 'sender_title', 'company_name'],
        },
        {
            'name': 'Essay Introduction',
            'slug': 'essay-introduction',
            'description': 'Standard introduction template for academic essays',
            'category': 'academic',
            'content': '''In recent years, {topic} has become increasingly important in {field}. This essay will examine {main_argument} by analyzing {point1}, {point2}, and {point3}. Through this analysis, it will be demonstrated that {thesis_statement}.''',
            'variables': ['topic', 'field', 'main_argument', 'point1', 'point2', 'point3', 'thesis_statement'],
        },
        {
            'name': 'Cover Letter',
            'slug': 'cover-letter',
            'description': 'Professional cover letter template for job applications',
            'category': 'business',
            'content': '''Dear Hiring Manager,

I am writing to express my strong interest in the {position} role at {company}. With my {years} years of experience in {field}, I am confident that I would be a valuable addition to your team.

{experience_paragraph}

{skills_paragraph}

I am excited about the opportunity to contribute to {company} and would welcome the chance to discuss how my skills and experience align with your needs.

Thank you for considering my application.

Sincerely,
{your_name}''',
            'variables': ['position', 'company', 'years', 'field', 'experience_paragraph', 'skills_paragraph', 'your_name'],
        },
    ]

    for template_data in templates:
        Template.objects.get_or_create(
            slug=template_data['slug'],
            defaults=template_data
        )

    print(f"Created {len(templates)} templates")


def create_marketplace_tools():
    """Create curated external marketplace tools."""
    marketplace_tools = [
        {
            'name': 'Prepza',
            'slug': 'prepza',
            'description': 'Data platform for practical data workflows and utilities.',
            'category': 'data',
            'external_url': 'https://prepza.onrender.com/',
            'icon': 'chart-bar',
            'is_free': True,
            'is_featured': True,
            'verified': True,
            'moderation_status': 'approved',
            'owner_name': 'Prepza Team',
        },
        {
            'name': 'Logiforge',
            'slug': 'logiforge',
            'description': 'DSA and discrete math logic builder for structured practice.',
            'category': 'education',
            'external_url': 'https://logiforge-frontend.onrender.com/',
            'icon': 'academic-cap',
            'is_free': True,
            'is_featured': True,
            'verified': True,
            'moderation_status': 'approved',
            'owner_name': 'Logiforge Team',
        },
        {
            'name': 'Vixora',
            'slug': 'vixora',
            'description': 'AI-powered creative tool for visual ideation and content workflows.',
            'category': 'creative',
            'external_url': 'https://vixora-frontend.onrender.com/',
            'icon': 'sparkles',
            'is_free': True,
            'is_featured': True,
            'verified': True,
            'moderation_status': 'approved',
            'owner_name': 'Vixora Team',
        },
        {
            'name': 'Slideo',
            'slug': 'slideo',
            'description': 'AI presentation assistant for creating polished slide decks quickly.',
            'category': 'productivity',
            'external_url': 'https://presentation-frontend-tkem.onrender.com/',
            'icon': 'document-text',
            'is_free': True,
            'is_featured': True,
            'verified': True,
            'moderation_status': 'approved',
            'owner_name': 'Slideo Team',
        },
    ]

    for index, tool_data in enumerate(marketplace_tools):
        MarketplaceTool.objects.update_or_create(
            slug=tool_data['slug'],
            defaults={
                **tool_data,
                'sort_order': index,
                'is_active': True,
            }
        )

    print(f"Created {len(marketplace_tools)} marketplace tools")


def create_superuser():
    """Create a superuser if it doesn't exist. Reads credentials from env vars."""
    email = os.environ.get('DJANGO_SUPERUSER_EMAIL', '')
    password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')

    if not email or not password:
        print("Skipping superuser creation: set DJANGO_SUPERUSER_EMAIL and DJANGO_SUPERUSER_PASSWORD env vars")
        return

    if not User.objects.filter(email=email).exists():
        User.objects.create_superuser(
            email=email,
            password=password,
            first_name='Admin',
            last_name='User'
        )
        print(f"Created superuser: {email}")
    else:
        print(f"Superuser {email} already exists")


if __name__ == '__main__':
    print("Initializing database...")
    create_tools()
    create_templates()
    create_marketplace_tools()
    create_superuser()
    print("Database initialization complete!")