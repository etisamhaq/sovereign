import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  EnvelopeOpenIcon,
  LightBulbIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

interface CoverLetterWriterProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const tones = [
  { value: 'professional', label: '💼 Professional' },
  { value: 'enthusiastic', label: '🔥 Enthusiastic' },
  { value: 'confident', label: '💪 Confident' },
  { value: 'humble', label: '🙏 Humble' },
  { value: 'creative', label: '🎨 Creative' },
];

interface CoverLetterResult {
  cover_letter: string;
  subject_line: string;
  key_strengths_highlighted: string[];
  customization_tips: string[];
  word_count: number;
}

const CoverLetterWriter: React.FC<CoverLetterWriterProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState('professional');
  const [result, setResult] = useState<CoverLetterResult | null>(null);

  const handleGenerate = async () => {
    if (!jobTitle.trim()) return toast.error('Please enter the job title');
    if (!companyName.trim()) return toast.error('Please enter the company name');
    if (!experience.trim()) return toast.error('Please describe your experience');
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await apiClient.post<{ result: CoverLetterResult; processing_time: number }>(
        '/tools/cover-letter-writer/',
        { job_title: jobTitle, company_name: companyName, experience, skills, job_description: jobDescription, tone }
      );
      setResult(response.result);
      toast.success(`Cover letter generated in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate cover letter');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyCoverLetter = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.cover_letter);
    toast.success('Cover letter copied to clipboard!');
  };

  const copyAll = () => {
    if (!result) return;
    const text = [
      `Subject: ${result.subject_line}`,
      '',
      result.cover_letter,
    ].join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Subject + cover letter copied!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <EnvelopeOpenIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Title *</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Senior Frontend Developer"
              className="input w-full"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name *</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Google"
              className="input w-full"
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Your Experience * <span className="text-gray-400 font-normal">(rough notes are fine)</span>
          </label>
          <textarea
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="Describe your relevant work experience, achievements, and background. The more specific, the better the cover letter will be..."
            className="input w-full h-32 resize-y"
            maxLength={5000}
          />
          <p className="text-xs text-gray-400 mt-1">{experience.length}/5,000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Key Skills <span className="text-gray-400 font-normal">(required)</span>
          </label>
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g., React, TypeScript, Team Leadership, Agile, CI/CD"
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Job Description <span className="text-gray-400 font-normal">(paste for highly tailored results)</span>
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job posting here and the AI will mirror their language and address specific requirements..."
            className="input w-full h-28 resize-y"
            maxLength={5000}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tone</label>
          <div className="flex flex-wrap gap-2">
            {tones.map(t => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  tone === t.value
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isProcessing || !jobTitle.trim() || !companyName.trim() || !experience.trim()}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating Cover Letter...</>
          ) : (
            <><EnvelopeOpenIcon className="h-5 w-5" /> Generate Cover Letter</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Email Subject */}
          {result.subject_line && (
            <div className="card !bg-blue-50 dark:!bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">📧 Email Subject Line</h4>
                  <p className="text-blue-800 dark:text-blue-200 font-medium">{result.subject_line}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(result.subject_line); toast.success('Subject line copied!'); }}
                  className="text-blue-500 hover:text-blue-700 p-1"
                >
                  <ClipboardDocumentIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Cover Letter */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Your Cover Letter</h3>
              <div className="flex gap-2">
                <button onClick={copyCoverLetter} className="btn btn-outline text-xs flex items-center gap-1 px-3 py-1.5">
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy Letter
                </button>
                <button onClick={copyAll} className="btn btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                  <DocumentDuplicateIcon className="h-3.5 w-3.5" /> Copy All
                </button>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed font-serif text-[15px]">
                {result.cover_letter}
              </p>
            </div>
            {result.word_count > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-right">{result.word_count} words</p>
            )}
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.key_strengths_highlighted?.length > 0 && (
              <div className="card !bg-green-50 dark:!bg-green-900/20 border-green-200 dark:border-green-800">
                <h4 className="text-sm font-bold text-green-700 dark:text-green-300 mb-3 flex items-center gap-1.5">
                  <CheckCircleIcon className="h-4 w-4" /> Key Strengths Highlighted
                </h4>
                <ul className="space-y-2">
                  {result.key_strengths_highlighted.map((s, i) => (
                    <li key={i} className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.customization_tips?.length > 0 && (
              <div className="card !bg-amber-50 dark:!bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-3 flex items-center gap-1.5">
                  <LightBulbIcon className="h-4 w-4" /> Customization Tips
                </h4>
                <ul className="space-y-2">
                  {result.customization_tips.map((t, i) => (
                    <li key={i} className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <span className="shrink-0">💡</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverLetterWriter;
