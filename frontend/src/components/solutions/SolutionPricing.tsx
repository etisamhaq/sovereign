import React from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export interface PricingTier {
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
}

interface SolutionPricingProps {
  tiers: PricingTier[];
  serviceType: string;
  onSelectTier: (tier: PricingTier) => void;
}

const SolutionPricing: React.FC<SolutionPricingProps> = ({ tiers, serviceType, onSelectTier }) => {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Choose Your Package
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Select the package that fits your needs. Every package includes dedicated support.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-lg grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
          {tiers.map((tier, idx) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`relative flex flex-col rounded-2xl p-8 ${
                tier.popular
                  ? 'ring-2 ring-primary-600 bg-gray-50 dark:bg-gray-800 shadow-xl'
                  : 'ring-1 ring-gray-200 dark:ring-gray-700'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{tier.name}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{tier.description}</p>
              <p className="mt-6 flex items-baseline">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">${tier.price.toLocaleString()}</span>
                <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">/one-time</span>
              </p>
              <ul className="mt-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <CheckIcon className="h-5 w-5 flex-shrink-0 text-primary-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onSelectTier(tier)}
                className={`mt-8 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  tier.popular
                    ? 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500'
                    : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 focus:ring-gray-500'
                }`}
              >
                Get Started
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionPricing;
