import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TagIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

interface DocumentAnalyzerProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const analysisTypes = [
  { value: 'comprehensive', label: '🔬 Comprehensive', desc: 'Full analysis with everything' },
  { value: 'summary', label: '📝 Summary Only', desc: 'Quick summary & key findings' },
  { value: 'qa', label: '❓ Q&A', desc: 'Ask questions about the text' },
  { value: 'entities', label: '🏷️ Entity Extraction', desc: 'People, orgs, dates, places' },
  { value: 'action_items', label: '✅ Action Items', desc: 'Extract tasks & next steps' },
];

interface AnalysisResult {
  summary: string;
  key_findings: { finding: string; evidence: string }[];
  themes: string[];
  entities: { people: string[]; organizations: string[]; dates: string[]; locations: string[] };
  statistics: { word_count: number; sentence_count: number; reading_level: string; estimated_read_time: string };
  action_items: { action: string; priority: string }[];
  sentiment: string;
  qa_answers: { question: string; answer: string }[];
}

const DocumentAnalyzer: React.FC<DocumentAnalyzerProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [text, setText] = useState('');
  const [analysisType, setAnalysisType] = useState('comprehensive');
  const [questions, setQuestions] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'key_findings']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (!text.trim()) return toast.error('Please paste your document text');
    if (text.trim().length < 50) return toast.error('Please provide at least 50 characters of text');
    if (analysisType === 'qa' && !questions.trim()) return toast.error('Please enter at least one question for Q&A mode');
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await apiClient.post<{ result: AnalysisResult; processing_time: number }>(
        '/tools/document-analyzer/',
        { text, analysis_type: analysisType, questions: questions || undefined }
      );
      setResult(response.result);
      setExpandedSections(new Set(['summary', 'key_findings', 'qa']));
      toast.success(`Analysis complete in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to analyze document');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyResult = () => {
    if (!result) return;
    const parts = [
      result.summary ? `SUMMARY\n${result.summary}` : '',
      result.key_findings?.length ? `\nKEY FINDINGS\n${result.key_findings.map((f, i) => `${i + 1}. ${f.finding}\n   Evidence: ${f.evidence}`).join('\n')}` : '',
      result.themes?.length ? `\nTHEMES: ${result.themes.join(', ')}` : '',
      result.action_items?.length ? `\nACTION ITEMS\n${result.action_items.map(a => `• [${a.priority}] ${a.action}`).join('\n')}` : '',
      result.qa_answers?.length ? `\nQ&A\n${result.qa_answers.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(parts);
    toast.success('Analysis copied to clipboard!');
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const priorityColor = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'high': return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
      case 'medium': return 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30';
      default: return 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30';
    }
  };

  const SectionHeader: React.FC<{ id: string; title: string; count?: number; icon: React.ReactNode }> = ({ id, title, count, icon }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
    >
      <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
        {icon} {title} {count !== undefined && <span className="text-gray-400 font-normal text-xs">({count})</span>}
      </span>
      {expandedSections.has(id) ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <DocumentMagnifyingGlassIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Paste Your Document Text *</label>
            <span className={`text-xs font-medium ${wordCount > 0 ? 'text-gray-500' : 'text-gray-400'}`}>
              {wordCount.toLocaleString()} words
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your document, article, report, contract, research paper, or any text you want to analyze..."
            className="input w-full h-52 resize-y font-mono text-sm"
            maxLength={50000}
          />
          <p className="text-xs text-gray-400 mt-1">{text.length.toLocaleString()}/50,000 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Analysis Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {analysisTypes.map(at => (
              <button
                key={at.value}
                onClick={() => setAnalysisType(at.value)}
                className={`p-3 rounded-lg border text-left transition ${
                  analysisType === at.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <p className="font-medium text-sm text-gray-900 dark:text-white">{at.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{at.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {(analysisType === 'qa' || analysisType === 'comprehensive') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Questions {analysisType === 'qa' ? '*' : <span className="text-gray-400 font-normal">(optional)</span>}
            </label>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder={"Enter questions about the text, one per line:\nWhat is the main argument?\nWho are the key stakeholders?\nWhat risks are mentioned?"}
              className="input w-full h-24 resize-none"
            />
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isProcessing || !text.trim() || text.trim().length < 50}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Analyzing Document...</>
          ) : (
            <><DocumentMagnifyingGlassIcon className="h-5 w-5" /> Analyze Document</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Stats & Copy */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">📊 Analysis Results</h3>
              <button onClick={copyResult} className="btn btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy All
              </button>
            </div>

            {/* Statistics Bar */}
            {result.statistics && (
              <div className="flex flex-wrap gap-2">
                {result.statistics.word_count > 0 && (
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium">
                    📝 {result.statistics.word_count.toLocaleString()} words
                  </span>
                )}
                {result.statistics.reading_level && (
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium">
                    📊 {result.statistics.reading_level}
                  </span>
                )}
                {result.statistics.estimated_read_time && (
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium">
                    ⏱️ {result.statistics.estimated_read_time}
                  </span>
                )}
                {result.sentiment && (
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium">
                    💬 {result.sentiment}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="card !p-0 overflow-hidden">
              <SectionHeader id="summary" title="Summary" icon="📋" />
              {expandedSections.has('summary') && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-700">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{result.summary}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Key Findings */}
          {result.key_findings?.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <SectionHeader id="key_findings" title="Key Findings" count={result.key_findings.length} icon="🔍" />
              {expandedSections.has('key_findings') && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-700 space-y-3">
                  {result.key_findings.map((f, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{f.finding}</p>
                      {f.evidence && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                          "{f.evidence}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Themes */}
          {result.themes?.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <SectionHeader id="themes" title="Themes" count={result.themes.length} icon={<TagIcon className="h-4 w-4" />} />
              {expandedSections.has('themes') && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {result.themes.map((t, i) => (
                      <span key={i} className="px-3 py-1.5 text-sm bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full font-medium border border-primary-200 dark:border-primary-800">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Entities */}
          {result.entities && Object.values(result.entities).some(arr => arr?.length > 0) && (
            <div className="card !p-0 overflow-hidden">
              <SectionHeader id="entities" title="Entities" icon="🏷️" />
              {expandedSections.has('entities') && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.entities.people?.length > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                        <p className="text-xs font-bold text-orange-700 dark:text-orange-300 mb-1.5">👤 People</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{result.entities.people.join(', ')}</p>
                      </div>
                    )}
                    {result.entities.organizations?.length > 0 && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <p className="text-xs font-bold text-green-700 dark:text-green-300 mb-1.5">🏢 Organizations</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{result.entities.organizations.join(', ')}</p>
                      </div>
                    )}
                    {result.entities.dates?.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1.5">📅 Dates</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{result.entities.dates.join(', ')}</p>
                      </div>
                    )}
                    {result.entities.locations?.length > 0 && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-1.5">📍 Locations</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{result.entities.locations.join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Items */}
          {result.action_items?.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <SectionHeader id="action_items" title="Action Items" count={result.action_items.length} icon={<CheckCircleIcon className="h-4 w-4" />} />
              {expandedSections.has('action_items') && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  {result.action_items.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${priorityColor(a.priority)}`}>
                        {a.priority?.toUpperCase()}
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{a.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Q&A Answers */}
          {result.qa_answers?.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <SectionHeader id="qa" title="Q&A Answers" count={result.qa_answers.length} icon={<QuestionMarkCircleIcon className="h-4 w-4" />} />
              {expandedSections.has('qa') && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-700 space-y-4">
                  {result.qa_answers.map((qa, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">❓</span> {qa.question}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed pl-6">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentAnalyzer;
