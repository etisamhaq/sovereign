import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface PlagiarismCheckToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const PlagiarismCheckTool: React.FC<PlagiarismCheckToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const handleCheck = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to check');
      return;
    }
    if (inputText.length < 50) {
      toast.error('Please provide at least 50 characters for accurate analysis');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: any; usage_id: string; processing_time: number }>(
        '/tools/plagiarism-check/',
        { text: inputText }
      );
      setResult(response.result);
      setProcessingTime(response.processing_time);
      toast.success('Plagiarism check completed!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to check plagiarism');
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, setIsProcessing]);

  const handleReset = () => {
    setInputText('');
    setResult(null);
    setProcessingTime(undefined);
  };

  const resultText = typeof result === 'string' ? result : result ? JSON.stringify(result, null, 2) : '';

  const originalityScore =
    typeof result === 'object' && result
      ? result.originality_score || result.score || null
      : null;

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          <ToolTextArea
            id="plagiarism-text"
            label="Text to Check"
            value={inputText}
            onChange={setInputText}
            placeholder="Paste your text here to check for potential plagiarism and originality..."
            rows={10}
            maxLength={50000}
            minLength={50}
            showWordCount
          />

          <ToolActions
            onSubmit={handleCheck}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!inputText.trim() || inputText.length < 50}
            submitLabel="Check Plagiarism"
            processingLabel="Analyzing..."
          />
        </div>
      </div>

      {originalityScore !== null && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Originality Score</h3>
            <span
              className={`text-3xl font-bold ${
                originalityScore >= 80
                  ? 'text-green-600 dark:text-green-400'
                  : originalityScore >= 50
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {originalityScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                originalityScore >= 80 ? 'bg-green-500' : originalityScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(originalityScore, 100)}%` }}
            />
          </div>
        </div>
      )}

      {result && (
        <ToolOutput
          content={resultText}
          title="Plagiarism Analysis"
          isMarkdown
          processingTime={processingTime}
          onRegenerate={handleCheck}
          isRegenerating={isProcessing}
        />
      )}

      <ToolTips
        tips={[
          'Provide longer texts for more accurate analysis',
          'The tool analyzes writing patterns and originality — not a full internet scan',
          'Use this alongside the Grammar Check and Writing Improver for polished content',
          'Higher originality scores indicate more unique content',
        ]}
      />
    </div>
  );
};

export default PlagiarismCheckTool;
