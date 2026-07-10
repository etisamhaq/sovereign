import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';

interface SocialMediaGeneratorToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const platformOptions = [
  { value: 'twitter', label: '𝕏 Twitter/X', emoji: '🐦' },
  { value: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { value: 'instagram', label: 'Instagram', emoji: '📸' },
  { value: 'facebook', label: 'Facebook', emoji: '📘' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { value: 'threads', label: 'Threads', emoji: '🧵' },
];

const toneOptions = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'educational', label: 'Educational' },
  { value: 'promotional', label: 'Promotional' },
];

interface PostVariation {
  content: string;
  hashtags: string[];
  best_time: string;
  tip: string;
}

interface SocialMediaResult {
  posts: Record<string, PostVariation[]>;
  content_strategy: string;
}

const SocialMediaGeneratorTool: React.FC<SocialMediaGeneratorToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [topic, setTopic] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter', 'linkedin', 'instagram']);
  const [tone, setTone] = useState('casual');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [numVariations, setNumVariations] = useState(2);
  const [result, setResult] = useState<SocialMediaResult | null>(null);
  const [activeTab, setActiveTab] = useState('');

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return toast.error('Please enter a topic');
    if (selectedPlatforms.length === 0) return toast.error('Select at least one platform');

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: SocialMediaResult; processing_time: number }>(
        '/tools/social-media-generator/',
        {
          topic,
          platforms: selectedPlatforms,
          tone,
          include_hashtags: includeHashtags,
          include_emojis: includeEmojis,
          num_variations: numVariations,
        }
      );
      setResult(response.result);
      setActiveTab(selectedPlatforms[0] || '');
      toast.success(`Posts generated in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate posts');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPost = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <ChatBubbleLeftRightIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic / Idea</label>
          <textarea
            className="input"
            rows={3}
            placeholder="What should the posts be about?"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platforms</label>
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((p) => (
              <button
                key={p.value}
                onClick={() => togglePlatform(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPlatforms.includes(p.value)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tone</label>
            <select className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
              {toneOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Variations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variations</label>
            <select className="input" value={numVariations} onChange={(e) => setNumVariations(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} variation{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeHashtags} onChange={(e) => setIncludeHashtags(e.target.checked)} className="rounded" />
              Include Hashtags
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeEmojis} onChange={(e) => setIncludeEmojis(e.target.checked)} className="rounded" />
              Include Emojis
            </label>
          </div>
        </div>

        {/* Generate */}
        <button onClick={handleGenerate} disabled={isProcessing} className="btn btn-primary flex items-center gap-2">
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating...</>
          ) : (
            <><ChatBubbleLeftRightIcon className="h-5 w-5" /> Generate Posts</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Generated Posts</h2>

          {/* Strategy note */}
          {result.content_strategy && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4 text-sm text-purple-700 dark:text-purple-300">
              💡 <strong>Strategy:</strong> {result.content_strategy}
            </div>
          )}

          {/* Platform tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
            {Object.keys(result.posts).map((platform) => (
              <button
                key={platform}
                onClick={() => setActiveTab(platform)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === platform
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {platformOptions.find((p) => p.value === platform)?.emoji}{' '}
                {platformOptions.find((p) => p.value === platform)?.label || platform}
              </button>
            ))}
          </div>

          {/* Posts for active tab */}
          <div className="space-y-4">
            {(result.posts[activeTab] || []).map((post, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Variation {idx + 1}
                  </span>
                  <button
                    onClick={() => copyPost(post.content)}
                    className="text-gray-500 hover:text-primary-600 transition-colors"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm">{post.content}</p>

                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.hashtags.map((tag, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
                        <HashtagIcon className="h-3 w-3" />{tag.replace('#', '')}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {post.best_time && <span>🕐 Best time: {post.best_time}</span>}
                  {post.tip && <span>💡 {post.tip}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialMediaGeneratorTool;
