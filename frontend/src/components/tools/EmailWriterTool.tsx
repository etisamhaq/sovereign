import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';

interface EmailWriterToolProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const emailTypes = [
  { value: 'professional', label: '💼 Professional' },
  { value: 'follow_up', label: '🔄 Follow-up' },
  { value: 'cold_outreach', label: '🎯 Cold Outreach' },
  { value: 'thank_you', label: '🙏 Thank You' },
  { value: 'apology', label: '😔 Apology' },
  { value: 'introduction', label: '👋 Introduction' },
  { value: 'meeting_request', label: '📅 Meeting Request' },
  { value: 'resignation', label: '📝 Resignation' },
  { value: 'complaint', label: '⚠️ Complaint' },
  { value: 'inquiry', label: '❓ Inquiry' },
];

const tones = [
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'assertive', label: 'Assertive' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'neutral', label: 'Neutral' },
];

interface EmailResult {
  subject: string;
  body: string;
  tips: string[];
}

const EmailWriterTool: React.FC<EmailWriterToolProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [emailType, setEmailType] = useState('professional');
  const [recipient, setRecipient] = useState('');
  const [subjectContext, setSubjectContext] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [tone, setTone] = useState('formal');
  const [senderName, setSenderName] = useState('');
  const [result, setResult] = useState<EmailResult | null>(null);

  const handleGenerate = async () => {
    if (!recipient.trim()) return toast.error('Please specify the recipient');
    if (!subjectContext.trim()) return toast.error('Please describe what the email is about');

    setIsProcessing(true);
    try {
      const response = await apiClient.post<{ result: EmailResult; processing_time: number }>(
        '/tools/email-writer/',
        {
          email_type: emailType,
          recipient,
          subject_context: subjectContext,
          key_points: keyPoints,
          tone,
          sender_name: senderName,
        }
      );
      setResult(response.result);
      toast.success(`Email generated in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate email');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = `Subject: ${result.subject}\n\n${result.body}`;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleReset = () => {
    setRecipient('');
    setSubjectContext('');
    setKeyPoints('');
    setSenderName('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <EnvelopeIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        {/* Email Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Type</label>
          <div className="flex flex-wrap gap-2">
            {emailTypes.map((t) => (
              <button
                key={t.value}
                onClick={() => setEmailType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  emailType === t.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Hiring manager, Client, Team lead..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>

        {/* Subject Context */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What is the email about?</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Describe the purpose of this email..."
            value={subjectContext}
            onChange={(e) => setSubjectContext(e.target.value)}
          />
        </div>

        {/* Key Points (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Key Points <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            className="input"
            rows={2}
            placeholder="Any specific points you want to include..."
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tone</label>
            <select className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
              {tones.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Sender Name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="John Doe"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleGenerate} disabled={isProcessing} className="btn btn-primary flex items-center gap-2">
            {isProcessing ? (
              <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating...</>
            ) : (
              <><EnvelopeIcon className="h-5 w-5" /> Generate Email</>
            )}
          </button>
          {result && (
            <button onClick={handleReset} className="btn btn-outline">Reset</button>
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Generated Email</h2>
            <button onClick={copyAll} className="btn btn-outline btn-sm flex items-center gap-1">
              <ClipboardDocumentIcon className="h-4 w-4" /> Copy All
            </button>
          </div>

          {/* Subject */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Subject Line</p>
            <p className="text-gray-900 dark:text-white font-medium">{result.subject}</p>
          </div>

          {/* Body */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <pre className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
              {result.body}
            </pre>
          </div>

          {/* Tips */}
          {result.tips && result.tips.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <LightBulbIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Tips</h3>
              </div>
              <ul className="space-y-1">
                {result.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-blue-700 dark:text-blue-300">• {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailWriterTool;
