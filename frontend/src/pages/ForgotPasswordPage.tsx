import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { authService } from '../services/auth';
import { usePageTitle } from '../hooks/usePageTitle';

interface ForgotPasswordFormData {
  email: string;
}

const ForgotPasswordPage: React.FC = () => {
  usePageTitle('Forgot Password');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>();

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await authService.requestPasswordReset(data.email);
      setSubmittedEmail(data.email);
      setIsSuccess(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to send reset email. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Check Your Email
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            If an account exists for
          </p>
          <p className="font-semibold text-gray-900 dark:text-white mb-4">
            {submittedEmail}
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            you'll receive a password reset link. The link will expire in <strong>1 hour</strong>.
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
            <p>💡 Don't see the email? Check your spam folder.</p>
          </div>
          <Link to="/login" className="btn btn-primary">
            Back to Sign In
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center mb-2">
        <EnvelopeIcon className="mx-auto h-12 w-12 text-primary-600 mb-4" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
        Forgot your password?
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-md bg-red-50 dark:bg-red-900/30 p-4"
          >
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </motion.div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input mt-1"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:text-primary-500"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
