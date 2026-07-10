import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { 
  MagnifyingGlassIcon, 
  ClipboardDocumentIcon,
  SparklesIcon,
  ChartBarIcon,
  TagIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface MetaDescriptionGeneratorProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface MetaDescription {
  text: string;
  length: number;
  keywords_included: string[];
}

interface GenerationResult {
  descriptions: MetaDescription[];
  best_practices_score: number;
  seo_tips: string[];
}

const MetaDescriptionGenerator: React.FC<MetaDescriptionGeneratorProps> = ({ 
  tool, 
  isProcessing, 
  setIsProcessing 
}) => {
  const [content, setContent] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tone, setTone] = useState('professional');
  const [targetLength, setTargetLength] = useState(155);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selectedDescriptionIndex, setSelectedDescriptionIndex] = useState(0);

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast.error('Please enter content to generate meta descriptions');
      return;
    }

    if (content.length < 50) {
      toast.error('Please provide more content for better meta descriptions');
      return;
    }

    setIsProcessing(true);
    try {
      const keywordList = keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const response = await apiClient.post<{
        result: GenerationResult;
        usage_id: string;
        processing_time: number;
      }>('/tools/meta-description-generator/', {
        content,
        keywords: keywordList,
        tone,
        target_length: targetLength,
      });

      if (response.result) {
        setResult(response.result);
        setSelectedDescriptionIndex(0);
        toast.success('Meta descriptions generated successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate meta descriptions');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const handleReset = () => {
    setContent('');
    setKeywords('');
    setTone('professional');
    setTargetLength(155);
    setResult(null);
    setSelectedDescriptionIndex(0);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {tool.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {tool.description}
        </p>
      </div>

      <div className="card">
        <div className="space-y-4">
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Page Content or Description
            </label>
            <textarea
              id="content"
              rows={6}
              className="input"
              placeholder="Enter your page content, article text, or description here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={10000}
            />
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {content.length}/10000 characters
            </div>
          </div>

          <div>
            <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Keywords (Optional)
            </label>
            <input
              id="keywords"
              type="text"
              className="input"
              placeholder="e.g., SEO tools, meta description, search optimization (comma-separated)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Separate keywords with commas
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tone
              </label>
              <select
                id="tone"
                className="input"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="urgent">Urgent</option>
                <option value="informative">Informative</option>
                <option value="promotional">Promotional</option>
              </select>
            </div>

            <div>
              <label htmlFor="target-length" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Length: {targetLength} characters
              </label>
              <input
                id="target-length"
                type="range"
                min="120"
                max="160"
                value={targetLength}
                onChange={(e) => setTargetLength(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>120</span>
                <span>Optimal: 150-160</span>
                <span>160</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={isProcessing || !content.trim()}
              className="btn btn-primary flex-1"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-5 w-5 mr-2" />
                  Generate Meta Descriptions
                </>
              )}
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* SEO Score */}
            <div className={`card ${getScoreBgColor(result.best_practices_score)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ChartBarIcon className={`h-8 w-8 ${getScoreColor(result.best_practices_score)}`} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      SEO Best Practices Score
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Based on length, keywords, and structure
                    </p>
                  </div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(result.best_practices_score)}`}>
                  {result.best_practices_score}%
                </div>
              </div>
            </div>

            {/* Generated Descriptions */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Generated Meta Descriptions ({result.descriptions.length})
              </h3>
              
              <div className="space-y-4">
                {result.descriptions.map((desc, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedDescriptionIndex === index
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedDescriptionIndex(index)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Option {index + 1}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(desc.text);
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <ClipboardDocumentIcon className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <p className="text-gray-900 dark:text-white mb-3">
                      {desc.text}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`font-medium ${
                        desc.length >= 150 && desc.length <= 160 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {desc.length} characters
                      </span>
                      
                      {desc.keywords_included.length > 0 && (
                        <div className="flex items-center gap-1">
                          <TagIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">
                            Keywords: {desc.keywords_included.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* SERP Preview */}
            {result.descriptions[selectedDescriptionIndex] && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                  SERP Preview
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-blue-600 dark:text-blue-400 text-xl mb-1 hover:underline cursor-pointer">
                    Your Page Title Here
                  </h4>
                  <div className="text-green-700 dark:text-green-500 text-sm mb-1">
                    https://yourwebsite.com/your-page-url
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {result.descriptions[selectedDescriptionIndex].text}
                  </p>
                </div>
              </div>
            )}

            {/* SEO Tips */}
            {result.seo_tips.length > 0 && (
              <div className="card bg-blue-50 dark:bg-blue-900/20">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <InformationCircleIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  SEO Tips
                </h3>
                <ul className="space-y-2">
                  {result.seo_tips.map((tip, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                      <span className="text-gray-700 dark:text-gray-300">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default MetaDescriptionGenerator;