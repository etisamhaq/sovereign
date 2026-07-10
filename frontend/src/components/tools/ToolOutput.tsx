import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../../services/api';

interface ToolOutputProps {
  /** The output content string */
  content: string;
  /** Label shown above the output (e.g. "Generated Essay", "Paraphrased Text") */
  title?: string;
  /** If true, render content as Markdown (tables, lists, bold, code). Default: false for plain text. */
  isMarkdown?: boolean;
  /** Show word & character count badges */
  showStats?: boolean;
  /** Callback to re-submit the same input for a fresh result */
  onRegenerate?: () => void;
  /** Whether a regeneration is in progress */
  isRegenerating?: boolean;
  /** Show download dropdown (MD / PDF / DOCX via backend export) */
  showDownload?: boolean;
  /** Custom className for the content container */
  className?: string;
  /** Optional processing time to display */
  processingTime?: number;
  /** Children rendered inside the output card (for custom layouts like quiz results) */
  children?: React.ReactNode;
}

const ToolOutput: React.FC<ToolOutputProps> = ({
  content,
  title = 'Result',
  isMarkdown = false,
  showStats = true,
  onRegenerate,
  isRegenerating = false,
  showDownload = true,
  className = '',
  processingTime,
  children,
}) => {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const wordCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = content ? content.length : 0;

  const shareResult = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied!');
      return;
    }
    setIsSharing(true);
    try {
      const data = await apiClient.post<{ share_url: string; share_id: string }>('/tools/share/', {
        title: title || 'Sovereign Result',
        tool_name: title || 'AI Tool',
        content,
      });
      const url = `${window.location.origin}/shared/${data.share_id}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
    } catch {
      toast.error('Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleExport = async (format: 'markdown' | 'pdf' | 'docx') => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const response = await apiClient.post<Blob>(
        '/tools/export/',
        {
          content,
          title: title || 'Sovereign Export',
          format,
        },
        { responseType: 'blob' as any }
      );

      const ext = format === 'markdown' ? 'md' : format;
      const blob = new Blob([response as any], {
        type:
          format === 'pdf'
            ? 'application/pdf'
            : format === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'text/markdown',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title || 'sovereign-export').replace(/\s+/g, '-').toLowerCase()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded as ${format.toUpperCase()}`);
    } catch {
      // Fallback: download as plain text
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title || 'sovereign-export').replace(/\s+/g, '-').toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Downloaded as TXT');
    } finally {
      setIsExporting(false);
    }
  };

  if (!content && !children) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-3"
    >
      {/* Header: title + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          {showStats && content && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                {wordCount} words
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                {charCount} chars
              </span>
              {processingTime && (
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  {processingTime.toFixed(1)}s
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Copy */}
          <button
            onClick={copyToClipboard}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="h-4 w-4 text-green-500" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          {/* Share */}
          <button
            onClick={shareResult}
            disabled={isSharing}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Share result via public link"
          >
            <ShareIcon className={`h-4 w-4 ${isSharing ? 'animate-spin' : ''}`} />
            {shareUrl ? 'Link Copied' : 'Share'}
          </button>

          {/* Download */}
          {showDownload && content && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Download"
              >
                {isExporting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownTrayIcon className="h-4 w-4" />
                )}
                Export
                <ChevronDownIcon className="h-3 w-3" />
              </button>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-900/5 dark:ring-gray-700 py-1">
                    <button
                      onClick={() => handleExport('markdown')}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <DocumentTextIcon className="h-4 w-4" />
                      Markdown (.md)
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <DocumentTextIcon className="h-4 w-4" />
                      PDF (.pdf)
                    </button>
                    <button
                      onClick={() => handleExport('docx')}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <DocumentTextIcon className="h-4 w-4" />
                      Word (.docx)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Regenerate */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              title="Regenerate"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`}
              />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 max-h-[600px] overflow-y-auto ${className}`}
      >
        {children ? (
          children
        ) : isMarkdown ? (
          <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default ToolOutput;
