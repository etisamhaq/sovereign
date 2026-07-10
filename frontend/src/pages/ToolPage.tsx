import React, { useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import LoadingScreen from '../components/LoadingScreen';
import { ArrowLeftIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead, { toolJsonLd, breadcrumbJsonLd } from '../components/SEOHead';

// Tool-specific components
import ParaphraseTool from '../components/tools/ParaphraseTool';
import GrammarCheckTool from '../components/tools/GrammarCheckTool';
import EssayWriterTool from '../components/tools/EssayWriterTool';
import TextSummarizer from '../components/tools/TextSummarizer';
import PlagiarismCheckTool from '../components/tools/PlagiarismCheckTool';
import WritingImproverTool from '../components/tools/WritingImproverTool';
import OutlineGeneratorTool from '../components/tools/OutlineGeneratorTool';
import TranslatorTool from '../components/tools/TranslatorTool';
import TitleGeneratorTool from '../components/tools/TitleGeneratorTool';
import ToneAnalyzerTool from '../components/tools/ToneAnalyzerTool';
import CitationGenerator from '../components/tools/CitationGenerator';
import FlashcardCreator from '../components/tools/FlashcardCreator';
import QuizGeneratorTool from '../components/tools/QuizGeneratorTool';
import ResearchAssistant from '../components/tools/ResearchAssistant';
import MetaDescriptionGenerator from '../components/tools/MetaDescriptionGenerator';
import ContentCalendarTool from '../components/tools/ContentCalendarTool';
import CourseOutlineCreator from '../components/tools/CourseOutlineCreator';
import VisiSenseAI from '../components/tools/VisiSenseAI';
import VideoDownloader from '../components/tools/VideoDownloader';
import VideoChat from '../components/tools/VideoChat';
import ImageComparison from '../components/tools/ImageComparison';
import LinkedInPostOptimizer from '../components/tools/LinkedInPostOptimizer';
import KeywordExtractorTool from '../components/tools/KeywordExtractorTool';
import ContentRepurposer from '../components/tools/ContentRepurposer';
import EmailWriterTool from '../components/tools/EmailWriterTool';
import SocialMediaGeneratorTool from '../components/tools/SocialMediaGeneratorTool';
import ResumeBuilderTool from '../components/tools/ResumeBuilderTool';
import CodeGeneratorTool from '../components/tools/CodeGeneratorTool';
import RoadmapBuilder from '../components/tools/RoadmapBuilder';
import DecisionMatrixBuilder from '../components/tools/DecisionMatrixBuilder';
import ItineraryPlanner from '../components/tools/ItineraryPlanner';
import BlogPostGenerator from '../components/tools/BlogPostGenerator';
import YouTubeScriptWriter from '../components/tools/YouTubeScriptWriter';
import CoverLetterWriter from '../components/tools/CoverLetterWriter';
import AdCopyGenerator from '../components/tools/AdCopyGenerator';
import DocumentAnalyzer from '../components/tools/DocumentAnalyzer';

interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  icon: string;
  is_premium: boolean;
  is_implemented: boolean;
  usage_count: number;
  user_has_access: boolean;
  meta_title?: string;
  meta_description?: string;
  keywords?: string;
  long_description?: string;
}

const toolComponents: { [key: string]: React.ComponentType<any> } = {
  'paraphrase': ParaphraseTool,
  'grammar-check': GrammarCheckTool,
  'essay-writer': EssayWriterTool,
  'summarizer': TextSummarizer,
  'plagiarism-check': PlagiarismCheckTool,
  'writing-improver': WritingImproverTool,
  'outline-generator': OutlineGeneratorTool,
  'translator': TranslatorTool,
  'title-generator': TitleGeneratorTool,
  'tone-analyzer': ToneAnalyzerTool,
  'citation-generator': CitationGenerator,
  'flashcard-creator': FlashcardCreator,
  'quiz-generator': QuizGeneratorTool,
  'research-assistant': ResearchAssistant,
  'meta-description-generator': MetaDescriptionGenerator,
  'content-calendar': ContentCalendarTool,
  'course-outline-creator': CourseOutlineCreator,
  'visisense-ai': VisiSenseAI,
  'video-downloader': VideoDownloader,
  'video-chat': VideoChat,
  'image-comparison': ImageComparison,
  'linkedin-post-optimizer': LinkedInPostOptimizer,
  'keyword-extractor': KeywordExtractorTool,
  'content-repurposer': ContentRepurposer,
  'email-writer': EmailWriterTool,
  'social-media-generator': SocialMediaGeneratorTool,
  'resume-builder': ResumeBuilderTool,
  'code-generator': CodeGeneratorTool,
  'roadmap-builder': RoadmapBuilder,
  'decision-matrix-builder': DecisionMatrixBuilder,
  'itinerary-planner': ItineraryPlanner,
  'blog-post-generator': BlogPostGenerator,
  'youtube-script-writer': YouTubeScriptWriter,
  'cover-letter-writer': CoverLetterWriter,
  'ad-copy-generator': AdCopyGenerator,
  'document-analyzer': DocumentAnalyzer,
};

const ToolPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [isProcessing, setIsProcessing] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  const { data: tool, isLoading, error } = useQuery<Tool>({
    queryKey: ['tool', slug],
    queryFn: async () => {
      try {
        // Try fetching individual tool first
        return await apiClient.get(`/tools/${slug}/`);
      } catch {
        // Fallback: find from tools list
        const toolsResponse = await apiClient.get('/tools/');
        const toolsList = Array.isArray(toolsResponse) ? toolsResponse : (toolsResponse as any).results || [];
        const foundTool = toolsList.find((t: any) => t.slug === slug);
        if (foundTool) {
          return foundTool as Tool;
        }
        throw new Error('Tool not found');
      }
    },
    enabled: !!slug,
  });

  usePageTitle(tool?.name || 'Tool', tool?.meta_description || tool?.description);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !tool) {
    return <Navigate to="/tools" replace />;
  }

  // Check if user needs to login
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/tools" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Tools
        </Link>
        <div className="card text-center py-12">
          <LockClosedIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Login Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please login or create an account to use {tool.name}.</p>
          <div className="flex gap-4 justify-center">
            <Link to="/login" className="btn btn-primary">Login</Link>
            <Link to="/register" className="btn btn-outline">Create Account</Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has access to premium tool
  if (tool.is_premium && !user?.is_pro) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/tools" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Tools
        </Link>
        <div className="card text-center py-12">
          <div className="mx-auto h-20 w-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
            <SparklesIcon className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tool.name}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">{tool.description}</p>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mb-6">
            ⭐ Pro Feature
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This tool is available exclusively for Pro subscribers. Upgrade now to unlock all premium tools and unlimited usage.
          </p>
          <Link to="/pricing" className="btn btn-primary text-lg px-8 py-3">
            Upgrade to Pro — $5/month
          </Link>
        </div>
      </div>
    );
  }

  // Check if user has reached usage limit
  if (user && user.usage_remaining <= 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/tools" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Tools
        </Link>
        <div className="card text-center py-12">
          <div className="mx-auto h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <LockClosedIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Monthly Limit Reached</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            You've used all {user.usage_limit} of your monthly tool uses.
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upgrade to Pro for 2,000 monthly uses and access to all premium tools.
          </p>
          <Link to="/pricing" className="btn btn-primary text-lg px-8 py-3">
            Upgrade to Pro — $5/month
          </Link>
        </div>
      </div>
    );
  }

  const ToolComponent = toolComponents[tool.slug];

  if (!ToolComponent) {
    // Show coming soon for tools without a frontend component
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/tools"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Tools
        </Link>

        <div className="card">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {tool.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {tool.description}
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              This tool is currently being implemented. Please check back soon!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8"
    >
      <SEOHead
        title={tool.meta_title || tool.name}
        description={tool.meta_description || tool.description}
        canonical={`/tools/${tool.slug}`}
        keywords={tool.keywords}
        noIndex
        jsonLd={[
          toolJsonLd(tool),
          breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Tools', url: '/tools' },
            { name: tool.name, url: `/tools/${tool.slug}` },
          ]),
        ]}
      />
      <Link
        to="/tools"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Tools
      </Link>

      {/* Usage info bar */}
      {user && !user.is_pro && (
        <div className={`mb-4 rounded-lg p-3 flex items-center justify-between text-sm ${
          user.usage_remaining <= 10
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }`}>
          <span>
            📊 Usage: {user.monthly_usage_count} / {user.usage_limit} this month ({user.usage_remaining} remaining)
          </span>
          <Link to="/pricing" className="font-medium underline hover:no-underline">
            Upgrade for more
          </Link>
        </div>
      )}

      <ToolComponent tool={tool} isProcessing={isProcessing} setIsProcessing={setIsProcessing} />
    </motion.div>
  );
};

export default ToolPage;