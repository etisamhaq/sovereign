import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { ToolHeader, ToolTextArea, ToolOptionSelector, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface TextSummarizerProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

type SummaryLength = 'short' | 'medium' | 'long' | 'bullets';

interface SummaryStats {
  originalWords: number;
  summaryWords: number;
  compressionRatio: number;
}

const TextSummarizer: React.FC<TextSummarizerProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [summary, setSummary] = useState('');
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const lengthOptions = [
    { value: 'short', label: 'Short', description: '2-3 sentences', icon: '📄' },
    { value: 'medium', label: 'Medium', description: '1 paragraph', icon: '📑' },
    { value: 'long', label: 'Long', description: 'Detailed summary', icon: '📚' },
    { value: 'bullets', label: 'Bullet Points', description: 'Key points list', icon: '📋' },
  ];

  const calculateStats = (original: string, summarized: string): SummaryStats => {
    const originalWords = original.trim().split(/\s+/).length;
    const summaryWords = summarized.trim().split(/\s+/).length;
    const compressionRatio = Math.round((1 - summaryWords / originalWords) * 100);
    return { originalWords, summaryWords, compressionRatio: Math.max(0, compressionRatio) };
  };

  const handleSummarize = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to summarize');
      return;
    }
    if (inputText.length < 100) {
      toast.error('Please provide more text (at least 100 characters) for better summarization');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: string; usage_id: string; processing_time: number }>(
        '/tools/summarizer/',
        { text: inputText, length: summaryLength }
      );
      setSummary(response.result);
      setStats(calculateStats(inputText, response.result));
      setProcessingTime(response.processing_time);
      toast.success('Text summarized successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to summarize text');
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, summaryLength, setIsProcessing]);

  const handleReset = () => {
    setInputText('');
    setSummary('');
    setStats(null);
    setProcessingTime(undefined);
  };

  const handlePasteExample = () => {
    const exampleText = `Artificial Intelligence (AI) has rapidly evolved from a futuristic concept to a practical technology that permeates various aspects of our daily lives. From virtual assistants like Siri and Alexa to recommendation systems on Netflix and Amazon, AI technologies are becoming increasingly sophisticated and ubiquitous. Machine learning, a subset of AI, enables computers to learn from data without being explicitly programmed, leading to breakthroughs in areas such as natural language processing, computer vision, and predictive analytics.

The impact of AI extends far beyond consumer applications. In healthcare, AI algorithms can analyze medical images to detect diseases earlier than human doctors, potentially saving countless lives. In finance, AI systems detect fraudulent transactions in real-time, protecting consumers and businesses. Transportation is being revolutionized by autonomous vehicles, while manufacturing benefits from AI-powered quality control and predictive maintenance.

However, the rapid advancement of AI also raises important ethical and societal questions. Concerns about job displacement, privacy, algorithmic bias, and the concentration of power in tech companies have sparked debates worldwide. As AI systems become more powerful, ensuring they are developed and deployed responsibly becomes crucial. This includes addressing issues of transparency, accountability, and fairness in AI decision-making processes.

Looking ahead, the future of AI promises even more transformative changes. Researchers are working on artificial general intelligence (AGI), which would match or exceed human intelligence across all domains. While this remains a long-term goal, incremental advances continue to push the boundaries of what's possible. As we navigate this AI-driven future, balancing innovation with ethical considerations will be key to ensuring that AI benefits all of humanity.`;
    setInputText(exampleText);
    toast.success('Example text loaded!');
  };

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Text to Summarize
            </label>
            <button
              onClick={handlePasteExample}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Paste example text
            </button>
          </div>

          <ToolTextArea
            id="input-text"
            label=""
            value={inputText}
            onChange={setInputText}
            placeholder="Paste your article, document, or any long text here..."
            rows={10}
            maxLength={50000}
            minLength={100}
          />

          <ToolOptionSelector
            label="Summary Length"
            options={lengthOptions}
            value={summaryLength}
            onChange={(v) => setSummaryLength(v as SummaryLength)}
            columns={4}
          />

          <ToolActions
            onSubmit={handleSummarize}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!inputText.trim() || inputText.length < 100}
            submitLabel="Summarize Text"
            processingLabel="Summarizing..."
          />
        </div>
      </div>

      {summary && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Statistics */}
          {stats && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Summary Statistics
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.originalWords}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Original Words</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.summaryWords}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Summary Words</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.compressionRatio}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Compression</p>
                </div>
              </div>
            </div>
          )}

          <ToolOutput
            content={summary}
            title={`Summary (${lengthOptions.find(opt => opt.value === summaryLength)?.label})`}
            isMarkdown={summaryLength === 'bullets'}
            processingTime={processingTime}
            onRegenerate={handleSummarize}
            isRegenerating={isProcessing}
          />
        </motion.div>
      )}

      <ToolTips
        tips={[
          'Use **bullet points** for quick scanning of key information',
          '**Short** summaries are great for abstracts and quick overviews',
          '**Long** summaries preserve more detail and context',
          'For best results, provide well-structured text with clear paragraphs',
          'You can summarize up to 50,000 characters at once',
        ]}
      />
    </div>
  );
};

export default TextSummarizer;
