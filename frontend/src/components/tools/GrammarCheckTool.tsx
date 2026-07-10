import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface GrammarCheckToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const GrammarCheckTool: React.FC<GrammarCheckToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [corrections, setCorrections] = useState<any[]>([]);
  const [correctedText, setCorrectedText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const handleCheck = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to check');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{
        result: { corrected_text: string; errors: any[]; suggestions: string[] };
        usage_id: string;
        processing_time: number;
      }>('/tools/grammar-check/', { text: inputText });

      const result = response.result || {};
      setCorrections(result.errors || []);
      setCorrectedText(result.corrected_text || '');
      setSuggestions(result.suggestions || []);
      setProcessingTime(response.processing_time);

      if (!result.errors || result.errors.length === 0) {
        toast.success('No grammar issues found!');
      } else {
        toast.success('Grammar check completed!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to check grammar');
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, setIsProcessing]);

  const handleReset = () => {
    setInputText('');
    setCorrections([]);
    setCorrectedText('');
    setSuggestions([]);
    setProcessingTime(undefined);
  };

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          <ToolTextArea
            id="input-text"
            label="Enter Your Text"
            value={inputText}
            onChange={setInputText}
            placeholder="Paste or type your text here..."
            rows={8}
            maxLength={5000}
          />

          <ToolActions
            onSubmit={handleCheck}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!inputText.trim()}
            submitLabel="Check Grammar"
            processingLabel="Checking..."
          />
        </div>
      </div>

      {/* Error List */}
      {corrections.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Found {corrections.length} issue{corrections.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {corrections.map((error, index) => (
              <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start">
                  <span className="text-red-600 dark:text-red-400 font-medium mr-2">Error {index + 1}:</span>
                  <p className="text-sm text-gray-800 dark:text-gray-200 flex-1">{error}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corrected Text */}
      {correctedText && (
        <ToolOutput
          content={correctedText}
          title="Corrected Text"
          isMarkdown={false}
          processingTime={processingTime}
          onRegenerate={handleCheck}
          isRegenerating={isProcessing}
        />
      )}

      {/* Style Suggestions */}
      {suggestions.length > 0 && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h4 className="text-md font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Style Suggestions
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-blue-800 dark:text-blue-200">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ToolTips
        tips={[
          'Paste any text to check for grammar, spelling, and punctuation errors',
          'The tool also provides style suggestions for better writing',
          'Use the corrected text directly with copy or export options',
          'Regenerate to get alternative corrections for the same text',
        ]}
      />
    </div>
  );
};

export default GrammarCheckTool;
