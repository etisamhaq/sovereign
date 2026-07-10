import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../../services/api';

interface ToolUsageEntry {
  id: string;
  tool: string;
  tool_name: string;
  input_data: Record<string, any>;
  output_data: Record<string, any> | null;
  processing_time: number | null;
  tokens_used: number;
  error_message: string;
  created_at: string;
}

interface ToolHistoryProps {
  toolId: string;
  toolSlug: string;
  onLoadResult?: (input: Record<string, any>, output: Record<string, any>) => void;
}

const ToolHistory: React.FC<ToolHistoryProps> = ({ toolId, toolSlug, onLoadResult }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const { data: history, isLoading, refetch } = useQuery<ToolUsageEntry[]>({
    queryKey: ['tool-history', toolId],
    queryFn: async () => {
      const response = await apiClient.get<any>(`/tools/usage-history/?tool_id=${toolId}`);
      // Handle paginated or array response
      const results = Array.isArray(response) ? response : (response as any)?.results || [];
      return results.slice(0, 10); // Show last 10
    },
    enabled: isExpanded,
    staleTime: 30000, // 30 seconds
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInputPreview = (input: Record<string, any>): string => {
    // Try common field names for a preview
    const text = input.text || input.content || input.topic || input.prompt || input.title || input.query || '';
    if (typeof text === 'string') {
      return text.length > 80 ? text.substring(0, 80) + '…' : text;
    }
    return JSON.stringify(input).substring(0, 80) + '…';
  };

  const getOutputPreview = (output: Record<string, any> | null): string => {
    if (!output) return 'No output';
    const text = output.result || output.content || output.output || output.paraphrased_text
      || output.corrected_text || output.essay || output.summary || output.translation || '';
    if (typeof text === 'string') {
      return text.length > 120 ? text.substring(0, 120) + '…' : text;
    }
    return JSON.stringify(output).substring(0, 120) + '…';
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50
                   border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100
                   dark:hover:bg-gray-800 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Recent History
          </span>
          {history && history.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                           bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
              {history.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                refetch();
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh history"
            >
              <ArrowPathIcon className="h-4 w-4 text-gray-400" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUpIcon className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Loading history…</span>
                </div>
              ) : !history || history.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <DocumentTextIcon className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No history yet. Use this tool to see your results here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-96 overflow-y-auto">
                  {history.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group/entry"
                    >
                      <button
                        onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                              {getInputPreview(entry.input_data)}
                            </p>
                            {!entry.error_message && entry.output_data && expandedEntry !== entry.id && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                                → {getOutputPreview(entry.output_data)}
                              </p>
                            )}
                            {entry.error_message && (
                              <p className="text-xs text-red-500 dark:text-red-400 truncate mt-1">
                                ⚠ Error: {entry.error_message.substring(0, 60)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {entry.processing_time && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {entry.processing_time.toFixed(1)}s
                              </span>
                            )}
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {formatDate(entry.created_at)}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail view */}
                      <AnimatePresence>
                        {expandedEntry === entry.id && entry.output_data && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3">
                              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs">
                                <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">Input:</p>
                                <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                                  {getInputPreview(entry.input_data)}
                                </p>
                                <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">Output:</p>
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                                  {getOutputPreview(entry.output_data)}
                                </p>
                              </div>
                              {onLoadResult && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLoadResult(entry.input_data, entry.output_data!);
                                  }}
                                  className="mt-2 w-full text-xs text-center py-1.5 px-3 rounded-lg
                                           bg-indigo-50 text-indigo-700 hover:bg-indigo-100
                                           dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40
                                           transition-colors font-medium"
                                >
                                  Load this result
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToolHistory;
