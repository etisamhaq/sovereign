import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { authService } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { toast } from 'react-hot-toast';

const VerifyEmailPage: React.FC = () => {
  usePageTitle('Verify Email');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { setUser, user } = useAuthStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    const verify = async () => {
      try {
        const response = await authService.verifyEmail(token);
        setStatus('success');
        setMessage(response?.message || 'Email verified successfully!');

        // Update user state with verified user data
        if (response.user) {
          setUser(response.user);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.token?.[0] ||
            err.response?.data?.detail ||
            'Verification failed. The link may be invalid or expired.'
        );
      }
    };

    verify();
  }, [token, setUser]);

  const handleResendEmail = async () => {
    const email = user?.email;
    if (!email) {
      toast.error('Please log in first to resend verification email.');
      return;
    }
    setIsResending(true);
    try {
      await authService.resendVerificationEmail(email);
      toast.success('Verification email sent! Check your inbox.');
    } catch {
      toast.error('Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {status === 'loading' && (
          <>
            <ArrowPathIcon className="mx-auto h-16 w-16 text-primary-500 animate-spin mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Verifying your email...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait a moment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Email Verified! 🎉
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your account is now fully activated. Enjoy all of Sovereign's features!
            </p>
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Verification Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                {isResending ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <EnvelopeIcon className="h-4 w-4" />
                    Send new verification email
                  </>
                )}
              </button>
              <Link to="/login" className="text-sm text-primary-600 hover:text-primary-500 font-medium">
                Back to Sign In
              </Link>
            </div>
          </>
        )}

        {status === 'no-token' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Missing Verification Token
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              No verification token was found. Please check your email for the
              verification link, or request a new one.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                {isResending ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <EnvelopeIcon className="h-4 w-4" />
                    Resend verification email
                  </>
                )}
              </button>
              <Link to="/login" className="text-sm text-primary-600 hover:text-primary-500 font-medium">
                Back to Sign In
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyEmailPage;
