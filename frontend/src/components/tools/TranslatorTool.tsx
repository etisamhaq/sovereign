import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { ToolHeader, ToolTextArea, ToolActions, ToolTips } from './ToolInput';
import ToolOutput from './ToolOutput';

interface TranslatorToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const LANGUAGES = [
  { code: 'Spanish', flag: '🇪🇸' },
  { code: 'French', flag: '🇫🇷' },
  { code: 'German', flag: '🇩🇪' },
  { code: 'Italian', flag: '🇮🇹' },
  { code: 'Portuguese', flag: '🇵🇹' },
  { code: 'Chinese', flag: '🇨🇳' },
  { code: 'Japanese', flag: '🇯🇵' },
  { code: 'Korean', flag: '🇰🇷' },
  { code: 'Arabic', flag: '🇸🇦' },
  { code: 'Hindi', flag: '🇮🇳' },
  { code: 'Russian', flag: '🇷🇺' },
  { code: 'Dutch', flag: '🇳🇱' },
  { code: 'Swedish', flag: '🇸🇪' },
  { code: 'Turkish', flag: '🇹🇷' },
  { code: 'Polish', flag: '🇵🇱' },
  { code: 'Vietnamese', flag: '🇻🇳' },
  { code: 'Thai', flag: '🇹🇭' },
  { code: 'Indonesian', flag: '🇮🇩' },
  { code: 'Greek', flag: '🇬🇷' },
  { code: 'Czech', flag: '🇨🇿' },
];

const TranslatorTool: React.FC<TranslatorToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [text, setText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [result, setResult] = useState('');
  const [processingTime, setProcessingTime] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = LANGUAGES.filter(lang =>
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTranslate = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Please enter text to translate');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: string; usage_id: string; processing_time: number }>(
        '/tools/translator/',
        { text, target_language: targetLanguage }
      );
      setResult(response.result || '');
      setProcessingTime(response.processing_time);
      toast.success('Translation completed!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Translation failed');
    } finally {
      setIsProcessing(false);
    }
  }, [text, targetLanguage, setIsProcessing]);

  const handleReset = () => {
    setText('');
    setResult('');
    setProcessingTime(undefined);
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      <ToolHeader name={tool.name} description={tool.description} />

      <div className="card">
        <div className="space-y-4">
          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Language
            </label>
            <input
              type="text"
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2">
              {filteredLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setTargetLanguage(lang.code)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-xs font-medium ${
                    targetLanguage === lang.code
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="truncate w-full text-center">{lang.code}</span>
                </button>
              ))}
            </div>
          </div>

          <ToolTextArea
            id="translator-text"
            label="Text to Translate"
            value={text}
            onChange={setText}
            placeholder="Enter or paste the text you want to translate..."
            rows={6}
            maxLength={10000}
          />

          <ToolActions
            onSubmit={handleTranslate}
            onReset={handleReset}
            isProcessing={isProcessing}
            disabled={!text.trim()}
            submitLabel={`Translate to ${targetLanguage}`}
            processingLabel="Translating..."
          />
        </div>
      </div>

      {result && (
        <ToolOutput
          content={result}
          title={`${targetLanguage} Translation`}
          isMarkdown={false}
          processingTime={processingTime}
          onRegenerate={handleTranslate}
          isRegenerating={isProcessing}
        />
      )}

      <ToolTips
        tips={[
          'For best results, use clear and grammatically correct source text',
          'Short sentences translate more accurately than long, complex ones',
          'Technical or domain-specific terms may need manual review',
          'You can translate up to 10,000 characters at once',
          'Use the regenerate button to get alternative translations',
        ]}
      />
    </div>
  );
};

export default TranslatorTool;
