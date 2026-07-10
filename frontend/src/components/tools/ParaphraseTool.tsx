import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolOptionSelector, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface ParaphraseToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const ParaphraseTool: React.FC<ParaphraseToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [mode, setMode] = useState('standard');
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const modes = [
    { value: 'standard', label: 'Standard', icon: '✏️', description: 'General rewrite' },
    { value: 'formal', label: 'Formal', icon: '🎓', description: 'Academic / professional' },
    { value: 'creative', label: 'Creative', icon: '🎨', description: 'Varied vocabulary' },
    { value: 'simple', label: 'Simple', icon: '💡', description: 'Easy to understand' },
    { value: 'expand', label: 'Expand', icon: '📖', description: 'Add more detail' },
    { value: 'shorten', label: 'Shorten', icon: '✂️', description: 'More concise' },
  ];

  const handleParaphrase = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to paraphrase');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: string; usage_id: string; processing_time: number }>(
        '/tools/paraphrase/',
        { text: inputText, mode }
      );
      setOutputText(response.result || '');
      setProcessingTime(response.processing_time);
      toast.success('Text paraphrased successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to paraphrase text');
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, mode, setIsProcessing]);

  const handleReset = () => {
    setInputText('');
    setOutputText('');
    setProcessingTime(undefined);
  };

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          <ToolOptionSelector
            label="Paraphrase Mode"
            options={modes}
            value={mode}
            onChange={setMode}
            columns={3}
          />

          <ToolTextArea
            id="input-text"
            label="Original Text"
            value={inputText}
            onChange={setInputText}
            placeholder="Enter your text here..."
            rows={6}
            maxLength={5000}
          />

          <ToolActions
            onSubmit={handleParaphrase}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!inputText.trim()}
            submitLabel="Paraphrase"
            processingLabel="Processing..."
          />
        </div>
      </div>

      {outputText && (
        <ToolOutput
          content={outputText}
          title="Paraphrased Text"
          isMarkdown={false}
          processingTime={processingTime}
          onRegenerate={handleParaphrase}
          isRegenerating={isProcessing}
        />
      )}

      <ToolTips
        tips={[
          'Use **Standard** mode for general paraphrasing',
          'Choose **Formal** for academic or professional content',
          'Try **Creative** for more varied vocabulary and structure',
          'Select **Simple** to make complex text easier to understand',
          'Use **Expand** to add more detail or **Shorten** to be more concise',
        ]}
      />
    </div>
  );
};

export default ParaphraseTool;
