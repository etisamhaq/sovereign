import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  UserCircleIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  ArrowUpIcon,
  GiftIcon,
  Cog6ToothIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { authService } from '../services/auth';
import RewardsTab from '../components/rewards/RewardsTab';
import ConfirmModal from '../components/ConfirmModal';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTheme } from '../contexts/ThemeContext';

const ProfilePage: React.FC = () => {
  usePageTitle('Account Settings');
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('profileTab');
    if (saved) {
      sessionStorage.removeItem('profileTab');
      return saved;
    }
    return 'profile';
  });

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserCircleIcon },
    { id: 'preferences', name: 'Preferences', icon: Cog6ToothIcon },
    { id: 'subscription', name: 'Subscription', icon: CreditCardIcon },
    { id: 'rewards', name: 'Rewards', icon: GiftIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Account Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <tab.icon className="mr-3 h-5 w-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
            {activeTab === 'subscription' && <SubscriptionTab />}
            {activeTab === 'rewards' && <RewardsTab />}
            {activeTab === 'security' && <SecurityTab />}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Profile Tab Component
interface ProfileFormData {
  first_name: string;
  last_name: string;
  username: string;
  bio: string;
}

const ProfileTab: React.FC = () => {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const { register, handleSubmit } = useForm<ProfileFormData>({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      username: user?.username || '',
      bio: user?.bio || '',
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) formData.append(key, value as string);
        });
        return authService.updateProfileWithAvatar(formData);
      }
      return authService.updateProfile(data);
    },
    onSuccess: (updatedUser) => {
      useAuthStore.setState({ user: updatedUser as any });
      setAvatarFile(null);
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar must be under 2MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  const displayAvatar = avatarPreview || user?.avatar;

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        Profile Information
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex items-center gap-6">
          <div className="relative group">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="Avatar"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
              />
            ) : (
              <UserCircleIcon className="h-20 w-20 text-gray-300 dark:text-gray-600" />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <CameraIcon className="h-6 w-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Profile Photo</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG under 2MB</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 text-xs text-primary-600 hover:text-primary-500 font-medium"
            >
              Change photo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              First Name
            </label>
            <input
              type="text"
              className="input mt-1"
              {...register('first_name')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Last Name
            </label>
            <input
              type="text"
              className="input mt-1"
              {...register('last_name')}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Username
          </label>
          <input
            type="text"
            className="input mt-1"
            {...register('username')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email Address
          </label>
          <input
            type="email"
            className="input mt-1"
            value={user?.email}
            disabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bio
          </label>
          <textarea
            rows={4}
            className="input mt-1"
            {...register('bio')}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn btn-primary"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Subscription Tab Component
const SubscriptionTab: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const { data: subscriptionResponse } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiClient.get('/payments/subscription/'),
  });

  const { data: usageResponse } = useQuery({
    queryKey: ['usage-quota'],
    queryFn: () => apiClient.get('/payments/usage-quota/'),
  });

  const subscription = subscriptionResponse as any;
  const usage = usageResponse as any;

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Current Plan
        </h2>

        <div className="mb-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {user?.is_pro ? 'Pro Plan' : 'Free Plan'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.is_pro
                    ? 'Unlimited access to all tools'
                    : `${user?.usage_limit || 50} uses per month`}
                </p>
              </div>
              {!user?.is_pro && (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/pricing')}
                >
                  <ArrowUpIcon className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </button>
              )}
            </div>

            {subscription && user?.is_pro && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}</p>
                <p>Amount: $5/month</p>
              </div>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Usage This Month
          </h4>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>{usage?.current_usage || 0} used</span>
              <span>{usage?.monthly_limit || 50} limit</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-primary-600 h-2.5 rounded-full"
                style={{
                  width: `${Math.min((usage?.current_usage || 0) / (usage?.monthly_limit || 50) * 100, 100)}%`
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {user?.is_pro && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Manage Subscription
          </h3>
          <div className="space-y-4">
            <button
              className="btn btn-outline w-full"
              onClick={async () => {
                try {
                  const response = await apiClient.get('/payments/customer-portal/') as any;
                  if (response?.url) {
                    window.open(response.url, '_blank');
                  } else {
                    toast('To update your payment method, please contact us at sovereign.tech@gmail.com', { icon: 'ℹ️' });
                  }
                } catch {
                  toast('To update your payment method, please contact us at sovereign.tech@gmail.com', { icon: 'ℹ️' });
                }
              }}
            >
              Update Payment Method
            </button>
            <button
              className="btn btn-outline w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel Subscription
            </button>
            <ConfirmModal
              open={showCancelModal}
              onClose={() => setShowCancelModal(false)}
              onConfirm={async () => {
                setIsCancelling(true);
                try {
                  await apiClient.post('/payments/subscription/cancel/', { cancel_immediately: false });
                  toast.success('Subscription cancelled. You will retain access until the end of your billing period.');
                  setShowCancelModal(false);
                } catch (error) {
                  toast.error('Failed to cancel subscription. Please try again.');
                } finally {
                  setIsCancelling(false);
                }
              }}
              title="Cancel Subscription"
              message="Are you sure you want to cancel your subscription? You will lose Pro access at the end of your billing period."
              confirmText="Yes, Cancel"
              cancelText="Keep Subscription"
              variant="danger"
              loading={isCancelling}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Preferences Tab Component
const PreferencesTab: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const { darkMode, toggleDarkMode } = useTheme();
  const [emailNotifications, setEmailNotifications] = useState(user?.email_notifications ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await authService.updateProfile({
        email_notifications: emailNotifications,
        dark_mode: darkMode,
      } as any);
      updateUser(updated);
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Preferences
        </h2>

        <div className="space-y-6">
          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Switch between light and dark themes
              </p>
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Receive updates, tips, and product news
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailNotifications ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Security Tab Component
interface SecurityFormData {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

const SecurityTab: React.FC = () => {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<SecurityFormData>();
  const newPassword = watch('new_password');

  const onSubmit = async (data: any) => {
    try {
      await authService.changePassword(data);
      toast.success('Password changed successfully');
      reset();
    } catch (error: any) {
      const message = error?.response?.data?.detail
        || error?.response?.data?.old_password?.[0]
        || error?.response?.data?.new_password?.[0]
        || 'Failed to change password. Please check your current password and try again.';
      toast.error(message);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        Change Password
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Current Password
          </label>
          <input
            type="password"
            className="input mt-1"
            {...register('old_password', { required: 'Current password is required' })}
          />
          {errors.old_password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.old_password.message || 'Invalid password'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            New Password
          </label>
          <input
            type="password"
            className="input mt-1"
            {...register('new_password', {
              required: 'New password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' }
            })}
          />
          {errors.new_password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.new_password.message || 'Invalid password'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Confirm New Password
          </label>
          <input
            type="password"
            className="input mt-1"
            {...register('new_password_confirm', {
              required: 'Please confirm your new password',
              validate: value => value === newPassword || 'Passwords do not match'
            })}
          />
          {errors.new_password_confirm && (
            <p className="mt-1 text-sm text-red-600">
              {errors.new_password_confirm.message || 'Passwords do not match'}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary">
            Change Password
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;