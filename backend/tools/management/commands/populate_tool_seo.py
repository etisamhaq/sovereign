"""
Management command to populate SEO fields for all tools.
Run: python manage.py populate_tool_seo
"""
from django.core.management.base import BaseCommand
from tools.models import Tool


# ─── SEO data for every tool ───
TOOL_SEO_DATA = {
    'paraphrase': {
        'meta_title': 'Free AI Paraphrase Tool — Rephrase Text Instantly',
        'meta_description': 'Rephrase any text with Sovereign\'s AI paraphrase tool. Choose from standard, formal, creative, or simplified tones. Free to use, no sign-up required.',
        'keywords': 'AI paraphrase tool, rephrase text, text rewriter, paraphrasing tool free, sentence rephraser, reword text online',
        'long_description': '''## AI Paraphrase Tool

Sovereign's AI Paraphrase Tool helps you rephrase any text while preserving the original meaning. Whether you're a student avoiding plagiarism, a professional polishing emails, or a content creator looking for fresh wording — this tool does it in seconds.

### Key Features
- **Multiple tones**: Standard, formal, creative, simplified, academic
- **Preserves meaning**: AI understands context, not just word substitution
- **Instant results**: Powered by advanced AI (Llama 3.3 70B)
- **Free to use**: 50 free uses per month, no credit card required

### Who Is This For?
- **Students**: Rewrite essays and assignments in your own words
- **Writers & Bloggers**: Create fresh variations of existing content
- **Professionals**: Polish emails, reports, and presentations
- **ESL Learners**: Improve English fluency with better phrasing

### How It Works
1. Paste your text (up to 5,000 characters)
2. Select your desired tone
3. Click "Paraphrase" and get results in seconds

### Frequently Asked Questions

**Is this paraphrase tool free?**
Yes! Free users get 50 uses per month. Pro users ($5/month) get 2,000 uses.

**Does it detect plagiarism too?**
This tool focuses on paraphrasing. We have a separate [Plagiarism Checker](/tool/plagiarism-check) tool.

**What languages does it support?**
Currently optimized for English. Use our [Translator](/tool/translator) for other languages.''',
    },
    'grammar-check': {
        'meta_title': 'Free AI Grammar Checker — Fix Errors Instantly',
        'meta_description': 'Check grammar, spelling, and punctuation with Sovereign\'s AI grammar checker. Get instant corrections and suggestions to improve your writing. Free online tool.',
        'keywords': 'AI grammar checker, grammar check online free, spelling checker, punctuation checker, writing correction tool, grammar fixer',
        'long_description': '''## AI Grammar Checker

Sovereign's AI Grammar Checker scans your text for grammar, spelling, punctuation, and style errors — then suggests clear fixes. It's like having a professional editor review your writing in seconds.

### Key Features
- **Comprehensive checks**: Grammar, spelling, punctuation, style, and clarity
- **Detailed suggestions**: Each error comes with an explanation and fix
- **Context-aware**: AI understands sentence context, not just rules
- **Free to use**: 50 free checks per month

### Who Is This For?
- **Students**: Proofread essays, papers, and assignments before submission
- **Professionals**: Polish emails, reports, and business documents
- **Content creators**: Ensure blog posts and articles are error-free
- **Non-native speakers**: Improve English writing accuracy

### How It Works
1. Paste or type your text
2. Click "Check Grammar"
3. Review highlighted errors and apply suggested fixes

### Frequently Asked Questions

**Is this grammar checker really free?**
Yes! Free users get 50 checks per month. Pro subscribers get 2,000.

**Is it better than Grammarly?**
Sovereign's grammar checker uses the latest AI models and is completely free for basic use. Try it and compare!

**Does it check for plagiarism?**
No, this tool focuses on grammar. Use our [Plagiarism Checker](/tool/plagiarism-check) for that.''',
    },
    'essay-writer': {
        'meta_title': 'AI Essay Writer — Generate Essays in Seconds',
        'meta_description': 'Generate well-structured essays on any topic with Sovereign\'s AI essay writer. Choose length, style, and academic level. Perfect for students and writers.',
        'keywords': 'AI essay writer, essay generator, write my essay AI, automatic essay writer, essay writing tool, AI essay generator free',
        'long_description': '''## AI Essay Writer

Sovereign's AI Essay Writer generates well-structured, original essays on any topic in seconds. Choose your academic level, essay length, and style — and get a complete draft you can refine.

### Key Features
- **Any topic**: From literature to science, history to technology
- **Adjustable length**: Short paragraphs to full research papers
- **Academic levels**: High school, undergraduate, graduate
- **Multiple styles**: Argumentative, persuasive, narrative, expository, descriptive

### Who Is This For?
- **Students**: Get a starting draft for essays and assignments
- **Researchers**: Quickly outline ideas for academic papers
- **Content writers**: Generate first drafts for blog posts and articles

### Frequently Asked Questions

**Are the essays original?**
Yes! Each essay is generated uniquely by AI. We recommend using it as a starting point and adding your own voice.

**What essay types can it write?**
Argumentative, persuasive, narrative, expository, descriptive, and more.''',
    },
    'summarizer': {
        'meta_title': 'Free AI Text Summarizer — Summarize Any Text',
        'meta_description': 'Summarize long articles, papers, and documents instantly with Sovereign\'s AI summarizer. Get concise bullet points or paragraph summaries. Free online tool.',
        'keywords': 'AI text summarizer, summarize text online, article summarizer, document summarizer free, text summary tool, AI summary generator',
        'long_description': '''## AI Text Summarizer

Sovereign's AI Text Summarizer condenses long articles, research papers, and documents into clear, concise summaries. Save hours of reading time with AI-powered comprehension.

### Key Features
- **Multiple formats**: Bullet points, paragraph summaries, key takeaways
- **Adjustable length**: Brief overview to detailed summary
- **Preserves key points**: AI identifies the most important information
- **Free to use**: 50 free summaries per month

### Who Is This For?
- **Students**: Quickly digest research papers and textbook chapters
- **Professionals**: Summarize reports, articles, and meeting notes
- **Researchers**: Extract key findings from multiple papers efficiently

### Frequently Asked Questions

**How long can the input text be?**
Up to 5,000 characters for free users. Pro users can summarize longer documents.

**Does it work for academic papers?**
Yes! The AI is trained to understand and summarize academic content accurately.''',
    },
    'plagiarism-check': {
        'meta_title': 'AI Plagiarism Checker — Detect Copied Content',
        'meta_description': 'Check your text for plagiarism with Sovereign\'s AI plagiarism checker. Detect copied content and ensure originality before submitting. Pro feature.',
        'keywords': 'AI plagiarism checker, plagiarism detector, check plagiarism online, plagiarism scanner, originality checker, copy detection tool',
        'long_description': '''## AI Plagiarism Checker

Sovereign's AI Plagiarism Checker analyzes your text for potential plagiarism and unoriginal content. Ensure your writing is authentic before submitting assignments, articles, or papers.

### Key Features
- **AI-powered detection**: Advanced analysis beyond simple string matching
- **Detailed reports**: See which sections may need revision
- **Confidence scores**: Know how original your text is
- **Fast results**: Get results in seconds

### Who Is This For?
- **Students**: Verify essays are original before submission
- **Teachers**: Check student work for potential plagiarism
- **Content creators**: Ensure blog posts and articles are unique
- **Researchers**: Verify originality of academic papers''',
    },
    'writing-improver': {
        'meta_title': 'AI Writing Improver — Enhance Your Text Quality',
        'meta_description': 'Improve your writing with Sovereign\'s AI writing improver. Enhance clarity, readability, and style instantly. Free online writing enhancement tool.',
        'keywords': 'AI writing improver, improve writing quality, text enhancer, writing enhancement tool, clarity improver, readability tool',
        'long_description': '''## AI Writing Improver

Sovereign's Writing Improver enhances your text by improving clarity, readability, and style. Get professional-quality writing without hiring an editor.

### Key Features
- **Clarity enhancement**: Simplify complex sentences
- **Style improvement**: Professional, academic, casual tones
- **Readability boost**: Make your writing accessible to any audience
- **Free to use**: 50 free improvements per month''',
    },
    'outline-generator': {
        'meta_title': 'AI Outline Generator — Create Structured Outlines',
        'meta_description': 'Generate structured outlines for essays, articles, and research papers with Sovereign\'s AI outline generator. Free online tool for students and writers.',
        'keywords': 'AI outline generator, essay outline generator, article outline tool, research paper outline, content outline creator, writing outline AI',
        'long_description': '''## AI Outline Generator

Create well-structured outlines for any writing project. Sovereign's AI Outline Generator organizes your ideas into a logical framework for essays, articles, research papers, and more.

### Key Features
- **Any topic**: Generate outlines for essays, blog posts, research papers
- **Customizable depth**: From simple bullet points to detailed sub-sections
- **Multiple formats**: Academic, blog post, report, presentation
- **Free to use**: 50 free outlines per month''',
    },
    'translator': {
        'meta_title': 'AI Translator — Translate Text to Any Language',
        'meta_description': 'Translate text between 50+ languages with Sovereign\'s AI translator. Accurate, context-aware translations powered by advanced AI. Free online translation tool.',
        'keywords': 'AI translator, online translator free, text translation tool, language translator, translate text AI, multilingual translator',
        'long_description': '''## AI Translator

Sovereign's AI Translator provides accurate, context-aware translations between 50+ languages. Unlike word-for-word translators, our AI understands context and idioms.

### Key Features
- **50+ languages**: All major world languages supported
- **Context-aware**: Understands idioms, slang, and technical terms
- **Natural output**: Translations read like native text
- **Free to use**: 50 free translations per month''',
    },
    'title-generator': {
        'meta_title': 'AI Title Generator — Generate Catchy Headlines',
        'meta_description': 'Generate compelling titles and headlines for articles, blog posts, and essays with Sovereign\'s AI title generator. Free online headline creator.',
        'keywords': 'AI title generator, headline generator, blog title generator, article title ideas, catchy headline tool, title creator free',
        'long_description': '''## AI Title Generator

Generate attention-grabbing titles and headlines for your content. Sovereign's AI Title Generator creates compelling options for blog posts, articles, essays, emails, and more.

### Key Features
- **Multiple options**: Get 5-10 title suggestions per request
- **Various styles**: Clickbait, professional, academic, creative
- **SEO-optimized**: Titles designed to rank in search engines
- **Free to use**: 50 free generations per month''',
    },
    'tone-analyzer': {
        'meta_title': 'AI Tone Analyzer — Detect Writing Tone & Sentiment',
        'meta_description': 'Analyze the tone and sentiment of your text with Sovereign\'s AI tone analyzer. Detect formality, emotion, and style. Free writing analysis tool.',
        'keywords': 'AI tone analyzer, sentiment analysis tool, writing tone detector, text sentiment checker, emotion analyzer, tone analysis free',
        'long_description': '''## AI Tone Analyzer

Understand the tone and sentiment of any text with Sovereign's AI Tone Analyzer. Get insights into formality level, emotional tone, persuasiveness, and clarity.

### Key Features
- **Comprehensive analysis**: Tone, sentiment, formality, emotion
- **Actionable insights**: Suggestions to adjust tone as needed
- **Multiple dimensions**: Formality, confidence, friendliness, urgency
- **Free to use**: 50 free analyses per month''',
    },
    'citation-generator': {
        'meta_title': 'Free AI Citation Generator — APA, MLA, Chicago',
        'meta_description': 'Generate accurate citations in APA, MLA, Chicago, Harvard, and IEEE formats with Sovereign\'s AI citation generator. Free online bibliography maker.',
        'keywords': 'AI citation generator, citation maker free, APA citation generator, MLA citation tool, bibliography generator, reference generator online',
        'long_description': '''## AI Citation Generator

Generate properly formatted citations in seconds. Sovereign's AI Citation Generator supports APA, MLA, Chicago, Harvard, and IEEE formats for books, articles, websites, and more.

### Key Features
- **5 citation styles**: APA, MLA, Chicago, Harvard, IEEE
- **Multiple source types**: Books, journal articles, websites, videos
- **AI-powered accuracy**: Automatically formats citations correctly
- **Free to use**: 50 free citations per month

### Supported Citation Formats
- **APA 7th Edition**: Psychology, social sciences, education
- **MLA 9th Edition**: Literature, humanities, liberal arts
- **Chicago/Turabian**: History, arts, some social sciences
- **Harvard**: Business, natural sciences (UK/Australia)
- **IEEE**: Engineering, computer science, electronics

### Frequently Asked Questions

**How accurate are the citations?**
Our AI generates citations following the latest style guidelines. Always double-check critical submissions.

**Can I generate a full bibliography?**
Yes! Generate multiple citations and compile them into a reference list.''',
    },
    'flashcard-creator': {
        'meta_title': 'AI Flashcard Creator — Generate Study Cards Instantly',
        'meta_description': 'Create study flashcards from any text with Sovereign\'s AI flashcard creator. Perfect for exam prep and active recall learning. Free online tool.',
        'keywords': 'AI flashcard creator, flashcard generator, study cards maker, exam prep flashcards, active recall tool, flashcard maker free',
        'long_description': '''## AI Flashcard Creator

Turn any text into effective study flashcards. Sovereign's AI Flashcard Creator extracts key concepts and generates question-answer pairs for active recall learning.

### Key Features
- **Auto-generation**: Paste any text and get flashcards instantly
- **Smart extraction**: AI identifies key concepts and terms
- **Active recall**: Question-answer format for effective studying
- **Free to use**: 50 free generations per month''',
    },
    'quiz-generator': {
        'meta_title': 'AI Quiz Generator — Create Quizzes from Any Text',
        'meta_description': 'Generate quizzes and test questions from any text with Sovereign\'s AI quiz generator. Multiple choice, true/false, and short answer. Perfect for teachers.',
        'keywords': 'AI quiz generator, quiz maker from text, test question generator, multiple choice generator, quiz creator AI, auto quiz maker',
        'long_description': '''## AI Quiz Generator

Create comprehensive quizzes from any text material. Sovereign's AI Quiz Generator produces multiple choice, true/false, and short answer questions for effective assessment.

### Key Features
- **Multiple formats**: Multiple choice, true/false, short answer, fill-in-the-blank
- **Adjustable difficulty**: Easy, medium, hard
- **Any subject**: From science to literature, history to math
- **Answer keys included**: Correct answers provided with explanations''',
    },
    'research-assistant': {
        'meta_title': 'AI Research Assistant — Literature Review & Analysis',
        'meta_description': 'Get AI-powered research assistance for literature reviews, paper analysis, and research summaries. Sovereign\'s research assistant for students and academics.',
        'keywords': 'AI research assistant, literature review tool, research paper analyzer, academic research AI, research summary tool, study helper AI',
        'long_description': '''## AI Research Assistant

Sovereign's AI Research Assistant helps you analyze papers, conduct literature reviews, and organize research findings. Ideal for students, academics, and researchers.

### Key Features
- **Paper analysis**: Upload and analyze research papers
- **Literature review help**: Synthesize findings across multiple sources
- **Research summaries**: Get clear summaries of complex papers
- **Citation support**: Properly formatted references''',
    },
    'meta-description-generator': {
        'meta_title': 'AI Meta Description Generator — SEO Meta Tags',
        'meta_description': 'Generate SEO-optimized meta descriptions for your web pages with Sovereign\'s AI meta description generator. Improve click-through rates from search results.',
        'keywords': 'meta description generator, SEO meta tags tool, meta description writer, SEO description generator, SERP snippet optimizer, meta tag creator',
        'long_description': '''## AI Meta Description Generator

Craft compelling, SEO-optimized meta descriptions that improve your click-through rates from search results. Sovereign's AI Meta Description Generator creates descriptions that are the perfect length and tone.

### Key Features
- **SEO-optimized**: Descriptions crafted for maximum CTR
- **Perfect length**: Always within Google's 155-160 character limit
- **Multiple variations**: Get several options to choose from
- **Free to use**: 50 free generations per month''',
    },
    'content-calendar': {
        'meta_title': 'AI Content Calendar — Plan Your Content Strategy',
        'meta_description': 'Generate a content calendar for your blog or social media with Sovereign\'s AI content calendar tool. Plan weeks of content in minutes.',
        'keywords': 'AI content calendar, content planning tool, editorial calendar generator, social media calendar, blog content planner, content strategy tool',
        'long_description': '''## AI Content Calendar

Plan weeks of content in minutes with Sovereign's AI Content Calendar. Generate topic ideas, publish schedules, and content themes tailored to your niche and audience.

### Key Features
- **Full calendar**: Weekly or monthly content plans
- **Topic ideas**: AI-generated content ideas for your niche
- **Multiple platforms**: Blog, social media, email, video
- **Customizable**: Adjust frequency, tone, and focus areas''',
    },
    'course-outline-creator': {
        'meta_title': 'AI Course Outline Creator — Build Course Curriculum',
        'meta_description': 'Create structured course outlines and curriculum with Sovereign\'s AI course outline creator. Perfect for educators, trainers, and course designers.',
        'keywords': 'AI course outline creator, course curriculum builder, lesson plan generator, course design tool, training outline maker, education AI tool',
        'long_description': '''## AI Course Outline Creator

Design comprehensive course outlines and curriculum with Sovereign's AI Course Outline Creator. Perfect for educators, online course creators, and corporate trainers.

### Key Features
- **Structured modules**: Logical progression of topics and lessons
- **Learning objectives**: Clear goals for each module
- **Assessments**: Suggested quizzes and assignments
- **Any subject**: From programming to marketing to history''',
    },
    'visisense-ai': {
        'meta_title': 'VisiSense AI — AI Image Analysis & Vision Tool',
        'meta_description': 'Analyze images with AI — extract text, describe scenes, identify objects, and get insights. Sovereign\'s VisiSense AI powered by advanced vision models.',
        'keywords': 'AI image analysis, image recognition tool, OCR text extraction, image description AI, visual AI tool, picture analyzer',
        'long_description': '''## VisiSense AI — Image Analysis Tool

VisiSense AI is Sovereign's advanced image analysis tool. Upload any image and get AI-powered analysis including scene descriptions, text extraction (OCR), object identification, and more.

### Key Features
- **Scene description**: Detailed AI descriptions of what's in the image
- **Text extraction (OCR)**: Extract text from screenshots, documents, photos
- **Object detection**: Identify objects, people, and elements
- **Multiple analysis modes**: Describe, extract, analyze, compare''',
    },
    'video-downloader': {
        'meta_title': 'Video Downloader — Download Videos from Any URL',
        'meta_description': 'Download videos from YouTube, Vimeo, and other platforms with Sovereign\'s video downloader tool. Fast, free, and easy to use.',
        'keywords': 'video downloader, download YouTube videos, video download tool, online video saver, video converter, free video downloader',
        'long_description': '''## Video Downloader

Download videos from popular platforms including YouTube, Vimeo, and more. Sovereign's Video Downloader makes it easy to save videos for offline viewing.

### Key Features
- **Multiple platforms**: YouTube, Vimeo, and many more
- **Quality options**: Choose resolution and format
- **Fast downloads**: Optimized download speeds
- **Free to use**: 50 free downloads per month''',
    },
    'video-chat': {
        'meta_title': 'Video Chat AI — Chat with Any YouTube Video',
        'meta_description': 'Chat with any YouTube video using AI. Ask questions, get summaries, and extract insights from video content. Sovereign\'s video chat tool.',
        'keywords': 'video chat AI, chat with YouTube video, video Q&A tool, video summarizer AI, YouTube chat bot, video content analyzer',
        'long_description': '''## Video Chat AI

Chat with any YouTube video using AI. Ask questions about the content, get summaries, extract key points, and discuss topics — all powered by advanced AI understanding.

### Key Features
- **Chat interface**: Ask natural language questions about any video
- **Video summaries**: Get instant summaries of long videos
- **Key points extraction**: Identify the most important takeaways
- **Timestamped references**: Know exactly where in the video to look''',
    },
    'image-comparison': {
        'meta_title': 'AI Image Comparison — Compare Two Images Side by Side',
        'meta_description': 'Compare two images side by side with AI analysis. Detect differences, similarities, and changes. Sovereign\'s image comparison tool.',
        'keywords': 'AI image comparison, compare images online, image diff tool, image similarity checker, side by side image comparison, photo comparison tool',
        'long_description': '''## AI Image Comparison

Compare two images with AI-powered analysis. Sovereign's Image Comparison tool identifies differences, similarities, and changes between any two images.

### Key Features
- **Side-by-side view**: Compare images visually
- **AI analysis**: Detailed comparison report
- **Difference detection**: Highlight what changed between images
- **Free to use**: Upload and compare instantly''',
    },
    'linkedin-post-optimizer': {
        'meta_title': 'LinkedIn Post Optimizer — AI-Powered LinkedIn Content',
        'meta_description': 'Optimize your LinkedIn posts for maximum engagement with Sovereign\'s AI LinkedIn post optimizer. Get more likes, comments, and shares.',
        'keywords': 'LinkedIn post optimizer, LinkedIn content creator, LinkedIn post generator, social media optimizer, LinkedIn engagement tool, professional content AI',
        'long_description': '''## LinkedIn Post Optimizer

Optimize your LinkedIn posts for maximum professional engagement. Sovereign's AI analyzes and enhances your posts for better reach, engagement, and professional impact.

### Key Features
- **Engagement optimization**: AI-suggested improvements for more interactions
- **Tone adjustment**: Professional, thought-leadership, casual
- **Hashtag suggestions**: Relevant hashtags for broader reach
- **Free to use**: 50 free optimizations per month''',
    },
    'keyword-extractor': {
        'meta_title': 'AI Keyword Extractor — Extract Keywords from Text',
        'meta_description': 'Extract important keywords and key phrases from any text with Sovereign\'s AI keyword extractor. Perfect for SEO, research, and content analysis.',
        'keywords': 'AI keyword extractor, keyword extraction tool, key phrase finder, SEO keyword tool, text keyword analyzer, automatic keyword extraction',
        'long_description': '''## AI Keyword Extractor

Extract the most important keywords and key phrases from any text. Sovereign's AI Keyword Extractor identifies the core topics and terms — perfect for SEO, research analysis, and content optimization.

### Key Features
- **Smart extraction**: AI identifies relevant keywords, not just frequent words
- **Key phrases**: Multi-word phrases and concepts
- **Relevance scoring**: Keywords ranked by importance
- **Free to use**: 50 free extractions per month''',
    },
    'content-repurposer': {
        'meta_title': 'AI Content Repurposer — Transform Content Across Formats',
        'meta_description': 'Repurpose your content into different formats — turn blog posts into social media, emails into articles, and more. Sovereign\'s AI content repurposer.',
        'keywords': 'AI content repurposer, content recycling tool, repurpose content AI, content transformation tool, content format converter, multi-platform content',
        'long_description': '''## AI Content Repurposer

Transform your existing content into multiple formats. Turn a blog post into social media posts, an article into an email newsletter, or a research paper into a presentation outline.

### Key Features
- **Multiple output formats**: Social media, email, blog, video script
- **Platform-specific**: Optimized for Twitter, LinkedIn, Instagram, etc.
- **Tone preservation**: Maintains your brand voice across formats
- **Bulk conversion**: Repurpose one piece into many formats''',
    },
    'email-writer': {
        'meta_title': 'AI Email Writer — Generate Professional Emails',
        'meta_description': 'Write professional emails in seconds with Sovereign\'s AI email writer. Business, follow-up, cold outreach, and more. Free online email generator.',
        'keywords': 'AI email writer, email generator tool, professional email writer, business email AI, email template generator, automatic email writer',
        'long_description': '''## AI Email Writer

Generate professional emails in seconds. Sovereign's AI Email Writer creates well-crafted emails for business communication, follow-ups, cold outreach, and more.

### Key Features
- **Multiple types**: Business, follow-up, cold outreach, thank you, apology
- **Tone control**: Formal, friendly, persuasive, casual
- **Customizable**: Specify key points and recipient context
- **Free to use**: 50 free emails per month''',
    },
    'social-media-generator': {
        'meta_title': 'AI Social Media Post Generator — Create Engaging Posts',
        'meta_description': 'Generate engaging social media posts for Twitter, Instagram, Facebook, and LinkedIn with Sovereign\'s AI social media generator. Free online tool.',
        'keywords': 'AI social media generator, social media post creator, Instagram caption generator, Twitter post maker, Facebook post AI, social content creator',
        'long_description': '''## AI Social Media Post Generator

Create engaging social media content for all platforms. Sovereign's AI generates platform-optimized posts for Twitter, Instagram, Facebook, LinkedIn, and more.

### Key Features
- **Platform-specific**: Optimized for each social network's best practices
- **Hashtag suggestions**: Relevant and trending hashtags
- **Multiple variations**: Get several post options to choose from
- **Emoji & formatting**: Platform-appropriate styling''',
    },
    'resume-builder': {
        'meta_title': 'AI Resume Builder — Create Professional Resumes',
        'meta_description': 'Build professional resumes with Sovereign\'s AI resume builder. Tailored for any industry, optimized for ATS. Stand out to recruiters.',
        'keywords': 'AI resume builder, resume generator, CV maker AI, professional resume creator, ATS resume builder, job application tool',
        'long_description': '''## AI Resume Builder

Create professional, ATS-optimized resumes with AI assistance. Sovereign's Resume Builder helps you craft compelling resumes tailored to your target industry and role.

### Key Features
- **ATS-optimized**: Formats that pass Applicant Tracking Systems
- **Industry-tailored**: Customized for your specific field
- **Keyword optimization**: Include relevant keywords for job descriptions
- **Professional formatting**: Clean, modern resume layouts''',
    },
    'code-generator': {
        'meta_title': 'AI Code Generator — Generate Code in Any Language',
        'meta_description': 'Generate code snippets and functions in Python, JavaScript, and more with Sovereign\'s AI code generator. Describe what you need, get working code.',
        'keywords': 'AI code generator, code writer AI, programming assistant, Python code generator, JavaScript code tool, auto code generator',
        'long_description': '''## AI Code Generator

Describe what you need in plain English and get working code. Sovereign's AI Code Generator supports Python, JavaScript, TypeScript, Java, C++, and more.

### Key Features
- **Multiple languages**: Python, JavaScript, TypeScript, Java, C++, Go, Rust
- **Natural language input**: Describe what you need, get code
- **Code explanations**: Understand what the generated code does
- **Best practices**: Code follows modern conventions and patterns''',
    },
    'roadmap-builder': {
        'meta_title': 'AI Roadmap Builder — Create Learning & Project Roadmaps',
        'meta_description': 'Build structured learning and project roadmaps with Sovereign\'s AI roadmap builder. Plan your path to mastering any skill or completing any project.',
        'keywords': 'AI roadmap builder, learning roadmap generator, project roadmap tool, skill roadmap creator, career path planner, study roadmap AI',
        'long_description': '''## AI Roadmap Builder

Create structured roadmaps for learning new skills, managing projects, or planning your career path. Sovereign's AI Roadmap Builder provides step-by-step guidance.

### Key Features
- **Learning roadmaps**: Structured paths for mastering any skill
- **Project roadmaps**: Timeline and milestone planning
- **Resource suggestions**: Recommended resources for each step
- **Customizable**: Adjust timeline, depth, and focus areas''',
    },
    'decision-matrix-builder': {
        'meta_title': 'AI Decision Matrix Builder — Make Better Decisions',
        'meta_description': 'Create weighted decision matrices to evaluate options objectively with Sovereign\'s AI decision matrix builder. Make data-driven decisions.',
        'keywords': 'decision matrix builder, decision making tool, weighted decision matrix, comparison matrix, decision analysis tool, Pugh matrix generator',
        'long_description': '''## AI Decision Matrix Builder

Make better decisions with structured analysis. Sovereign's Decision Matrix Builder helps you evaluate multiple options against weighted criteria for objective decision-making.

### Key Features
- **Weighted criteria**: Assign importance to different factors
- **Visual matrix**: Clear comparison table
- **AI suggestions**: Smart criteria and weighting recommendations
- **Export results**: Download your analysis as PDF or spreadsheet''',
    },
    'itinerary-planner': {
        'meta_title': 'AI Itinerary Planner — Plan Your Perfect Trip',
        'meta_description': 'Plan detailed travel itineraries with Sovereign\'s AI itinerary planner. Day-by-day schedules, local recommendations, and travel tips for any destination.',
        'keywords': 'AI itinerary planner, travel planner AI, trip planner tool, vacation itinerary generator, travel schedule maker, trip planning tool',
        'long_description': '''## AI Itinerary Planner

Plan your perfect trip with AI-generated itineraries. Sovereign's Itinerary Planner creates detailed day-by-day travel plans with local recommendations, timing, and tips.

### Key Features
- **Day-by-day plans**: Detailed schedules for each day of your trip
- **Local recommendations**: Restaurants, attractions, hidden gems
- **Travel tips**: Budget, transportation, cultural advice
- **Customizable**: Adjust for interests, budget, and travel style''',
    },
    'prepza': {
        'meta_title': 'Prepza — AI Exam Preparation Tool',
        'meta_description': 'Prepare for exams with Prepza, Sovereign\'s AI-powered exam preparation tool. Practice questions, study plans, and performance tracking.',
        'keywords': 'AI exam prep, exam preparation tool, study helper AI, practice questions generator, test prep tool, exam practice online',
        'long_description': '''## Prepza — AI Exam Preparation

Prepare for any exam with AI-powered study assistance. Prepza generates practice questions, creates study plans, and tracks your performance to help you ace your exams.

### Key Features
- **Practice questions**: AI-generated questions based on your study material
- **Study plans**: Personalized schedules based on your exam date
- **Performance tracking**: Identify strengths and weaknesses
- **Any subject**: From science to humanities, professional certifications to school exams''',
    },
    'logiforge': {
        'meta_title': 'LogiForge — AI Logic & Reasoning Tool',
        'meta_description': 'Build logical arguments and analyze reasoning with LogiForge, Sovereign\'s AI-powered logic and reasoning tool for students and professionals.',
        'keywords': 'AI logic tool, logical reasoning analyzer, argument builder, critical thinking AI, logic analysis tool, reasoning helper',
        'long_description': '''## LogiForge — AI Logic & Reasoning

Build stronger arguments and analyze logical reasoning with LogiForge. This AI-powered tool helps you construct valid arguments, identify logical fallacies, and think more critically.

### Key Features
- **Argument building**: Construct well-structured logical arguments
- **Fallacy detection**: Identify common logical fallacies
- **Reasoning analysis**: Evaluate the strength of arguments
- **Critical thinking**: Improve analytical skills with AI guidance''',
    },
    'blog-post-generator': {
        'meta_title': 'Free AI Blog Post Generator — Create Full Articles Instantly',
        'meta_description': 'Generate SEO-optimized blog posts with Sovereign\'s AI Blog Post Generator. Choose tone, length, and get structured articles with headings, tags, and meta descriptions.',
        'keywords': 'AI blog writer, blog post generator, AI article writer, SEO blog tool, content generator, AI blogging tool, free blog writer',
        'long_description': '''## AI Blog Post Generator

Create complete, well-structured blog posts in seconds. Sovereign's Blog Post Generator uses advanced AI to write articles with proper headings, SEO metadata, tags, and social media snippets.

### Key Features
- **Multiple tones**: Professional, casual, academic, persuasive, storytelling, humorous
- **Adjustable length**: Short (~500 words), medium (~1000 words), or long (~2000 words)
- **SEO-ready output**: Includes meta descriptions, tags, and social snippets
- **Structured sections**: Automatically organized with clear headings
- **Instant results**: Full articles generated in under 30 seconds

### Who Is This For?
- **Content marketers**: Quickly draft blog posts for campaigns
- **Bloggers**: Overcome writer's block with AI-generated first drafts
- **SEO specialists**: Generate keyword-optimized content at scale
- **Small business owners**: Create professional blog content without hiring writers

### How It Works
1. Enter your topic and optional keywords
2. Select tone and desired length
3. Click "Generate Blog Post" and get a complete article with sections, tags, and metadata''',
    },
    'youtube-script-writer': {
        'meta_title': 'Free AI YouTube Script Writer — Video Scripts in Seconds',
        'meta_description': 'Write engaging YouTube video scripts with Sovereign\'s AI Script Writer. Choose duration, style, and get complete scripts with hooks, intros, visual cues, and CTAs.',
        'keywords': 'YouTube script writer, AI video script, YouTube script generator, video content AI, script writing tool, YouTube creator tool',
        'long_description': '''## AI YouTube Script Writer

Create professional YouTube video scripts tailored to your content style and target duration. Get complete scripts with attention-grabbing hooks, structured segments, visual notes, and audience engagement prompts.

### Key Features
- **Duration presets**: 1-minute shorts to 20+ minute deep dives
- **Multiple styles**: Educational, entertaining, tutorial, vlog, review, storytelling, commentary
- **Color-coded sections**: Hook, intro, body segments, visual notes, outro — all clearly marked
- **Visual cues**: Includes camera directions and B-roll suggestions
- **YouTube-ready**: Generates video descriptions and tag suggestions

### Who Is This For?
- **YouTubers**: Plan and script videos faster
- **Video marketers**: Create consistent video content at scale
- **Educators**: Script online lessons and course content
- **Podcasters**: Outline video podcast episodes

### How It Works
1. Enter your video topic and optional key points
2. Select target duration and content style
3. Click "Write Script" and get a complete script with segments, visual cues, and descriptions''',
    },
    'cover-letter-writer': {
        'meta_title': 'Free AI Cover Letter Writer — Job-Specific Letters Instantly',
        'meta_description': 'Generate personalized, professional cover letters with Sovereign\'s AI. Paste a job description, add your experience, and get a tailored cover letter in seconds.',
        'keywords': 'AI cover letter generator, cover letter writer, job application letter, AI cover letter tool, professional cover letter, free cover letter maker',
        'long_description': '''## AI Cover Letter Writer

Create compelling, personalized cover letters tailored to specific job descriptions. Sovereign's Cover Letter Writer analyzes the role and highlights your relevant experience to make a strong first impression.

### Key Features
- **Job-tailored**: Analyzes the job description and matches your skills
- **Multiple tones**: Professional, enthusiastic, confident, conversational, formal
- **Strength analysis**: Highlights your key qualifications for the role
- **Customization tips**: Provides guidance on personalizing the letter further
- **Copy-ready format**: Proper business letter formatting with subject line

### Who Is This For?
- **Job seekers**: Write targeted cover letters for each application
- **Career changers**: Frame transferable skills for new industries
- **Students & graduates**: Create professional letters for internships and first jobs
- **Recruiters**: Draft outreach templates for candidates

### How It Works
1. Paste the job description and your relevant experience
2. Select your desired tone
3. Click "Generate Cover Letter" and get a tailored, professional letter ready to send''',
    },
    'ad-copy-generator': {
        'meta_title': 'Free AI Ad Copy Generator — Ads for Google, Facebook & More',
        'meta_description': 'Generate high-converting ad copy for Google, Facebook, Instagram, LinkedIn, and Twitter with Sovereign\'s AI Ad Copy Generator. Multiple variations with CTAs and targeting tips.',
        'keywords': 'AI ad copy generator, ad writing tool, Google Ads copy, Facebook ad generator, ad copywriting AI, marketing copy tool, PPC ad writer',
        'long_description': '''## AI Ad Copy Generator

Create platform-optimized advertising copy that converts. Generate multiple ad variations with headlines, descriptions, calls-to-action, and strategic recommendations for Google, Facebook, Instagram, LinkedIn, and Twitter/X.

### Key Features
- **5 platforms**: Google Ads, Facebook, Instagram, LinkedIn, Twitter/X
- **Multiple variations**: Generate 1-5 ad variations per request
- **Platform-optimized**: Character counts and formats match each platform's specs
- **Strategic notes**: Includes targeting suggestions and A/B testing tips
- **Multiple tones**: Professional, casual, urgent, inspirational, humorous, bold

### Who Is This For?
- **Digital marketers**: Create ad copy at scale across platforms
- **Small business owners**: Write professional ads without an agency
- **PPC specialists**: Generate test variations for campaigns
- **Social media managers**: Create engaging sponsored content

### How It Works
1. Enter your product/service and target audience
2. Select the platform, tone, and number of variations
3. Click "Generate Ad Copy" and get ready-to-use ads with CTAs and strategy tips''',
    },
    'document-analyzer': {
        'meta_title': 'Free AI Document Analyzer — Summarize & Extract Insights',
        'meta_description': 'Analyze any document with Sovereign\'s AI. Get summaries, key findings, entity extraction, action items, and Q&A from articles, reports, contracts, and research papers.',
        'keywords': 'AI document analyzer, text analysis tool, document summarizer, entity extraction, AI text summarizer, document insights tool, text mining AI',
        'long_description': '''## AI Document Analyzer

Extract insights, summaries, and actionable intelligence from any document. Sovereign's Document Analyzer uses AI to understand your text and deliver structured analysis including key findings, themes, entities, action items, and direct answers to your questions.

### Key Features
- **5 analysis modes**: Comprehensive, summary, Q&A, entity extraction, action items
- **Entity extraction**: Identifies people, organizations, dates, and locations
- **Q&A capability**: Ask questions about the document and get direct answers
- **Action items**: Extracts tasks with priority levels (high, medium, low)
- **Statistics**: Word count, reading level, estimated read time, sentiment analysis

### Who Is This For?
- **Researchers**: Quickly extract key findings from papers and reports
- **Legal professionals**: Analyze contracts and identify key clauses
- **Business analysts**: Summarize lengthy reports and extract action items
- **Students**: Understand and break down complex academic texts
- **Project managers**: Extract tasks and deadlines from meeting notes

### How It Works
1. Paste your document text (up to 50,000 characters)
2. Select your analysis type (or choose comprehensive for everything)
3. Optionally add questions for Q&A mode
4. Click "Analyze Document" and get structured insights in seconds''',
    },
}


class Command(BaseCommand):
    help = 'Populate SEO fields (meta_title, meta_description, keywords, long_description) for all tools'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Overwrite existing SEO data (default: only fill empty fields)',
        )

    def handle(self, *args, **options):
        overwrite = options.get('overwrite', False)
        updated = 0
        skipped = 0
        not_found = 0

        for slug, seo_data in TOOL_SEO_DATA.items():
            try:
                tool = Tool.objects.get(slug=slug)
            except Tool.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  Tool not found: {slug}'))
                not_found += 1
                continue

            changed = False
            for field, value in seo_data.items():
                current = getattr(tool, field, '')
                if overwrite or not current:
                    setattr(tool, field, value)
                    changed = True

            if changed:
                tool.save()
                updated += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ Updated: {tool.name}'))
            else:
                skipped += 1
                self.stdout.write(f'  ⏭ Skipped (already has SEO data): {tool.name}')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Done! Updated: {updated}, Skipped: {skipped}, Not found: {not_found}'))
