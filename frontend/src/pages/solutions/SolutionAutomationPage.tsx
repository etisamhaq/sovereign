import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CpuChipIcon, BoltIcon, ClockIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import SolutionPricing, { PricingTier } from '../../components/solutions/SolutionPricing';
import ServiceRequestModal from '../../components/solutions/ServiceRequestModal';
import SEOHead from '../../components/SEOHead';
import { BRAND } from '../../config/brand';
import { useSolutionPricing } from '../../hooks/useSolutionPricing';

const benefits = [
  { icon: BoltIcon, title: 'Eliminate Manual Work', description: 'Automate repetitive data entry, report generation, and content scheduling so your team can focus on strategy.' },
  { icon: ClockIcon, title: 'Save 20+ Hours/Week', description: 'Our AI automations run 24/7, handling tasks that used to take your team hours every single day.' },
  { icon: ChartBarIcon, title: 'Scale Without Hiring', description: 'Handle 10x the workload without adding headcount. AI automation grows with your business.' },
  { icon: CpuChipIcon, title: 'Custom-Built For You', description: 'No cookie-cutter templates. We build automations tailored to your exact business processes.' },
];

const TIER_FEATURES = {
  starter: {
    description: 'Perfect for automating a single workflow',
    features: [
      '1 automated workflow',
      'Up to 3 integration points',
      'Basic error handling',
      '7-day delivery',
      '30 days of support',
    ],
  },
  growth: {
    description: 'For businesses ready to automate multiple processes',
    features: [
      'Up to 5 automated workflows',
      'Unlimited integrations',
      'Advanced error handling & retries',
      'Dashboard monitoring',
      '14-day delivery',
      '90 days of support',
    ],
    popular: true,
  },
  pro: {
    description: 'Full-scale automation transformation',
    features: [
      'Unlimited workflows',
      'Custom AI agents included',
      'Priority processing queues',
      'Real-time analytics dashboard',
      'Dedicated Slack channel',
      '21-day delivery',
      '6 months of support',
    ],
  },
};

const testimonials = [
  { name: 'Sarah Chen', role: 'CEO, DataFlow Inc', quote: 'Sovereign automated our entire report pipeline. What took 3 people 2 days now happens in minutes.' },
  { name: 'Marcus Johnson', role: 'Ops Manager, ScaleUp', quote: 'We saved $4,000/month in labor costs within the first week of going live with our automations.' },
  { name: 'Priya Patel', role: 'Founder, ContentPro', quote: 'The AI automation setup was seamless. Our content scheduling is now fully hands-off.' },
];

const SolutionAutomationPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'growth' | 'pro'>('growth');
  const prices = useSolutionPricing('automation');
  const [selectedPrice, setSelectedPrice] = useState(prices.growth);

  const tiers: PricingTier[] = useMemo(() => [
    { name: 'Starter', price: prices.starter, ...TIER_FEATURES.starter },
    { name: 'Growth', price: prices.growth, ...TIER_FEATURES.growth },
    { name: 'Pro', price: prices.pro, ...TIER_FEATURES.pro },
  ], [prices]);

  const handleSelectTier = (tier: PricingTier) => {
    setSelectedTier(tier.name.toLowerCase() as any);
    setSelectedPrice(tier.price);
    setModalOpen(true);
  };

  return (
    <div className="bg-white dark:bg-gray-900">
      <SEOHead
        title="AI Automation Setup"
        description="Let our team build custom AI automations for your business. Eliminate manual work and scale without hiring."
        canonical="/solutions/automation"
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              AI Automation Setup
            </h1>
            <p className="mt-6 text-lg leading-8 text-primary-100">
              We build custom AI-powered automations that eliminate manual work, reduce errors,
              and let your team focus on what actually matters.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                onClick={() => { setSelectedTier('growth'); setSelectedPrice(prices.growth); setModalOpen(true); }}
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary-700 shadow-sm hover:bg-gray-100 transition-colors"
              >
                Request Service
              </button>
              <a
                href={BRAND.bookCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Book a Call
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Why AI Automation?</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Stop doing things manually. Let AI handle the repetitive work.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800"
              >
                <b.icon className="h-10 w-10 mx-auto text-primary-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{b.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <div className="bg-gray-50 dark:bg-gray-800/50">
        <SolutionPricing tiers={tiers} serviceType="automation" onSelectTier={handleSelectTier} />
      </div>

      {/* Testimonials */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">What Our Clients Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-xl bg-gray-50 dark:bg-gray-800 p-6"
              >
                <p className="text-gray-600 dark:text-gray-300 italic">"{t.quote}"</p>
                <div className="mt-4">
                  <p className="font-semibold text-gray-900 dark:text-white">{t.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-primary-600 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to Automate Your Business?</h2>
          <p className="mt-4 text-lg text-primary-100">Get started today and see results within weeks.</p>
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => { setSelectedTier('growth'); setSelectedPrice(prices.growth); setModalOpen(true); }}
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary-700 hover:bg-gray-100 transition-colors"
            >
              Request Service
            </button>
            <a
              href={BRAND.bookCallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Book a Call
            </a>
          </div>
        </div>
      </section>

      <ServiceRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        serviceType="automation"
        packageTier={selectedTier}
        price={selectedPrice}
      />
    </div>
  );
};

export default SolutionAutomationPage;
