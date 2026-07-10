import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import SEOHead from '../../components/SEOHead';

const SERVICE_LABELS: Record<string, string> = {
  automation: 'AI Automation Setup',
  agents: 'Custom AI Agents',
  optimization: 'Workflow Optimization',
};

const RequestSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const serviceType = searchParams.get('type') || '';
  const tier = searchParams.get('tier') || '';

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center">
      <SEOHead title="Request Submitted" description="Your service request has been submitted successfully." />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-lg px-6 py-16 text-center"
      >
        <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Request Submitted!
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          {serviceType
            ? `Your ${SERVICE_LABELS[serviceType] || serviceType} (${tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : ''} package) request has been received.`
            : 'Your service request has been received.'}
        </p>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Our team will review your requirements and get in touch within 24 hours.
          You'll also receive an AI-powered analysis of your request shortly.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/solutions/my-requests"
            className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Track My Requests
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default RequestSuccessPage;
