import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolOptionSelector, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface EssayWriterToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const EssayWriterTool: React.FC<EssayWriterToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [topic, setTopic] = useState('');
  const [essayType, setEssayType] = useState('argumentative');
  const [length, setLength] = useState(500);
  const [result, setResult] = useState('');
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const essayTypes = [
    { value: 'argumentative', label: 'Argumentative', icon: '⚖️', description: 'Defend a position' },
    { value: 'descriptive', label: 'Descriptive', icon: '🖼️', description: 'Paint a picture' },
    { value: 'narrative', label: 'Narrative', icon: '📖', description: 'Tell a story' },
    { value: 'expository', label: 'Expository', icon: '🔍', description: 'Explain a topic' },
    { value: 'persuasive', label: 'Persuasive', icon: '🎯', description: 'Convince the reader' },
  ];

  const lengthOptions = [
    { value: '200', label: 'Short (~200)', icon: '📄' },
    { value: '500', label: 'Medium (~500)', icon: '📑' },
    { value: '1000', label: 'Long (~1000)', icon: '📚' },
    { value: '1500', label: 'Extended (~1500)', icon: '📜' },
  ];

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic for the essay');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: string; usage_id: string; processing_time: number }>(
        '/tools/essay-writer/',
        { topic, essay_type: essayType, length }
      );
      setResult(response.result || '');
      setProcessingTime(response.processing_time);
      toast.success('Essay generated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate essay');
    } finally {
      setIsProcessing(false);
    }
  }, [topic, essayType, length, setIsProcessing]);

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
            label="Essay Type"
            options={essayTypes}
            value={essayType}
            onChange={setEssayType}
            columns={5}
          />

          <ToolOptionSelector
            label="Essay Length"
            options={lengthOptions}
            value={String(length)}
            onChange={(v) => setLength(Number(v))}
            columns={4}
          />

          <ToolTextArea
            id="topic"
            label="Essay Topic"
            value={topic}
            onChange={setTopic}
            placeholder="Enter the topic or prompt for your essay..."
            rows={3}
            maxLength={500}
            showPaste={false}
          />

          <ToolActions
            onSubmit={handleGenerate}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!topic.trim()}
            submitLabel="Generate Essay"
            processingLabel="Generating Essay..."
          />
        </div>
      </div>

      {result && (
        <ToolOutput
          content={result}
          title={`${essayTypes.find(t => t.value === essayType)?.label || ''} Essay`}
          isMarkdown
          processingTime={processingTime}
          onRegenerate={handleGenerate}
          isRegenerating={isProcessing}
        />
      )}

      <ToolTips
        tips={[
          'Be specific with your topic for a more focused essay',
          '**Argumentative** essays require a clear thesis statement',
          '**Descriptive** essays use sensory details to paint vivid scenes',
          '**Narrative** essays tell a compelling story with a beginning, middle, and end',
          'Use the export button to download your essay as Markdown, PDF, or DOCX',
        ]}
      />
    </div>
  );
};

export default EssayWriterTool;
