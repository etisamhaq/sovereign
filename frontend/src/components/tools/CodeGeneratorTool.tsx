import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  CodeBracketIcon,
  LightBulbIcon,
  PlayIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

interface CodeGeneratorToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const languages = [
  { value: 'python', label: '🐍 Python' },
  { value: 'javascript', label: '🟨 JavaScript' },
  { value: 'typescript', label: '🔷 TypeScript' },
  { value: 'java', label: '☕ Java' },
  { value: 'csharp', label: '🟣 C#' },
  { value: 'cpp', label: '⚡ C++' },
  { value: 'go', label: '🐹 Go' },
  { value: 'rust', label: '🦀 Rust' },
  { value: 'ruby', label: '💎 Ruby' },
  { value: 'php', label: '🐘 PHP' },
  { value: 'swift', label: '🍎 Swift' },
  { value: 'kotlin', label: '🟪 Kotlin' },
  { value: 'sql', label: '🗄️ SQL' },
  { value: 'html_css', label: '🌐 HTML/CSS' },
];

const complexityOptions = [
  { value: 'simple', label: 'Simple' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

interface CodeResult {
  code: string;
  explanation: string;
  language: string;
  time_complexity: string;
  space_complexity: string;
  tests: string;
  usage_example: string;
  dependencies: string[];
  notes: string[];
}

const CodeGeneratorTool: React.FC<CodeGeneratorToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('python');
  const [complexity, setComplexity] = useState('intermediate');
  const [includeComments, setIncludeComments] = useState(true);
  const [includeTests, setIncludeTests] = useState(false);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [activeSection, setActiveSection] = useState<'code' | 'tests' | 'usage'>('code');

  const handleGenerate = async () => {
    if (!description.trim()) return toast.error('Please describe what code you need');

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: CodeResult; processing_time: number }>(
        '/tools/code-generator/',
        {
          description,
          language,
          complexity,
          include_comments: includeComments,
          include_tests: includeTests,
        }
      );
      setResult(response.result);
      setActiveSection('code');
      toast.success(`Code generated in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate code');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <CodeBracketIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            What should the code do?
          </label>
          <textarea
            className="input font-mono"
            rows={4}
            placeholder="e.g. Write a function that finds all prime numbers up to N using the Sieve of Eratosthenes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
          <div className="flex flex-wrap gap-2">
            {languages.map((l) => (
              <button
                key={l.value}
                onClick={() => setLanguage(l.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  language === l.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Complexity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Complexity</label>
            <select className="input" value={complexity} onChange={(e) => setComplexity(e.target.value)}>
              {complexityOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeComments} onChange={(e) => setIncludeComments(e.target.checked)} className="rounded" />
              Include Comments
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} className="rounded" />
              Include Unit Tests
            </label>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={isProcessing} className="btn btn-primary flex items-center gap-2">
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating...</>
          ) : (
            <><CodeBracketIcon className="h-5 w-5" /> Generate Code</>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Explanation */}
          {result.explanation && (
            <div className="card bg-gray-50 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Explanation</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{result.explanation}</p>
            </div>
          )}

          {/* Complexity badges */}
          <div className="flex flex-wrap gap-2">
            {result.time_complexity && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                ⏱ Time: {result.time_complexity}
              </span>
            )}
            {result.space_complexity && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                💾 Space: {result.space_complexity}
              </span>
            )}
            {result.dependencies?.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                📦 Deps: {result.dependencies.join(', ')}
              </span>
            )}
          </div>

          {/* Code tabs */}
          <div className="card">
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
              <button
                onClick={() => setActiveSection('code')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  activeSection === 'code'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <CodeBracketIcon className="h-4 w-4" /> Code
              </button>
              {result.tests && (
                <button
                  onClick={() => setActiveSection('tests')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                    activeSection === 'tests'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  <BeakerIcon className="h-4 w-4" /> Tests
                </button>
              )}
              {result.usage_example && (
                <button
                  onClick={() => setActiveSection('usage')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                    activeSection === 'usage'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  <PlayIcon className="h-4 w-4" /> Usage
                </button>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => copyCode(
                  activeSection === 'code' ? result.code :
                  activeSection === 'tests' ? result.tests : result.usage_example
                )}
                className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors z-10"
                title="Copy"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
              </button>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">
                <code>
                  {activeSection === 'code' && result.code}
                  {activeSection === 'tests' && result.tests}
                  {activeSection === 'usage' && result.usage_example}
                </code>
              </pre>
            </div>
          </div>

          {/* Notes */}
          {result.notes?.length > 0 && (
            <div className="card bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-2">
                <LightBulbIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Notes</h3>
              </div>
              <ul className="space-y-1">
                {result.notes.map((note, i) => (
                  <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300">• {note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeGeneratorTool;
