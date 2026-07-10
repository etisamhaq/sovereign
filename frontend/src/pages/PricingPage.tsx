import React, { useState } from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/api';
import { toast } from 'react-hot-toast';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import { BRAND } from '../config/brand';

const plans = [
  {
    name: 'Free',
    price: 0,
    period: 'forever',
    features: [
      '50 uses per month',
      '12 AI writing & utility tools',
      'Paraphrase, Grammar Check, Summarizer',
      'Translator, Title & Outline Generator',
      'Citation Generator, Flashcard Creator',
      'Standard processing speed',
    ],
    limitations: [
      'No access to premium tools',
      '50 monthly usage cap',
      'No priority support',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: BRAND.pricing.pro.price,
    period: BRAND.pricing.pro.period,
    productId: BRAND.polar.proProductId,
    priceId: BRAND.polar.proPriceId,
    features: [
      '2,000 uses per month',
      'All 38+ AI tools included',
      'Essay Writer, Quiz Generator, Research Assistant',
      'VisiSense AI, Video Chat, Image Comparison',
      'Content Calendar, Course Outline Creator',
      'Priority processing speed',
      'Priority email support',
      'Early access to new features',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
];

const PricingPage: React.FC = () => {
  usePageTitle('Pricing', 'Simple, transparent pricing for Sovereign. Free tier with 50 uses/month or Pro at $5/month for 2,000 uses across all 33+ AI tools.');
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPlan = async (plan: any) => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }

    if (plan.price === 0 || user?.is_pro) {
      return;
    }

    setIsLoading(true);
    try {
      // Create Polar checkout session
      const response = await apiClient.post('/payments/checkout-session/', {
        product_id: plan.productId,
      });

      // Redirect to Polar checkout
      if ((response as any).checkout_url) {
        window.location.href = (response as any).checkout_url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create checkout session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900">
      <SEOHead
        title="Pricing"
        description="Simple, transparent pricing for Sovereign. Free tier with 50 uses/month or Pro at $5/month for 2,000 uses across all 33+ AI tools."
        canonical="/pricing"
        keywords="Sovereign pricing, AI tools pricing, cheap AI tools, AI writing subscription, $5 AI tools"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Choose the plan that's right for you. Upgrade or downgrade at any time.
          </p>
        </motion.div>

        <div className="mx-auto mt-16 max-w-2xl grid grid-cols-1 gap-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`rounded-2xl p-8 xl:p-10 ${
                plan.popular
                  ? 'ring-2 ring-primary-600 bg-gray-50 dark:bg-gray-800'
                  : 'ring-1 ring-gray-200 dark:ring-gray-700'
              }`}
            >
              {plan.popular && (
                <p className="text-sm font-semibold text-primary-600 mb-4">Most popular</p>
              )}

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {plan.name}
              </h3>

              <p className="mt-4 flex items-baseline">
                <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
                  ${plan.price}
                </span>
                <span className="ml-1 text-xl font-semibold text-gray-600 dark:text-gray-300">
                  /{plan.period}
                </span>
              </p>

              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={
                  isLoading ||
                  (plan.price === 0 && user?.subscription_tier === 'free') ||
                  (plan.price > 0 && user?.is_pro)
                }
                className={`mt-8 block w-full rounded-md px-3.5 py-2.5 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  plan.popular
                    ? 'bg-primary-600 text-white hover:bg-primary-500 focus-visible:outline-primary-600'
                    : 'text-primary-600 ring-1 ring-inset ring-primary-200 hover:ring-primary-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? 'Processing...' :
                 (plan.price === 0 && user?.subscription_tier === 'free') ? 'Current Plan' :
                 (plan.price > 0 && user?.is_pro) ? 'Current Plan' :
                 plan.cta}
              </button>

              <ul className="mt-10 space-y-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <CheckIcon className="h-6 w-5 flex-none text-primary-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
                {plan.limitations?.map((limitation) => (
                  <li key={limitation} className="flex gap-x-3">
                    <XMarkIcon className="h-6 w-5 flex-none text-gray-400" aria-hidden="true" />
                    <span className="text-gray-400">{limitation}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            All plans include a 7-day money-back guarantee. No questions asked.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default PricingPage;