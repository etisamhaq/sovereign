import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface ServiceRequestModalProps {
  open: boolean;
  onClose: () => void;
  serviceType: 'automation' | 'agents' | 'optimization';
  packageTier: 'starter' | 'growth' | 'pro';
  price: number;
}

interface FormData {
  name: string;
  email: string;
  business_type: string;
  requirements: string;
  tools_used: string;
  budget: string;
  timeline: string;
}

const BUDGET_OPTIONS = [
  { value: 'under_500', label: 'Under $500' },
  { value: '500_1000', label: '$500 - $1,000' },
  { value: '1000_2500', label: '$1,000 - $2,500' },
  { value: '2500_5000', label: '$2,500 - $5,000' },
  { value: '5000_plus', label: '$5,000+' },
];

const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'ASAP (1-2 weeks)' },
  { value: 'standard', label: 'Standard (2-4 weeks)' },
  { value: 'flexible', label: 'Flexible (1-2 months)' },
  { value: 'no_rush', label: 'No Rush (3+ months)' },
];

const BUSINESS_TYPES = [
  'SaaS / Software', 'E-commerce', 'Marketing Agency', 'Consulting',
  'Education', 'Healthcare', 'Finance', 'Real Estate', 'Media / Content',
  'Non-profit', 'Other',
];

const SERVICE_LABELS: Record<string, string> = {
  automation: 'AI Automation Setup',
  agents: 'Custom AI Agents',
  optimization: 'Workflow Optimization',
};

const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  open, onClose, serviceType, packageTier, price,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    defaultValues: {
      name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
      email: user?.email || '',
      budget: 'under_500',
      timeline: 'standard',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        service_type: serviceType,
        package_tier: packageTier,
      };

      const requestRes = await apiClient.post('/solutions/request/', payload);
      const requestId = (requestRes as any).id;

      if (isAuthenticated) {
        try {
          const checkoutRes = await apiClient.post('/solutions/checkout/', {
            service_type: serviceType,
            package_tier: packageTier,
            service_request_id: requestId,
          });
          if ((checkoutRes as any).checkout_url) {
            toast.success('Redirecting to payment...');
            reset();
            onClose();
            window.location.href = (checkoutRes as any).checkout_url;
            return;
          }
        } catch (checkoutErr: any) {
          toast.error('Could not start checkout. You can pay later from your requests dashboard.');
        }
      }

      toast.success('Service request submitted! We\'ll be in touch shortly.');
      reset();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.requirements?.[0]
        || error.response?.data?.detail
        || 'Failed to submit request. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                      Request {SERVICE_LABELS[serviceType]}
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {packageTier.charAt(0).toUpperCase() + packageTier.slice(1)} Package — ${price.toLocaleString()}
                    </p>
                  </div>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                      <input
                        {...register('name', { required: 'Name is required' })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Your name"
                      />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="your@email.com"
                      />
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Type</label>
                    <select
                      {...register('business_type', { required: 'Business type is required' })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select your business type</option>
                      {BUSINESS_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                    {errors.business_type && <p className="text-xs text-red-500 mt-1">{errors.business_type.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Problem Description</label>
                    <textarea
                      {...register('requirements', { required: 'Please describe your requirements', minLength: { value: 20, message: 'At least 20 characters' } })}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Describe what you need automated, the agents you want built, or the workflows to optimize..."
                    />
                    {errors.requirements && <p className="text-xs text-red-500 mt-1">{errors.requirements.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tools Currently Used</label>
                    <input
                      {...register('tools_used')}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g. Zapier, Notion, Slack, Google Sheets..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget Range</label>
                      <select
                        {...register('budget')}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {BUDGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timeline</label>
                      <select
                        {...register('timeline')}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {TIMELINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ServiceRequestModal;
