import React, { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';

/* ─────────────── TextArea with live stats ─────────────── */

interface ToolTextAreaProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  minLength?: number;
  /** Show a "Paste from clipboard" button */
  showPaste?: boolean;
  /** Show word count in addition to char count */
  showWordCount?: boolean;
  disabled?: boolean;
  /** Extra hint text below the counter */
  hint?: string;
}

export const ToolTextArea: React.FC<ToolTextAreaProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'Enter your text here...',
  rows = 6,
  maxLength = 5000,
  minLength,
  showPaste = true,
  showWordCount = true,
  disabled = false,
  hint,
}) => {
  const wordCount = value ? value.trim().split(/\s+/).filter(Boolean).length : 0;

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text.slice(0, maxLength));
        toast.success('Pasted from clipboard!');
      }
    } catch {
      toast.error('Unable to read clipboard');
    }
  }, [onChange, maxLength]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {showPaste && (
          <button
            type="button"
            onClick={handlePaste}
            className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
            Paste
          </button>
        )}
      </div>
      <textarea
        id={id}
        rows={rows}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        disabled={disabled}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {hint ||
            (minLength && value.length < minLength
              ? `Minimum ${minLength} characters required`
              : '')}
        </span>
        <span className="flex items-center gap-3">
          {showWordCount && <span>{wordCount} words</span>}
          <span>
            {value.length}/{maxLength.toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
};

/* ─────────────── Option selector (pill buttons) ─────────────── */

interface OptionItem {
  value: string;
  label: string;
  description?: string;
  icon?: string; // emoji
}

interface ToolOptionSelectorProps {
  label: string;
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
  columns?: number; // grid columns on md+
}

export const ToolOptionSelector: React.FC<ToolOptionSelectorProps> = ({
  label,
  options,
  value,
  onChange,
  columns = 3,
}) => {
  const gridCols =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
      ? 'sm:grid-cols-4'
      : columns === 5
      ? 'sm:grid-cols-5'
      : columns === 6
      ? 'sm:grid-cols-6'
      : 'sm:grid-cols-3';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className={`grid grid-cols-2 ${gridCols} gap-2`}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              value === opt.value
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {opt.icon && <span className="mr-1.5">{opt.icon}</span>}
            {opt.label}
            {opt.description && (
              <span className="block text-xs mt-0.5 opacity-75">{opt.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── Tool header (name + description) ─────────────── */

interface ToolHeaderProps {
  name: string;
  description: string;
}

export const ToolHeader: React.FC<ToolHeaderProps> = ({ name, description }) => (
  <div className="card">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{name}</h1>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

/* ─────────────── Submit + Reset button row ─────────────── */

interface ToolActionsProps {
  onSubmit: () => void;
  onReset: () => void;
  isProcessing: boolean;
  disabled?: boolean;
  submitLabel?: string;
  processingLabel?: string;
}

export const ToolActions: React.FC<ToolActionsProps> = ({
  onSubmit,
  onReset,
  isProcessing,
  disabled = false,
  submitLabel = 'Generate',
  processingLabel = 'Processing...',
}) => (
  <div className="flex gap-2">
    <button
      onClick={onSubmit}
      disabled={isProcessing || disabled}
      className="btn btn-primary flex-1"
    >
      {isProcessing ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {processingLabel}
        </>
      ) : (
        submitLabel
      )}
    </button>
    <button onClick={onReset} className="btn btn-secondary" type="button">
      Reset
    </button>
  </div>
);

/* ─────────────── Tips card ─────────────── */

interface ToolTipsProps {
  title?: string;
  tips: string[];
}

export const ToolTips: React.FC<ToolTipsProps> = ({ title = 'Tips for Better Results', tips }) => (
  <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">{title}</h3>
    <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
      {tips.map((tip, i) => (
        <li key={i}>{tip}</li>
      ))}
    </ul>
  </div>
);
