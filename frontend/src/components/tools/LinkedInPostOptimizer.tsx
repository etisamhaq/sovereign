import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  HashtagIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

interface LinkedInPostOptimizerProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface OptimizationResult {
  optimized_post: string;
  hook: string;
  hashtags: string[];
  cta: string;
  character_count: number;
  improvements: string[];
  tips: string[];
  error?: string;
}

const LinkedInPostOptimizer: React.FC<LinkedInPostOptimizerProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputContent, setInputContent] = useState('');
  const [goal, setGoal] = useState('engagement');
  const [tone, setTone] = useState('professional');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCta, setIncludeCta] = useState(true);
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const goals = [
    { value: 'engagement', label: 'Engagement', description: 'Maximize likes, comments & shares' },
    { value: 'brand_awareness', label: 'Brand Awareness', description: 'Establish authority' },
    { value: 'lead_generation', label: 'Lead Generation', description: 'Drive action & traffic' },
    { value: 'thought_leadership', label: 'Thought Leadership', description: 'Position as expert' },
    { value: 'networking', label: 'Networking', description: 'Build connections' },
  ];

  const tones = [
    { value: 'professional', label: 'Professional' },
    { value: 'conversational', label: 'Conversational' },
    { value: 'inspirational', label: 'Inspirational' },
    { value: 'educational', label: 'Educational' },
    { value: 'storytelling', label: 'Storytelling' },
  ];

  const handleOptimize = async () => {
    if (!inputContent.trim()) {
      toast.error('Please enter some content to optimize');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{result: OptimizationResult}>('/tools/linkedin-post-optimizer/', {
        content: inputContent,
        goal,
        tone,
        include_hashtags: includeHashtags,
        include_cta: includeCta,
        include_emoji: includeEmoji,
      });

      setResult(response.result);
      if (response.result.error) {
        toast.error(response.result.error);
      } else {
        toast.success('Post optimized successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to optimize post');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, label: string = 'Content') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleReset = () => {
    setInputContent('');
    setResult(null);
  };

  const getCharacterCountColor = (count: number) => {
    if (count < 1200) return 'text-yellow-600 dark:text-yellow-400';
    if (count <= 1500) return 'text-green-600 dark:text-green-400';
    if (count <= 3000) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {tool.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {tool.description}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="card space-y-6">
          {/* Goal Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Post Goal
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {goals.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    goal === g.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{g.label}</div>
                  <div className={`text-xs ${goal === g.value ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {g.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tone === t.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHashtags}
                onChange={(e) => setIncludeHashtags(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include Hashtags</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCta}
                onChange={(e) => setIncludeCta(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include CTA</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEmoji}
                onChange={(e) => setIncludeEmoji(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Use Emojis</span>
            </label>
          </div>

          {/* Input Text */}
          <div>
            <label htmlFor="input-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Content
            </label>
            <textarea
              id="input-content"
              rows={8}
              className="input"
              placeholder="Paste your content here. It can be an idea, rough draft, or existing post that you want to optimize for LinkedIn..."
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              maxLength={10000}
            />
            <div className="mt-1 flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{inputContent.length}/10000 characters</span>
              <span>{inputContent.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleOptimize}
              disabled={isProcessing || !inputContent.trim()}
              className="btn btn-primary flex-1"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-5 w-5 mr-2" />
                  Optimize for LinkedIn
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="btn btn-secondary"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          {result && !result.error ? (
            <>
              {/* Optimized Post */}
              <div className="card">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-primary-600" />
                    Optimized Post
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${getCharacterCountColor(result.character_count)}`}>
                      {result.character_count} chars
                    </span>
                    <button
                      onClick={() => copyToClipboard(result.optimized_post, 'Post')}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                      Copy
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {result.optimized_post}
                  </p>
                </div>
              </div>

              {/* Hook */}
              {result.hook && (
                <div className="card">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white">
                      🎣 Hook (First Line)
                    </h3>
                    <button
                      onClick={() => copyToClipboard(result.hook, 'Hook')}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium">
                    {result.hook}
                  </p>
                </div>
              )}

              {/* Hashtags */}
              {result.hashtags && result.hashtags.length > 0 && (
                <div className="card">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white flex items-center">
                      <HashtagIcon className="h-5 w-5 mr-2 text-blue-500" />
                      Suggested Hashtags
                    </h3>
                    <button
                      onClick={() => copyToClipboard(result.hashtags.join(' '), 'Hashtags')}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Copy All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.hashtags.map((tag, index) => (
                      <span
                        key={index}
                        onClick={() => copyToClipboard(tag.startsWith('#') ? tag : `#${tag}`, 'Hashtag')}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {result.cta && (
                <div className="card">
                  <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                    📢 Call to Action
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {result.cta}
                  </p>
                </div>
              )}

              {/* Improvements Made */}
              {result.improvements && result.improvements.length > 0 && (
                <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <h3 className="text-md font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center">
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    Improvements Made
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-800 dark:text-green-200">
                    {result.improvements.map((improvement, index) => (
                      <li key={index}>{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tips */}
              {result.tips && result.tips.length > 0 && (
                <div className="card bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                  <h3 className="text-md font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center">
                    <LightBulbIcon className="h-5 w-5 mr-2" />
                    Pro Tips for This Post
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                    {result.tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : !result ? (
            <div className="card h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <ChatBubbleLeftRightIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Your optimized post will appear here</p>
                <p className="text-sm mt-2">Enter your content and click "Optimize for LinkedIn"</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tips Section */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          LinkedIn Best Practices
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800 dark:text-blue-200">
          <ul className="list-disc list-inside space-y-1">
            <li>Hook readers in the first 2-3 lines (before "see more")</li>
            <li>Use line breaks for easy scanning</li>
            <li>Keep paragraphs to 1-2 sentences</li>
            <li>Optimal length: 1,200-1,500 characters</li>
          </ul>
          <ul className="list-disc list-inside space-y-1">
            <li>Use 3-5 relevant hashtags maximum</li>
            <li>Post during peak hours (Tue-Thu, 7-8am, 12pm)</li>
            <li>Include a clear call-to-action</li>
            <li>Engage with comments within the first hour</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LinkedInPostOptimizer;
