import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import LoadingScreen from '../components/LoadingScreen';
import SEOHead, { toolJsonLd, breadcrumbJsonLd, faqJsonLd } from '../components/SEOHead';
import { useAuthStore } from '../store/authStore';
import { getToolIcon } from '../utils/toolIcons';
import {
  ArrowRightIcon,
  SparklesIcon,
  CheckCircleIcon,
  StarIcon,
  UserGroupIcon,
  BoltIcon,
  AcademicCapIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

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
  meta_title: string;
  meta_description: string;
  keywords: string;
  long_description: string;
}

// Category metadata
const categoryInfo: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  writing: { label: 'Writing Tools', icon: PencilSquareIcon, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30' },
  education: { label: 'Education Tools', icon: AcademicCapIcon, color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30' },
  seo: { label: 'SEO Tools', icon: MagnifyingGlassIcon, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' },
  utility: { label: 'Utility Tools', icon: WrenchScrewdriverIcon, color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30' },
};

// Related tools map (slug → related slugs)
const relatedToolsMap: Record<string, string[]> = {
  'paraphrase': ['grammar-check', 'writing-improver', 'tone-analyzer', 'summarizer'],
  'grammar-check': ['paraphrase', 'writing-improver', 'tone-analyzer', 'plagiarism-check'],
  'essay-writer': ['outline-generator', 'title-generator', 'research-assistant', 'citation-generator'],
  'summarizer': ['paraphrase', 'keyword-extractor', 'research-assistant', 'content-repurposer'],
  'plagiarism-check': ['grammar-check', 'paraphrase', 'writing-improver', 'citation-generator'],
  'writing-improver': ['grammar-check', 'paraphrase', 'tone-analyzer', 'essay-writer'],
  'outline-generator': ['essay-writer', 'course-outline-creator', 'roadmap-builder', 'title-generator'],
  'translator': ['paraphrase', 'grammar-check', 'writing-improver', 'summarizer'],
  'title-generator': ['meta-description-generator', 'essay-writer', 'content-calendar', 'social-media-generator'],
  'tone-analyzer': ['grammar-check', 'writing-improver', 'paraphrase', 'email-writer'],
  'citation-generator': ['research-assistant', 'essay-writer', 'plagiarism-check', 'outline-generator'],
  'flashcard-creator': ['quiz-generator', 'course-outline-creator', 'summarizer', 'research-assistant'],
  'quiz-generator': ['flashcard-creator', 'course-outline-creator', 'research-assistant', 'summarizer'],
  'research-assistant': ['citation-generator', 'summarizer', 'essay-writer', 'plagiarism-check'],
  'meta-description-generator': ['keyword-extractor', 'title-generator', 'content-calendar', 'social-media-generator'],
  'content-calendar': ['social-media-generator', 'title-generator', 'meta-description-generator', 'content-repurposer'],
  'course-outline-creator': ['outline-generator', 'quiz-generator', 'flashcard-creator', 'roadmap-builder'],
  'visisense-ai': ['image-comparison', 'video-chat', 'research-assistant', 'summarizer'],
  'video-downloader': ['video-chat', 'content-repurposer', 'summarizer', 'social-media-generator'],
  'video-chat': ['video-downloader', 'visisense-ai', 'summarizer', 'research-assistant'],
  'image-comparison': ['visisense-ai', 'video-chat', 'research-assistant', 'content-repurposer'],
  'linkedin-post-optimizer': ['social-media-generator', 'email-writer', 'content-repurposer', 'tone-analyzer'],
  'keyword-extractor': ['meta-description-generator', 'title-generator', 'summarizer', 'content-calendar'],
  'content-repurposer': ['social-media-generator', 'linkedin-post-optimizer', 'email-writer', 'summarizer'],
  'email-writer': ['linkedin-post-optimizer', 'tone-analyzer', 'grammar-check', 'writing-improver'],
  'social-media-generator': ['linkedin-post-optimizer', 'content-repurposer', 'title-generator', 'content-calendar'],
  'resume-builder': ['email-writer', 'writing-improver', 'grammar-check', 'linkedin-post-optimizer'],
  'code-generator': ['roadmap-builder', 'outline-generator', 'research-assistant', 'essay-writer'],
  'roadmap-builder': ['course-outline-creator', 'outline-generator', 'decision-matrix-builder', 'itinerary-planner'],
  'decision-matrix-builder': ['roadmap-builder', 'research-assistant', 'outline-generator', 'code-generator'],
  'itinerary-planner': ['roadmap-builder', 'content-calendar', 'outline-generator', 'decision-matrix-builder'],
};

// Extract FAQ from long_description if present
function extractFAQs(longDesc: string): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];
  const faqSection = longDesc.split('### Frequently Asked Questions');
  if (faqSection.length < 2) return faqs;
  const faqText = faqSection[1];
  const qaPairs = faqText.split(/\*\*([^*]+)\*\*/g).filter(Boolean);
  for (let i = 0; i < qaPairs.length - 1; i += 2) {
    const question = qaPairs[i].trim();
    const answer = qaPairs[i + 1].trim();
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }
  return faqs;
}

// Simple markdown-ish renderer for long descriptions
function renderLongDescription(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300">
          {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (line: string): React.ReactNode[] => {
    // Process bold (**text**) and links ([text](/url))
    const parts = line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      // Bold
      const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        return <strong key={i} className="font-semibold text-gray-900 dark:text-white">{boldMatch[1]}</strong>;
      }
      // Link
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return <a key={i} href={linkMatch[2]} className="text-indigo-600 dark:text-indigo-400 hover:underline">{linkMatch[1]}</a>;
      }
      return part;
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      // Skip top-level heading — we use the tool name as h1
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-3">
          {trimmed.replace('### ', '')}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.replace(/^- /, ''));
      continue;
    }
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  }
  flushList();
  return elements;
}

const ToolLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuthStore();

  const { data: tool, isLoading, error } = useQuery<Tool>({
    queryKey: ['tool-landing', slug],
    queryFn: async () => {
      const response = await apiClient.get(`/tools/${slug}/`);
      return response as Tool;
    },
    enabled: !!slug,
  });

  // Fetch all tools for "related tools" section
  const { data: allTools } = useQuery<Tool[]>({
    queryKey: ['tools-all'],
    queryFn: async () => {
      const res = await apiClient.get('/tools/');
      return Array.isArray(res) ? res : (res as any).results || [];
    },
  });

  // If user is logged in, redirect to the actual tool
  if (isAuthenticated) {
    return <Navigate to={`/tools/${slug}`} replace />;
  }

  if (isLoading) return <LoadingScreen />;
  if (error || !tool) return <Navigate to="/" replace />;

  const cat = categoryInfo[tool.category] || categoryInfo.utility;
  const CategoryIcon = cat.icon;
  const faqs = extractFAQs(tool.long_description || '');
  const relatedSlugs = relatedToolsMap[tool.slug] || [];
  const relatedTools = allTools?.filter(t => relatedSlugs.includes(t.slug)).slice(0, 4) || [];

  // Build SEO data
  const seoTitle = tool.meta_title || `${tool.name} — Free AI Tool`;
  const seoDesc = tool.meta_description || tool.description;
  const jsonLdData = [
    toolJsonLd(tool),
    breadcrumbJsonLd([
      { name: 'Home', url: '/' },
      { name: 'AI Tools', url: '/try-tools' },
      { name: tool.name, url: `/tool/${tool.slug}` },
    ]),
    ...(faqs.length > 0 ? [faqJsonLd(faqs)] : []),
  ];

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        canonical={`/tool/${tool.slug}`}
        keywords={tool.keywords}
        jsonLd={jsonLdData}
      />

      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 py-16 sm:py-24">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            {/* Category Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-6" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <CategoryIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-indigo-700 dark:text-indigo-300">{cat.label}</span>
              {tool.is_premium && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs font-semibold">
                  PRO
                </span>
              )}
              {!tool.is_premium && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs font-semibold">
                  FREE
                </span>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
              {tool.name}
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
              {tool.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={`/register?redirect=${encodeURIComponent(`/tools/${slug}`)}`}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 text-lg"
              >
                <SparklesIcon className="h-5 w-5" />
                Try {tool.name} Free
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-lg"
              >
                View Pricing
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <UserGroupIcon className="h-4 w-4" />
                {(tool.usage_count || 0).toLocaleString()}+ uses
              </span>
              <span className="flex items-center gap-1">
                <StarIcon className="h-4 w-4 text-yellow-500" />
                4.7/5 rating
              </span>
              <span className="flex items-center gap-1">
                <BoltIcon className="h-4 w-4 text-green-500" />
                Powered by AI
              </span>
            </div>
          </div>
        </section>

        {/* Feature highlights */}
        <section className="py-12 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center p-6"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                  <BoltIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Instant Results</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Powered by Llama 3.3 70B — get results in seconds, not minutes.</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center p-6"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 mb-4">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {tool.is_premium ? 'Pro Feature' : 'Free to Use'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tool.is_premium
                    ? 'Available with Pro subscription — just $5/month for 2,000 uses.'
                    : '50 free uses every month. No credit card required to start.'}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center p-6"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 mb-4">
                  <SparklesIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Part of 33+ Tools</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">One platform, all the AI tools you need for writing, research, and productivity.</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Long Description / Content Section */}
        {tool.long_description && (
          <section className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-800/50">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
              <article className="prose prose-lg dark:prose-invert max-w-none">
                {renderLongDescription(tool.long_description)}
              </article>
            </div>
          </section>
        )}

        {/* FAQ Section (extracted from long_description) */}
        {faqs.length > 0 && (
          <section className="py-12 sm:py-16 bg-white dark:bg-gray-900">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
                Frequently Asked Questions
              </h2>
              <dl className="space-y-6">
                {faqs.map((faq, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6"
                  >
                    <dt className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {faq.question}
                    </dt>
                    <dd className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {faq.answer}
                    </dd>
                  </motion.div>
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* Related Tools */}
        {relatedTools.length > 0 && (
          <section className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-800/50">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
                Related AI Tools
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedTools.map((rt) => (
                  <Link
                    key={rt.slug}
                    to={`/tool/${rt.slug}`}
                    className="group bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        {React.createElement(getToolIcon(rt.icon), { className: 'w-5 h-5 text-indigo-600 dark:text-indigo-400' })}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {rt.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                          {rt.description}
                        </p>
                        <span className="inline-flex items-center text-xs mt-2 font-medium text-indigo-600 dark:text-indigo-400">
                          {rt.is_premium ? '⭐ Pro' : '✓ Free'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <section className="py-16 sm:py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to use {tool.name}?
            </h2>
            <p className="text-lg text-indigo-100 mb-8 max-w-xl mx-auto">
              Join thousands of students, writers, and professionals who use Sovereign to work smarter with AI.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={`/register?redirect=${encodeURIComponent(`/tools/${slug}`)}`}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-indigo-600 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
              >
                Get Started Free
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                to="/try-tools"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-500/30 text-white font-semibold rounded-xl border border-white/20 hover:bg-indigo-500/50 transition-all text-lg"
              >
                Try Without Signing Up
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default ToolLandingPage;
