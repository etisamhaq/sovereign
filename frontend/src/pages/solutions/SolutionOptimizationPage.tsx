import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowPathIcon, ArrowTrendingUpIcon, PuzzlePieceIcon, EyeIcon } from '@heroicons/react/24/outline';
import SolutionPricing, { PricingTier } from '../../components/solutions/SolutionPricing';
import ServiceRequestModal from '../../components/solutions/ServiceRequestModal';
import SEOHead from '../../components/SEOHead';
import { BRAND } from '../../config/brand';
import { useSolutionPricing } from '../../hooks/useSolutionPricing';

const benefits = [
  { icon: EyeIcon, title: 'Process Audit', description: 'We map your current workflows and identify every bottleneck, redundancy, and automation opportunity.' },
  { icon: ArrowTrendingUpIcon, title: 'Measurable Improvements', description: 'Track time saved, error reduction, and throughput increases with clear before/after metrics.' },
  { icon: PuzzlePieceIcon, title: 'Tool Consolidation', description: 'Reduce tool sprawl by integrating and connecting your existing stack into streamlined workflows.' },
  { icon: ArrowPathIcon, title: 'Continuous Optimization', description: 'AI-powered monitoring that suggests further improvements as your business evolves.' },
];

const TIER_FEATURES = {
  starter: {
    description: 'Optimize a single workflow',
    features: ['1 workflow audit & optimization', 'Process mapping document', 'Implementation recommendations', '5-day delivery', '14 days of support'],
  },
  growth: {
    description: 'Comprehensive workflow overhaul',
    features: ['Up to 5 workflow audits', 'End-to-end process mapping', 'Tool integration optimization', 'Before/after metrics report', '14-day delivery', '60 days of support'],
    popular: true,
  },
  pro: {
    description: 'Full business process transformation',
    features: ['Unlimited workflow audits', 'Organization-wide process mapping', 'Custom AI automation builds', 'Team training sessions', 'Continuous monitoring setup', 'Dedicated Slack channel', '30-day delivery', '6 months of support'],
  },
};

const testimonials = [
  { name: 'Lisa Thompson', role: 'COO, StreamlineHQ', quote: 'They reduced our onboarding workflow from 23 steps to 8. New hires are productive in half the time.' },
  { name: 'David Kim', role: 'Operations, FastTrack', quote: 'The workflow audit alone was worth the investment. We found 3 major bottlenecks we had no idea existed.' },
  { name: 'Aisha Mohammed', role: 'Founder, BizOptima', quote: 'Our team went from using 12 different tools to 5 integrated ones. Productivity jumped 40%.' },
];

const SolutionOptimizationPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'growth' | 'pro'>('growth');
  const prices = useSolutionPricing('optimization');
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
        title="Workflow Optimization"
        description="Streamline your business processes with expert workflow optimization. Reduce waste, increase speed, and improve outcomes."
        canonical="/solutions/optimization"
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Workflow Optimization
            </h1>
            <p className="mt-6 text-lg leading-8 text-emerald-100">
              We analyze, redesign, and optimize your business workflows to eliminate bottlenecks,
              reduce errors, and dramatically improve throughput.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                onClick={() => { setSelectedTier('growth'); setSelectedPrice(prices.growth); setModalOpen(true); }}
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-gray-100 transition-colors"
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Why Workflow Optimization?</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Small process improvements compound into massive business results.</p>
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
                <b.icon className="h-10 w-10 mx-auto text-emerald-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{b.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <div className="bg-gray-50 dark:bg-gray-800/50">
        <SolutionPricing tiers={tiers} serviceType="optimization" onSelectTier={handleSelectTier} />
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
      <section className="bg-emerald-600 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to Optimize Your Workflows?</h2>
          <p className="mt-4 text-lg text-emerald-100">Start streamlining your operations today.</p>
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => { setSelectedTier('growth'); setSelectedPrice(prices.growth); setModalOpen(true); }}
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-gray-100 transition-colors"
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
        serviceType="optimization"
        packageTier={selectedTier}
        price={selectedPrice}
      />
    </div>
  );
};

export default SolutionOptimizationPage;
