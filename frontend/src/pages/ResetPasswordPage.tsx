import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { authService } from '../services/auth';
import { usePageTitle } from '../hooks/usePageTitle';

interface ResetPasswordFormData {
  password: string;
  password_confirm: string;
}

const ResetPasswordPage: React.FC = () => {
  usePageTitle('Reset Password');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>();

  const password = watch('password');

  if (!token) {
    return (
      <div className="w-full text-center">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Invalid Reset Link
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link to="/forgot-password" className="btn btn-primary">
          Request New Link
        </Link>
      </div>
    );
  }

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
            Password Reset Successful! 🎉
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link to="/login" className="btn btn-primary">
            Sign In Now
          </Link>
        </motion.div>
      </div>
    );
  }

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await authService.confirmPasswordReset({
        token,
        password: data.password,
        password_confirm: data.password_confirm,
      });
      setIsSuccess(true);
    } catch (err: any) {
      const errData = err.response?.data;
      const msg =
        errData?.token?.[0] ||
        errData?.password?.[0] ||
        errData?.detail ||
        errData?.message ||
        'Failed to reset password. The link may have expired.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-2">
        <LockClosedIcon className="mx-auto h-12 w-12 text-primary-600 mb-4" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
        Set new password
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Enter your new password below. Must be at least 8 characters.
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
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            New Password
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input pr-10"
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              })}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password_confirm"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Confirm New Password
          </label>
          <input
            id="password_confirm"
            type="password"
            className="input mt-1"
            {...register('password_confirm', {
              required: 'Please confirm your password',
              validate: (value) =>
                value === password || 'Passwords do not match',
            })}
          />
          {errors.password_confirm && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password_confirm.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:text-primary-500"
          >
            Back to Sign In
          </Link>
        </p>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
