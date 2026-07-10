import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ClipboardDocumentIcon, ArrowPathIcon, HashtagIcon } from '@heroicons/react/24/outline';

interface KeywordExtractorToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface KeywordResult {
  keywords: Array<{
    keyword: string;
    relevance: number;
    category: string;
  }>;
  summary: string;
}

const KeywordExtractorTool: React.FC<KeywordExtractorToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [maxKeywords, setMaxKeywords] = useState(10);
  const [result, setResult] = useState<KeywordResult | null>(null);

  const handleExtract = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to extract keywords from');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: KeywordResult; usage_id: string; processing_time: number }>(
        '/tools/keyword-extractor/',
        { text: inputText, max_keywords: maxKeywords }
      );

      setResult(response.result || null);
      toast.success(`Keywords extracted in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to extract keywords');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyKeywords = () => {
    if (!result) return;
    const text = result.keywords.map((k) => k.keyword).join(', ');
    navigator.clipboard.writeText(text);
    toast.success('Keywords copied to clipboard!');
  };

  const handleReset = () => {
    setInputText('');
    setResult(null);
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (relevance >= 0.5) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
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
          {/* Max Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Maximum Keywords: {maxKeywords}
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={maxKeywords}
              onChange={(e) => setMaxKeywords(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>5</span>
              <span>15</span>
              <span>30</span>
            </div>
          </div>

          {/* Input Text */}
          <div>
            <label htmlFor="input-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Text to Analyze
            </label>
            <textarea
              id="input-text"
              rows={8}
              className="input"
              placeholder="Paste your article, blog post, or any text to extract keywords from..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              maxLength={10000}
            />
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {inputText.length}/10000 characters • {inputText.split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleExtract}
              disabled={isProcessing || !inputText.trim()}
              className="btn btn-primary flex-1"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Extracting Keywords...
                </>
              ) : (
                <>
                  <HashtagIcon className="h-5 w-5 mr-2" />
                  Extract Keywords
                </>
              )}
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Reset
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              {result.summary && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Content Summary</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{result.summary}</p>
                </div>
              )}

              {/* Keywords */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Extracted Keywords ({result.keywords.length})
                  </label>
                  <button
                    onClick={copyKeywords}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                    Copy All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((kw, index) => (
                    <span
                      key={index}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getRelevanceColor(kw.relevance)}`}
                      title={`Relevance: ${(kw.relevance * 100).toFixed(0)}% • Category: ${kw.category}`}
                    >
                      {kw.keyword}
                      <span className="ml-1.5 text-xs opacity-70">
                        {(kw.relevance * 100).toFixed(0)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Keywords by Category */}
              {(() => {
                const categories = Array.from(new Set(result.keywords.map((k) => k.category)));
                if (categories.length <= 1) return null;
                return (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By Category</h3>
                    <div className="space-y-2">
                      {categories.map((cat) => (
                        <div key={cat}>
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {cat}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.keywords
                              .filter((k) => k.category === cat)
                              .map((kw, i) => (
                                <span
                                  key={i}
                                  className="inline-block px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  {kw.keyword}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeywordExtractorTool;
