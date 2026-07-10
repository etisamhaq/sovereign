import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  GiftIcon,
  EnvelopeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { RegisterData } from '../types/auth';
import { authService } from '../services/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { toast } from 'react-hot-toast';
import GoogleSignInButton from '../components/GoogleSignInButton';

const RegisterPage: React.FC = () => {
  usePageTitle('Create Account');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register: registerUser, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  // Read referral code from URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase());
      authService.validateReferralCode(ref).then((res: any) => {
        if (res.valid) {
          setReferrerName(res.referrer_name);
        }
      }).catch(() => {});
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterData) => {
    try {
      if (referralCode) {
        data.referral_code = referralCode;
      }
      const response = await registerUser(data);
      setRegisteredEmail(data.email);

      if (response.needs_verification) {
        // Show the "check your email" screen
        setShowVerification(true);
      } else {
        toast.success('Account created successfully! Please sign in.');
        navigate(redirectTo !== '/dashboard' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login');
      }
    } catch (error) {
      // Error is handled in the store
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await authService.resendVerificationEmail(registeredEmail);
      toast.success('Verification email sent! Check your inbox.');
    } catch (err: any) {
      toast.error('Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // ── Verification screen after registration ──
  if (showVerification) {
    return (
      <div className="w-full text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            <EnvelopeIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Check your email
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-2">
            We've sent a verification link to
          </p>
          <p className="font-semibold text-gray-900 dark:text-white mb-6">
            {registeredEmail}
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">What to do next:</h3>
            <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
              <li>Open your email inbox</li>
              <li>Look for an email from Sovereign</li>
              <li>Click the "Verify Email Address" button</li>
              <li>You'll be redirected back — all set!</li>
            </ol>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Didn't receive the email? Check your spam folder or
          </p>

          <button
            onClick={handleResendEmail}
            disabled={isResending}
            className="btn btn-outline inline-flex items-center gap-2 mb-4"
          >
            {isResending ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-4 w-4" />
                Resend verification email
              </>
            )}
          </button>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already verified?{' '}
              <button
                onClick={() => navigate(redirectTo !== '/dashboard' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login')}
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Go to Sign In
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
        Create your account
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{' '}
        <Link to={redirectTo !== '/dashboard' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'} className="font-medium text-primary-600 hover:text-primary-500">
          Sign in
        </Link>
      </p>

      {/* Google Sign Up */}
      <div className="mt-8">
        <GoogleSignInButton redirectTo={redirectTo} mode="signup" />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white dark:bg-gray-800 px-4 text-gray-500 dark:text-gray-400">
              or register with email
            </span>
          </div>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {referrerName && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/30 p-3 border border-green-200 dark:border-green-800"
          >
            <GiftIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              <span className="font-semibold">Referred by {referrerName}!</span>{' '}
              You'll both earn bonus coins and extra tool uses.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-md bg-red-50 dark:bg-red-900/30 p-4"
          >
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </motion.div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                First name
              </label>
              <input
                id="first_name"
                type="text"
                autoComplete="given-name"
                className="input mt-1"
                {...register('first_name')}
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Last name
              </label>
              <input
                id="last_name"
                type="text"
                autoComplete="family-name"
                className="input mt-1"
                {...register('last_name')}
              />
            </div>
          </div>

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
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="input mt-1"
              {...register('username', {
                required: 'Username is required',
                minLength: {
                  value: 3,
                  message: 'Username must be at least 3 characters',
                },
              })}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Password must be at least 8 characters and not too common
            </p>
          </div>

          <div>
            <label htmlFor="password_confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm password
            </label>
            <div className="relative mt-1">
              <input
                id="password_confirm"
                type={showPasswordConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                className="input pr-10"
                {...register('password_confirm', {
                  required: 'Please confirm your password',
                  validate: value => value === password || 'Passwords do not match',
                })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
              >
                {showPasswordConfirm ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            {errors.password_confirm && (
              <p className="mt-1 text-sm text-red-600">{errors.password_confirm.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="agree-terms"
            name="agree-terms"
            type="checkbox"
            required
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="agree-terms" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
            I agree to the{' '}
            <Link to="/terms" className="font-medium text-primary-600 hover:text-primary-500">
              Terms and Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-primary-600 hover:text-primary-500">
              Privacy Policy
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full"
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          By signing up, you'll get access to 50 free uses per month.
          Upgrade to Pro for more.
        </div>
      </form>
    </div>
  );
};

export default RegisterPage;