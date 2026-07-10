import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuthStore } from '../store/authStore';
import {
  SparklesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  LockOpenIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

type ToolId = 'paraphrase' | 'grammar-check' | 'summarizer';

interface ToolConfig {
  id: ToolId;
  name: string;
  description: string;
  endpoint: string;
  placeholder: string;
  resultKey: string;
  color: string;
  icon: string;
  extraFields?: React.ReactNode;
}

const TryToolsPage: React.FC = () => {
  usePageTitle('Try Free AI Tools', 'Try Sovereign AI tools for free — no signup required. Paraphrase, check grammar, and summarize text instantly.');
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ToolId>('paraphrase');
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [grammarResult, setGrammarResult] = useState<{ corrected_text: string; errors: string[]; suggestions: string[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paraphraseMode, setParaphraseMode] = useState('standard');
  const [summaryLength, setSummaryLength] = useState('medium');
  const [copied, setCopied] = useState(false);

  // Redirect logged-in users to the full tools page
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/tools', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const tools: ToolConfig[] = [
    {
      id: 'paraphrase',
      name: 'AI Paraphrase',
      description: 'Rewrite text in different styles while keeping the meaning.',
      endpoint: '/tools/public/paraphrase/',
      placeholder: 'Enter text to paraphrase (min. 10 characters)...',
      resultKey: 'result',
      color: 'primary',
      icon: '✍️',
    },
    {
      id: 'grammar-check',
      name: 'Grammar Check',
      description: 'Fix grammar, spelling, and punctuation errors instantly.',
      endpoint: '/tools/public/grammar-check/',
      placeholder: 'Enter text to check grammar (min. 10 characters)...',
      resultKey: 'result',
      color: 'green',
      icon: '✅',
    },
    {
      id: 'summarizer',
      name: 'Text Summarizer',
      description: 'Condense long text into a concise, clear summary.',
      endpoint: '/tools/public/summarizer/',
      placeholder: 'Enter text to summarize (min. 50 characters)...',
      resultKey: 'result',
      color: 'purple',
      icon: '📝',
    },
  ];

  const currentTool = tools.find((t) => t.id === activeTool)!;

  const handleSubmit = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text first.');
      return;
    }
    const minLen = activeTool === 'summarizer' ? 50 : 10;
    if (inputText.trim().length < minLen) {
      toast.error(`Text must be at least ${minLen} characters.`);
      return;
    }

    setIsProcessing(true);
    setResult('');
    setGrammarResult(null);

    try {
      const body: any = { text: inputText };
      if (activeTool === 'paraphrase') body.mode = paraphraseMode;
      if (activeTool === 'summarizer') body.length = summaryLength;

      const res = await fetch(`${API_URL}${currentTool.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        toast.error('Daily limit reached (5/day). Sign up for 50 free uses per month!');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Something went wrong');
      }

      const data = await res.json();

      // Grammar check returns a structured object { corrected_text, errors, suggestions }
      if (activeTool === 'grammar-check') {
        const r = data.result;
        if (r && typeof r === 'object' && r.corrected_text) {
          setGrammarResult({
            corrected_text: r.corrected_text || inputText,
            errors: Array.isArray(r.errors) ? r.errors : [],
            suggestions: Array.isArray(r.suggestions) ? r.suggestions : [],
          });
        } else {
          // Fallback if result is a string
          setResult(typeof r === 'string' ? r : JSON.stringify(r, null, 2));
        }
      } else {
        setResult(typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const paraphraseModes = [
    { value: 'standard', label: 'Standard' },
    { value: 'formal', label: 'Formal' },
    { value: 'creative', label: 'Creative' },
    { value: 'simple', label: 'Simple' },
  ];

  const summaryLengths = [
    { value: 'short', label: 'Short' },
    { value: 'medium', label: 'Medium' },
    { value: 'long', label: 'Long' },
  ];

  return (
    <div className="bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 min-h-[80vh]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/40 rounded-full mb-4">
            <LockOpenIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              No Sign-Up Required — Try Free Now
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Try Our AI Tools for Free
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Test 3 popular AI tools instantly — no login needed. You get 5 free uses per day.
            <Link to="/register" className="ml-1 text-primary-600 hover:underline font-medium">
              Sign up
            </Link>{' '}
            for 50 free uses per month + 30 more tools.
          </p>
        </motion.div>

        {/* Tool Selector Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                setResult('');
                setGrammarResult(null);
              }}
              className={`px-5 py-3 rounded-xl font-medium transition-all text-sm flex items-center gap-2 ${
                activeTool === tool.id
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <span>{tool.icon}</span>
              {tool.name}
            </button>
          ))}
        </div>

        {/* Tool Card */}
        <motion.div
          key={activeTool}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{currentTool.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {currentTool.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentTool.description}
              </p>
            </div>
          </div>

          {/* Extra fields */}
          {activeTool === 'paraphrase' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mode
              </label>
              <div className="flex flex-wrap gap-2">
                {paraphraseModes.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setParaphraseMode(m.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      paraphraseMode === m.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'summarizer' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Summary Length
              </label>
              <div className="flex flex-wrap gap-2">
                {summaryLengths.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setSummaryLength(l.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      summaryLength === l.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <textarea
            rows={6}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-4 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            placeholder={currentTool.placeholder}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={3000}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{inputText.length}/3,000 characters</span>
            <span>5 free uses per day</span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !inputText.trim()}
            className="mt-4 w-full btn btn-primary py-3 text-base flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5" />
                {activeTool === 'paraphrase'
                  ? 'Paraphrase Text'
                  : activeTool === 'grammar-check'
                  ? 'Check Grammar'
                  : 'Summarize Text'}
              </>
            )}
          </button>

          {/* Result */}
          {(result || grammarResult) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              {/* Grammar check structured result */}
              {grammarResult ? (
                <div className="space-y-4">
                  {/* Corrected Text */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        Corrected Text
                      </h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(grammarResult.corrected_text);
                          setCopied(true);
                          toast.success('Copied to clipboard!');
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                      >
                        <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {grammarResult.corrected_text}
                    </div>
                  </div>

                  {/* Errors Found */}
                  {grammarResult.errors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                        Errors Found ({grammarResult.errors.length})
                      </h3>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                        <ul className="space-y-2">
                          {grammarResult.errors.map((err, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-200 dark:bg-red-800 text-xs font-bold text-red-800 dark:text-red-200 flex-shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {grammarResult.suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                        <LightBulbIcon className="h-4 w-4 text-yellow-500" />
                        Suggestions ({grammarResult.suggestions.length})
                      </h3>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                        <ul className="space-y-2">
                          {grammarResult.suggestions.map((sug, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                              <LightBulbIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              {sug}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* No errors state */}
                  {grammarResult.errors.length === 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 text-center">
                      <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        No grammar errors found! Your text looks great.
                      </p>
                    </div>
                  )}
                </div>
              ) : result ? (
                /* Paraphrase / Summarizer result */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      {activeTool === 'paraphrase' ? 'Paraphrased Text' : 'Summary'}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {result.trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(result);
                          setCopied(true);
                          toast.success('Copied to clipboard!');
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                      >
                        <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed max-h-96 overflow-y-auto">
                    {result}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Want More? Get 50 Free Uses/Month
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Sign up for free and unlock 30+ additional AI tools — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register"
                className="btn btn-primary px-6 py-2.5"
              >
                Sign Up Free
              </Link>
              <Link
                to="/pricing"
                className="btn btn-outline px-6 py-2.5"
              >
                View Pro Plan — $5/mo
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TryToolsPage;
