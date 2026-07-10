import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface ToneAnalyzerToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

interface ToneResult {
  result: any;
  processing_time?: number;
}

const ToneAnalyzerTool: React.FC<ToneAnalyzerToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [structuredResult, setStructuredResult] = useState<any>(null);
  const [processingTime, setProcessingTime] = useState<number | undefined>();

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Please enter text to analyze');
      return;
    }
    if (text.trim().split(/\s+/).length < 10) {
      toast.error('Please enter at least 10 words for accurate analysis');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<ToneResult>(
        '/tools/tone-analyzer/',
        { text }
      );
      // The backend may return result as a JSON object or a string
      const raw = response.result;
      if (typeof raw === 'object' && raw !== null) {
        setStructuredResult(raw);
        setResult(JSON.stringify(raw, null, 2));
      } else {
        setStructuredResult(null);
        setResult(String(raw || ''));
      }
      setProcessingTime(response.processing_time);
      toast.success('Tone analysis complete!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Tone analysis failed');
    } finally {
      setIsProcessing(false);
    }
  }, [text, setIsProcessing]);

  const handleReset = () => {
    setText('');
    setResult('');
    setStructuredResult(null);
    setProcessingTime(undefined);
  };

  // Build visual tone data from structured or string response
  const buildToneDisplay = () => {
    // If we have a structured JSON result from the backend
    if (structuredResult && typeof structuredResult === 'object') {
      const display: { label: string; value: string; color: string }[] = [];

      if (structuredResult.primary_tone) {
        display.push({ label: 'Primary Tone', value: structuredResult.primary_tone, color: 'bg-indigo-500' });
      }
      if (structuredResult.reading_level) {
        display.push({ label: 'Reading Level', value: structuredResult.reading_level, color: 'bg-blue-500' });
      }

      return display;
    }
    return [];
  };

  const buildEmotions = () => {
    if (structuredResult && Array.isArray(structuredResult.emotions)) {
      return structuredResult.emotions as string[];
    }
    return [];
  };

  const buildSuggestions = () => {
    if (structuredResult && Array.isArray(structuredResult.suggestions)) {
      return structuredResult.suggestions as string[];
    }
    return [];
  };

  // Try to extract numeric tone scores from the string result for visual bars
  const parseToneScores = (content: string) => {
    // Safety: only call .match on strings
    if (typeof content !== 'string' || !content) return [];

    const toneMap: { label: string; value: number; color: string }[] = [];
    const patterns = [
      { regex: /formal(?:ity)?[:\s]*(\d+)/i, label: 'Formal', color: 'bg-blue-500' },
      { regex: /casual[:\s]*(\d+)/i, label: 'Casual', color: 'bg-green-500' },
      { regex: /confident[:\s]*(\d+)/i, label: 'Confident', color: 'bg-purple-500' },
      { regex: /friendly[:\s]*(\d+)/i, label: 'Friendly', color: 'bg-yellow-500' },
      { regex: /professional[:\s]*(\d+)/i, label: 'Professional', color: 'bg-indigo-500' },
      { regex: /emotional[:\s]*(\d+)/i, label: 'Emotional', color: 'bg-red-500' },
      { regex: /neutral[:\s]*(\d+)/i, label: 'Neutral', color: 'bg-gray-500' },
      { regex: /persuasive[:\s]*(\d+)/i, label: 'Persuasive', color: 'bg-orange-500' },
      { regex: /positive[:\s]*(\d+)/i, label: 'Positive', color: 'bg-emerald-500' },
      { regex: /negative[:\s]*(\d+)/i, label: 'Negative', color: 'bg-rose-500' },
    ];
    patterns.forEach(({ regex, label, color }) => {
      const match = content.match(regex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val >= 0 && val <= 100) {
          toneMap.push({ label, value: val, color });
        }
      }
    });
    return toneMap;
  };

  const toneScores = result ? parseToneScores(result) : [];
  const toneDisplay = buildToneDisplay();
  const emotions = buildEmotions();
  const suggestions = buildSuggestions();

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          <ToolTextArea
            id="tone-text"
            label="Text to Analyze"
            value={text}
            onChange={setText}
            placeholder="Paste your text here to analyze its tone, emotion, and style..."
            rows={8}
            maxLength={10000}
            minLength={50}
          />

          <ToolActions
            onSubmit={handleAnalyze}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!text.trim() || text.trim().split(/\s+/).length < 10}
            submitLabel="Analyze Tone"
            processingLabel="Analyzing..."
          />
        </div>
      </div>

      {/* Tone Score Bars (if detected from string response) */}
      {toneScores.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tone Breakdown</h3>
          <div className="space-y-3">
            {toneScores.map((tone) => (
              <div key={tone.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{tone.label}</span>
                  <span className="text-gray-500 dark:text-gray-400">{tone.value}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className={`${tone.color} h-2.5 rounded-full transition-all duration-500`}
                    style={{ width: `${tone.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Structured Result Display (from JSON response) */}
      {structuredResult && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tone Analysis</h3>
            {processingTime && (
              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                {processingTime.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Primary Tone & Reading Level */}
          {toneDisplay.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {toneDisplay.map((item) => (
                <div key={item.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                    {item.label}
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Emotions */}
          {emotions.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Detected Emotions</p>
              <div className="flex flex-wrap gap-2">
                {emotions.map((emotion, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1 text-sm font-medium text-purple-700 dark:text-purple-300 capitalize"
                  >
                    {emotion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Suggestions</p>
              <ul className="space-y-2">
                {suggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Raw/string result fallback (only if no structured result) */}
      {result && !structuredResult && (
        <ToolOutput
          content={result}
          title="Tone Analysis"
          isMarkdown
          processingTime={processingTime}
          onRegenerate={handleAnalyze}
          isRegenerating={isProcessing}
        />
      )}

      <ToolTips
        tips={[
          'Provide at least 10 words for accurate tone detection',
          'Longer texts give more reliable and nuanced analysis',
          'The analyzer detects formality, emotion, confidence, and more',
          'Great for reviewing emails, essays, or marketing copy before sending',
          'Use the regenerate button for a fresh perspective on the same text',
        ]}
      />
    </div>
  );
};

export default ToneAnalyzerTool;
