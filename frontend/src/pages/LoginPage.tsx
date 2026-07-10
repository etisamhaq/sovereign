import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { LoginCredentials } from '../types/auth';
import { authService } from '../services/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { toast } from 'react-hot-toast';
import GoogleSignInButton from '../components/GoogleSignInButton';

const LoginPage: React.FC = () => {
  usePageTitle('Sign In');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [verificationWarning, setVerificationWarning] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  const handleResendVerification = async () => {
    if (!loginEmail) return;
    setIsResending(true);
    try {
      await authService.resendVerificationEmail(loginEmail);
      toast.success('Verification email sent! Check your inbox.');
    } catch {
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (data: LoginCredentials) => {
    try {
      clearError();
      setLoginEmail(data.email);
      const response = await login(data);

      if (response.needs_verification) {
        setVerificationWarning(true);
        // Still navigate — user can use the app, just with a reminder
        navigate(redirectTo);
      } else {
        navigate(redirectTo);
      }
    } catch (error) {
      // Error is handled in the store
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
        Welcome back
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500">
          Sign up for free
        </Link>
      </p>

      {/* Google Sign In */}
      <div className="mt-8">
        <GoogleSignInButton redirectTo={redirectTo} mode="signin" />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white dark:bg-gray-800 px-4 text-gray-500 dark:text-gray-400">
              or sign in with email
            </span>
          </div>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-md bg-red-50 dark:bg-red-900/30 p-4"
          >
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </motion.div>
        )}

        {verificationWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4"
          >
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Email not verified
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  Please verify your email to access all features.{' '}
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="font-medium underline hover:no-underline"
                  >
                    {isResending ? 'Sending...' : 'Resend verification email'}
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pr-10"
                {...register('password', {
                  required: 'Password is required',
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
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="font-medium text-primary-600 hover:text-primary-500">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" className="font-medium text-primary-600 hover:text-primary-500">Privacy Policy</Link>.
        </p>
      </form>
    </div>
  );
};

export default LoginPage;