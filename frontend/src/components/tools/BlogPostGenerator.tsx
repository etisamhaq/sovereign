import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  NewspaperIcon,
  HashtagIcon,
  ShareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface BlogPostGeneratorProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const tones = [
  { value: 'informative', label: '📚 Informative' },
  { value: 'conversational', label: '💬 Conversational' },
  { value: 'professional', label: '💼 Professional' },
  { value: 'witty', label: '😄 Witty' },
  { value: 'inspirational', label: '✨ Inspirational' },
  { value: 'technical', label: '⚙️ Technical' },
];

const lengths = [
  { value: 'short', label: 'Short (~800 words)' },
  { value: 'medium', label: 'Medium (~1,500 words)' },
  { value: 'long', label: 'Long (~2,500 words)' },
];

interface BlogResult {
  title: string;
  meta_description: string;
  slug_suggestion: string;
  sections: { heading: string; content: string }[];
  tags: string[];
  social_snippet: string;
  estimated_read_time: string;
  word_count: number;
}

const BlogPostGenerator: React.FC<BlogPostGeneratorProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('informative');
  const [length, setLength] = useState('medium');
  const [targetAudience, setTargetAudience] = useState('');
  const [keywords, setKeywords] = useState('');
  const [result, setResult] = useState<BlogResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    if (result) setExpandedSections(new Set(result.sections.map((_, i) => i)));
  };

  const collapseAll = () => setExpandedSections(new Set());

  const handleGenerate = async () => {
    if (!topic.trim()) return toast.error('Please enter a blog topic');
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await apiClient.post<{ result: BlogResult; processing_time: number }>(
        '/tools/blog-post-generator/',
        { topic, tone, length, target_audience: targetAudience, keywords }
      );
      setResult(response.result);
      if (response.result?.sections) {
        setExpandedSections(new Set(response.result.sections.map((_: any, i: number) => i)));
      }
      toast.success(`Blog post generated in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate blog post');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyFullPost = () => {
    if (!result) return;
    const text = `# ${result.title}\n\n${result.sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n')}`;
    navigator.clipboard.writeText(text);
    toast.success('Full blog post copied!');
  };

  const copySection = (e: React.MouseEvent, section: { heading: string; content: string }) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`## ${section.heading}\n\n${section.content}`);
    toast.success('Section copied!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <NewspaperIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Blog Topic *</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., 10 Proven Ways to Boost Your Morning Productivity"
            className="input w-full"
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tone</label>
          <div className="flex flex-wrap gap-2">
            {tones.map(t => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  tone === t.value
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Post Length</label>
          <div className="grid grid-cols-3 gap-2">
            {lengths.map(l => (
              <button
                key={l.value}
                onClick={() => setLength(l.value)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition text-center ${
                  length === l.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Audience <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., small business owners"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SEO Keywords <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g., productivity, morning routine"
              className="input w-full"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isProcessing || !topic.trim()}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating Blog Post...</>
          ) : (
            <><NewspaperIcon className="h-5 w-5" /> Generate Blog Post</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Title & Meta */}
          <div className="card">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{result.title}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                  {result.estimated_read_time && <span>📖 {result.estimated_read_time}</span>}
                  {result.word_count > 0 && <span>· ~{result.word_count.toLocaleString()} words</span>}
                  {result.slug_suggestion && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">/{result.slug_suggestion}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={expandedSections.size === result.sections.length ? collapseAll : expandAll}
                  className="btn btn-outline text-xs px-3 py-1.5"
                >
                  {expandedSections.size === result.sections.length ? 'Collapse' : 'Expand'} All
                </button>
                <button onClick={copyFullPost} className="btn btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy All
                </button>
              </div>
            </div>

            {/* Meta Description */}
            {result.meta_description && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">🔍 SEO Meta Description</h4>
                  <span className={`text-xs font-medium ${
                    result.meta_description.length <= 160 ? 'text-green-600' : 'text-red-500'
                  }`}>{result.meta_description.length}/160</span>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200">{result.meta_description}</p>
              </div>
            )}
          </div>

          {/* Sections */}
          {result.sections.map((section, idx) => (
            <div key={idx} className="card !p-0 overflow-hidden">
              <button
                onClick={() => toggleSection(idx)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{section.heading}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={(e) => copySection(e, section)}
                    className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-1 rounded"
                    title="Copy section"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                  {expandedSections.has(idx) ? (
                    <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>
              {expandedSections.has(idx) && (
                <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{section.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* Tags & Social */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.tags?.length > 0 && (
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <HashtagIcon className="h-4 w-4 text-primary-500" /> Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.tags.map((tag, i) => (
                    <span key={i} className="px-2.5 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium border border-primary-200 dark:border-primary-800">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.social_snippet && (
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <ShareIcon className="h-4 w-4 text-primary-500" /> Social Snippet
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">"{result.social_snippet}"</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(result.social_snippet); toast.success('Snippet copied!'); }}
                  className="mt-2 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <ClipboardDocumentIcon className="h-3 w-3" /> Copy snippet
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogPostGenerator;
