import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolOptionSelector, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface OutlineGeneratorToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const OutlineGeneratorTool: React.FC<OutlineGeneratorToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [topic, setTopic] = useState('');
  const [outlineType, setOutlineType] = useState('essay');
  const [result, setResult] = useState('');
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const typeOptions = [
    { value: 'essay', label: 'Essay', icon: '📝' },
    { value: 'article', label: 'Article', icon: '📰' },
    { value: 'report', label: 'Report', icon: '📊' },
    { value: 'story', label: 'Story', icon: '📖' },
    { value: 'presentation', label: 'Presentation', icon: '📺' },
  ];

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: string; usage_id: string; processing_time: number }>(
        '/tools/outline-generator/',
        { topic, outline_type: outlineType }
      );
      setResult(response.result || '');
      setProcessingTime(response.processing_time);
      toast.success('Outline generated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate outline');
    } finally {
      setIsProcessing(false);
    }
  }, [topic, outlineType, setIsProcessing]);

  const handleReset = () => {
    setTopic('');
    setResult('');
    setProcessingTime(undefined);
  };

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          <ToolOptionSelector
            label="Outline Type"
            options={typeOptions}
            value={outlineType}
            onChange={setOutlineType}
            columns={5}
          />

          <ToolTextArea
            id="outline-topic"
            label="Topic"
            value={topic}
            onChange={setTopic}
            placeholder="Enter the topic or subject for your outline..."
            rows={3}
            maxLength={500}
            showPaste={false}
          />

          <ToolActions
            onSubmit={handleGenerate}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!topic.trim()}
            submitLabel="Generate Outline"
            processingLabel="Generating..."
          />
        </div>
      </div>

      {result && (
        <ToolOutput
          content={result}
          title={`${typeOptions.find(t => t.value === outlineType)?.label || 'Content'} Outline`}
          isMarkdown
          processingTime={processingTime}
          onRegenerate={handleGenerate}
          isRegenerating={isProcessing}
        />
      )}

      <ToolTips
        tips={[
          'Be specific with your topic for more detailed outlines',
          'Use **Essay** for academic writing with thesis and arguments',
          'Choose **Article** for blog posts with engaging sections',
          'Select **Report** for structured business or research reports',
          'Try **Presentation** for slide-ready outlines with key points',
        ]}
      />
    </div>
  );
};

export default OutlineGeneratorTool;
