import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  DocumentTextIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  CalendarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

interface SharedResultData {
  title: string;
  tool_name: string;
  content: string;
  view_count: number;
  created_at: string;
}

const SharedResultPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [data, setData] = useState<SharedResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageTitle(
    data ? `${data.title} — Shared Result` : 'Shared Result',
    data ? `AI-generated content created with Sovereign ${data.tool_name}. View and copy the result.` : 'View shared AI-generated content from Sovereign.'
  );

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`${API_URL}/tools/shared/${shareId}/`);
        if (res.status === 404) {
          setError('This shared result was not found or has been removed.');
          return;
        }
        if (!res.ok) throw new Error('Failed to load shared result.');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    };
    if (shareId) fetchResult();
  }, [shareId]);

  const copyContent = () => {
    if (data?.content) {
      navigator.clipboard.writeText(data.content);
      toast.success('Content copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <DocumentTextIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <Link to="/" className="btn btn-primary px-6 py-2">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formattedDate = new Date(data.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 min-h-[80vh]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              <SparklesIcon className="h-3.5 w-3.5" />
              {data.tool_name}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {data.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-8">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <EyeIcon className="h-4 w-4" />
              {data.view_count} view{data.view_count !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Generated Content
              </h2>
              <button
                onClick={copyContent}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy
              </button>
            </div>
            <div className="prose prose-lg dark:prose-invert max-w-none whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
              {data.content}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Created with Sovereign AI — try it free, no signup required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/try-tools" className="btn btn-primary px-6 py-2.5">
                Try Free Tools
              </Link>
              <Link to="/register" className="btn btn-outline px-6 py-2.5">
                Sign Up Free
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SharedResultPage;
