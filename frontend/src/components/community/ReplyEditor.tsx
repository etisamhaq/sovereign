import React, { useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface ReplyEditorProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  parentAuthor?: string;
  isLoading?: boolean;
  onCancel?: () => void;
}

const ReplyEditor: React.FC<ReplyEditorProps> = ({
  onSubmit,
  placeholder = 'Write your reply...',
  parentAuthor,
  isLoading = false,
  onCancel,
}) => {
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content.trim());
      setContent('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {parentAuthor && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Replying to <span className="font-medium text-gray-700 dark:text-gray-300">{parentAuthor}</span>
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!content.trim() || isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          {isLoading ? 'Posting...' : 'Reply'}
        </button>
      </div>
    </form>
  );
};

export default ReplyEditor;
