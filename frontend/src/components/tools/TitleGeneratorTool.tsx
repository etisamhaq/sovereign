import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { 
  SparklesIcon, 
  ClipboardDocumentIcon,
  ArrowPathIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  BriefcaseIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface TitleGeneratorToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface GeneratedTitle {
  text: string;
  copied: boolean;
}

const TitleGeneratorTool: React.FC<TitleGeneratorToolProps> = ({ 
  tool, 
  isProcessing, 
  setIsProcessing 
}) => {
  const [content, setContent] = useState('');
  const [style, setStyle] = useState('engaging');
  const [generatedTitles, setGeneratedTitles] = useState<GeneratedTitle[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const styleOptions = [
    { value: 'engaging', label: 'Engaging & Catchy', icon: SparklesIcon, description: 'Perfect for blog posts and articles' },
    { value: 'academic', label: 'Academic & Formal', icon: BookOpenIcon, description: 'For research papers and essays' },
    { value: 'seo', label: 'SEO Optimized', icon: MagnifyingGlassIcon, description: 'Rank higher in search results' },
    { value: 'creative', label: 'Creative & Unique', icon: LightBulbIcon, description: 'Stand out with originality' },
    { value: 'professional', label: 'Professional & Clear', icon: BriefcaseIcon, description: 'For business content' },
  ];

  const handleGenerateTitles = async () => {
    if (!content.trim()) {
      toast.error('Please enter your content or topic');
      return;
    }

    if (content.length < 20) {
      toast.error('Please provide more content for better title suggestions');
      return;
    }

    setIsProcessing(true);
    setGeneratedTitles([]);
    setSelectedIndex(null);

    try {
      const response = await apiClient.post<{
        result: string[];
        usage_id: string;
        processing_time: number;
      }>('/tools/title-generator/', {
        content,
        style,
      });

      if (response.result && Array.isArray(response.result)) {
        const titles = response.result.map(text => ({ text, copied: false }));
        setGeneratedTitles(titles);
        toast.success(`Generated ${titles.length} title suggestions!`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate titles');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (index: number) => {
    const title = generatedTitles[index];
    navigator.clipboard.writeText(title.text);
    
    // Update copied state
    const updatedTitles = [...generatedTitles];
    updatedTitles[index] = { ...title, copied: true };
    setGeneratedTitles(updatedTitles);
    
    toast.success('Title copied to clipboard!');
    
    // Reset copied state after 2 seconds
    setTimeout(() => {
      const resetTitles = [...generatedTitles];
      resetTitles[index] = { ...resetTitles[index], copied: false };
      setGeneratedTitles(resetTitles);
    }, 2000);
  };

  const handleReset = () => {
    setContent('');
    setStyle('engaging');
    setGeneratedTitles([]);
    setSelectedIndex(null);
  };

  const getStyleIcon = (styleValue: string) => {
    const option = styleOptions.find(opt => opt.value === styleValue);
    return option ? option.icon : SparklesIcon;
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
        <div className="space-y-6">
          {/* Content Input */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Content or Topic
            </label>
            <textarea
              id="content"
              rows={6}
              className="input"
              placeholder="Enter your article content, blog post, or just the topic you want to write about. The more context you provide, the better the title suggestions will be..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
            />
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex justify-between">
              <span>Provide your content or describe your topic</span>
              <span>{content.length}/5000</span>
            </div>
          </div>

          {/* Style Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Title Style
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {styleOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setStyle(option.value)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      style === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`h-5 w-5 ${
                        style === option.value 
                          ? 'text-primary-600 dark:text-primary-400' 
                          : 'text-gray-400'
                      }`} />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerateTitles}
              disabled={isProcessing || !content.trim()}
              className="btn btn-primary flex-1"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Generating Titles...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-5 w-5 mr-2" />
                  Generate Titles
                </>
              )}
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Generated Titles */}
      {generatedTitles.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <SparklesIcon className="h-6 w-6 mr-2 text-primary-600 dark:text-primary-400" />
            Generated Titles
          </h2>
          
          <AnimatePresence mode="wait">
            <motion.div className="space-y-3">
              {generatedTitles.map((title, index) => {
                const StyleIcon = getStyleIcon(style);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setSelectedIndex(index)}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedIndex === index
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 flex items-start space-x-3">
                        <div className={`mt-0.5 ${
                          selectedIndex === index
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-400'
                        }`}>
                          <StyleIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-medium text-gray-900 dark:text-white">
                            {title.text}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Option {index + 1} • {title.text.length} characters
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(index);
                        }}
                        className="ml-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        {title.copied ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <ClipboardDocumentIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Tips */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 Title Writing Tips
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Keep titles between 50-60 characters for optimal display</li>
              <li>• Include your main keyword near the beginning</li>
              <li>• Use numbers and power words to grab attention</li>
              <li>• Make sure your title accurately reflects your content</li>
              <li>• Test different variations to see what resonates with your audience</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TitleGeneratorTool;