import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  ClockIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface ToolUsageRecord {
  id: string;
  tool: string;
  tool_name: string;
  input_data: Record<string, any>;
  output_data: any;
  processing_time: number;
  tokens_used: number;
  error_message: string;
  created_at: string;
}

interface ToolUsageResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ToolUsageRecord[];
}

const HistoryPage: React.FC = () => {
  usePageTitle('Content Library');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<ToolUsageResponse>({
    queryKey: ['usage-history', page],
    queryFn: async () => {
      return apiClient.get(`/tools/usage-history/?page=${page}`);
    },
  });

  const records = Array.isArray(data) ? data : (data?.results || []);
  const hasNext = !Array.isArray(data) && data?.next;
  const hasPrev = page > 1;

  // Get unique tool names for filter
  const toolNames = Array.from(new Set(records.map((r) => r.tool_name))).sort();

  // Filter records
  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      !searchQuery ||
      record.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(record.input_data).toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(record.output_data).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTool = selectedTool === 'all' || record.tool_name === selectedTool;
    return matchesSearch && matchesTool && !record.error_message;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyOutput = (record: ToolUsageRecord) => {
    const output = record.output_data;
    if (!output) return;

    // Extract main text content from output
    let text = '';
    if (typeof output === 'string') {
      text = output;
    } else if (output.result && typeof output.result === 'string') {
      text = output.result;
    } else if (output.paraphrased_text) {
      text = output.paraphrased_text;
    } else if (output.essay) {
      text = output.essay;
    } else if (output.summary) {
      text = output.summary;
    } else if (output.corrected_text) {
      text = output.corrected_text;
    } else if (output.improved_text) {
      text = output.improved_text;
    } else if (output.translated_text) {
      text = output.translated_text;
    } else if (output.body) {
      text = `Subject: ${output.subject || ''}\n\n${output.body}`;
    } else if (output.code) {
      text = output.code;
    } else {
      text = JSON.stringify(output, null, 2);
    }

    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleExport = async (record: ToolUsageRecord, format: 'pdf' | 'docx' | 'markdown') => {
    const output = record.output_data;
    if (!output) return;

    // Build content for export
    let content = '';
    const sections: Array<{ heading: string; body: string }> = [];

    if (typeof output === 'string') {
      content = output;
    } else if (output.result && typeof output.result === 'string') {
      content = output.result;
    } else {
      // Build sections from output keys
      for (const [key, value] of Object.entries(output)) {
        if (typeof value === 'string' && value.length > 0) {
          sections.push({
            heading: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            body: value,
          });
        } else if (Array.isArray(value)) {
          sections.push({
            heading: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            body: value.map((v) => (typeof v === 'string' ? `• ${v}` : JSON.stringify(v))).join('\n'),
          });
        }
      }
    }

    try {
      const response = await apiClient.post('/tools/export/', {
        format,
        title: `${record.tool_name} — ${new Date(record.created_at).toLocaleDateString()}`,
        content,
        sections,
      }, { responseType: 'blob' });
      const blob = response instanceof Blob ? response : new Blob([JSON.stringify(response)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'markdown' ? 'md' : format;
      a.download = `${record.tool_name.replace(/\s+/g, '_')}_${new Date(record.created_at).toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}!`);
    } catch {
      toast.error('Failed to export');
    }
  };

  const getInputPreview = (record: ToolUsageRecord): string => {
    const input = record.input_data;
    if (!input) return '';
    // Get the most meaningful input field
    return (
      input.text?.slice(0, 100) ||
      input.topic?.slice(0, 100) ||
      input.content?.slice(0, 100) ||
      input.subject_context?.slice(0, 100) ||
      input.description?.slice(0, 100) ||
      input.business_description?.slice(0, 100) ||
      input.question?.slice(0, 100) ||
      input.url ||
      ''
    );
  };

  const getOutputPreview = (record: ToolUsageRecord): string => {
    const output = record.output_data;
    if (!output) return 'No output';
    if (typeof output === 'string') return output.slice(0, 150);
    // Get main text from common output patterns
    const text =
      output.result ||
      output.paraphrased_text ||
      output.essay ||
      output.summary ||
      output.corrected_text ||
      output.improved_text ||
      output.translated_text ||
      output.body ||
      output.code ||
      output.answer ||
      '';
    if (typeof text === 'string') return text.slice(0, 150);
    return JSON.stringify(output).slice(0, 150);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ClockIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Content Library</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Browse, copy, and export your past tool outputs. Everything you've generated is saved here.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="search"
            className="input pl-10"
            placeholder="Search your content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search content history"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <div className="sm:w-64">
          <select
            className="input"
            value={selectedTool}
            onChange={(e) => setSelectedTool(e.target.value)}
            aria-label="Filter by tool"
          >
            <option value="all">All Tools</option>
            {toolNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Records */}
      {error ? (
        <div className="text-center py-12">
          <p className="text-red-500 dark:text-red-400">Failed to load history. Please try again.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-16">
          <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No content yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || selectedTool !== 'all'
              ? 'No results match your filters.'
              : 'Start using tools to build your content library.'}
          </p>
          <Link to="/tools" className="btn btn-primary">
            Explore Tools
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <motion.div
              key={record.id}
              layout
              className="card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => toggleExpand(record.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{record.tool_name}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(record.created_at)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {record.processing_time?.toFixed(1)}s
                    </span>
                  </div>

                  {/* Input preview */}
                  {getInputPreview(record) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">
                      <span className="font-medium">Input:</span> {getInputPreview(record)}
                    </p>
                  )}

                  {/* Output preview (collapsed) */}
                  {expandedId !== record.id && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {getOutputPreview(record)}
                      {getOutputPreview(record).length >= 150 && '...'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => copyOutput(record)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                    title="Copy output"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleExport(record, 'markdown')}
                    className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                    title="Export as Markdown"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => toggleExpand(record.id)} className="p-1.5 text-gray-400">
                    {expandedId === record.id ? (
                      <ChevronUpIcon className="h-4 w-4" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded view */}
              <AnimatePresence>
                {expandedId === record.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                      {/* Input */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Input</h4>
                        <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                          {JSON.stringify(record.input_data, null, 2)}
                        </pre>
                      </div>

                      {/* Output */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Output</h4>
                        <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {typeof record.output_data === 'string'
                            ? record.output_data
                            : JSON.stringify(record.output_data, null, 2)}
                        </pre>
                      </div>

                      {/* Export buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleExport(record, 'pdf')}
                          className="btn btn-outline btn-sm flex items-center gap-1"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF
                        </button>
                        <button
                          onClick={() => handleExport(record, 'docx')}
                          className="btn btn-outline btn-sm flex items-center gap-1"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" /> DOCX
                        </button>
                        <button
                          onClick={() => handleExport(record, 'markdown')}
                          className="btn btn-outline btn-sm flex items-center gap-1"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Markdown
                        </button>
                        <button onClick={() => copyOutput(record)} className="btn btn-outline btn-sm flex items-center gap-1">
                          <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasNext || hasPrev) && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasPrev}
            className="btn btn-outline btn-sm"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="btn btn-outline btn-sm"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
