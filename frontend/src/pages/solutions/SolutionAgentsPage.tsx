import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { UserGroupIcon, SparklesIcon, CogIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import SolutionPricing, { PricingTier } from '../../components/solutions/SolutionPricing';
import ServiceRequestModal from '../../components/solutions/ServiceRequestModal';
import SEOHead from '../../components/SEOHead';
import { BRAND } from '../../config/brand';
import { useSolutionPricing } from '../../hooks/useSolutionPricing';

const benefits = [
  { icon: SparklesIcon, title: 'Intelligent Agents', description: 'Custom AI agents that understand your domain and make smart decisions on your behalf.' },
  { icon: CogIcon, title: 'Seamless Integrations', description: 'Agents that connect to your existing tools — Slack, email, CRM, databases, and APIs.' },
  { icon: ShieldCheckIcon, title: 'Reliable & Monitored', description: 'Built-in error handling, human-in-the-loop approvals, and real-time monitoring dashboards.' },
  { icon: UserGroupIcon, title: 'Multi-Agent Systems', description: 'Orchestrate multiple agents that collaborate to handle complex business processes end-to-end.' },
];

const TIER_FEATURES = {
  starter: {
    description: 'A single custom AI agent for one task',
    features: ['1 custom AI agent', 'Single task automation', 'Basic memory & context', '10-day delivery', '30 days of support'],
  },
  growth: {
    description: 'Multi-agent system with integrations',
    features: ['Up to 3 AI agents', 'Multi-step workflows', 'External API integrations', 'Memory & knowledge base', 'Human-in-the-loop approvals', '21-day delivery', '90 days of support'],
    popular: true,
  },
  pro: {
    description: 'Enterprise-grade agent platform',
    features: ['Unlimited AI agents', 'Multi-agent orchestration', 'Custom LLM fine-tuning', 'Advanced RAG pipeline', 'Real-time monitoring', 'Dedicated Slack channel', '30-day delivery', '6 months of support'],
  },
};

const testimonials = [
  { name: 'Alex Rivera', role: 'CTO, TechBridge', quote: 'Our custom AI agents handle 80% of customer support tickets autonomously. Response times dropped from hours to seconds.' },
  { name: 'Emma Watson', role: 'VP Sales, GrowthCo', quote: 'The lead qualification agent saves our sales team 15 hours per week. It\'s like having an extra team member.' },
  { name: 'Raj Gupta', role: 'Founder, AutoDesk.ai', quote: 'Sovereign built us a multi-agent system that processes, categorizes, and responds to 500+ emails daily.' },
];

const SolutionAgentsPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'growth' | 'pro'>('growth');
  const prices = useSolutionPricing('agents');
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
        title="Custom AI Agents"
        description="Get intelligent AI agents custom-built for your business. Automate decisions, handle conversations, and orchestrate complex workflows."
        canonical="/solutions/agents"
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Custom AI Agents
            </h1>
            <p className="mt-6 text-lg leading-8 text-indigo-100">
              We design and deploy intelligent AI agents that think, decide, and act on behalf of your business
              — from customer support to data analysis to sales outreach.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                onClick={() => { setSelectedTier('growth'); setSelectedPrice(prices.growth); setModalOpen(true); }}
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-gray-100 transition-colors"
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Why Custom AI Agents?</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Build AI teammates that work around the clock and get smarter over time.</p>
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
                <b.icon className="h-10 w-10 mx-auto text-indigo-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{b.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <div className="bg-gray-50 dark:bg-gray-800/50">
        <SolutionPricing tiers={tiers} serviceType="agents" onSelectTier={handleSelectTier} />
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
      <section className="bg-indigo-600 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Ready for Your Custom AI Agents?</h2>
          <p className="mt-4 text-lg text-indigo-100">Tell us what you need, and we'll build agents that deliver results.</p>
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => { setSelectedTier('growth'); setSelectedPrice(prices.growth); setModalOpen(true); }}
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 hover:bg-gray-100 transition-colors"
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
        serviceType="agents"
        packageTier={selectedTier}
        price={selectedPrice}
      />
    </div>
  );
};

export default SolutionAgentsPage;
