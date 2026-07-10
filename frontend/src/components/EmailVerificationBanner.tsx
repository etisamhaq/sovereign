import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { toast } from 'react-hot-toast';

const EmailVerificationBanner: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Don't show if not authenticated, already verified, or dismissed
  if (!isAuthenticated || !user || user.is_verified || isDismissed) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      await authService.resendVerificationEmail(user.email);
      toast.success('Verification email sent! Check your inbox.');
    } catch {
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300 truncate">
                <span className="font-medium">Verify your email</span>
                <span className="hidden sm:inline"> to unlock all features.</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleResend}
                disabled={isResending}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors disabled:opacity-50"
              >
                {isResending ? (
                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <EnvelopeIcon className="h-3.5 w-3.5" />
                )}
                {isResending ? 'Sending...' : 'Resend'}
              </button>

              <button
                onClick={() => setIsDismissed(true)}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 transition-colors"
                aria-label="Dismiss"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmailVerificationBanner;
