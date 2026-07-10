import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolOptionSelector, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface WritingImproverToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const WritingImproverTool: React.FC<WritingImproverToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [focus, setFocus] = useState('clarity');
  const [result, setResult] = useState('');
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const focusOptions = [
    { value: 'clarity', label: 'Clarity', icon: '🔍', description: 'Make text clearer' },
    { value: 'conciseness', label: 'Conciseness', icon: '✂️', description: 'Remove wordiness' },
    { value: 'engagement', label: 'Engagement', icon: '🎯', description: 'More compelling' },
    { value: 'academic', label: 'Academic', icon: '🎓', description: 'Scholarly tone' },
    { value: 'business', label: 'Business', icon: '💼', description: 'Professional tone' },
  ];

  const handleImprove = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to improve');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: string; usage_id: string; processing_time: number }>(
        '/tools/writing-improver/',
        { text: inputText, focus }
      );
      setResult(response.result || '');
      setProcessingTime(response.processing_time);
      toast.success('Writing improved successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to improve writing');
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, focus, setIsProcessing]);

  const handleReset = () => {
    setInputText('');
    setResult('');
    setProcessingTime(undefined);
  };

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          <ToolOptionSelector
            label="Improvement Focus"
            options={focusOptions}
            value={focus}
            onChange={setFocus}
            columns={5}
          />

          <ToolTextArea
            id="improve-text"
            label="Original Text"
            value={inputText}
            onChange={setInputText}
            placeholder="Paste the text you want to improve..."
            rows={8}
            maxLength={10000}
            showWordCount
          />

          <ToolActions
            onSubmit={handleImprove}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!inputText.trim()}
            submitLabel="Improve Writing"
            processingLabel="Improving..."
          />
        </div>
      </div>

      {result && (
        <ToolOutput
          content={result}
          title="Improved Text"
          isMarkdown
          processingTime={processingTime}
          onRegenerate={handleImprove}
          isRegenerating={isProcessing}
        />
      )}

      <ToolTips
        tips={[
          'Use **Clarity** to make confusing sentences easier to understand',
          'Choose **Conciseness** to eliminate filler words and redundancy',
          'Try **Engagement** to make blog posts and articles more compelling',
          'Select **Academic** for research papers, essays, and scholarly writing',
          'Use **Business** for emails, reports, and professional communications',
        ]}
      />
    </div>
  );
};

export default WritingImproverTool;
