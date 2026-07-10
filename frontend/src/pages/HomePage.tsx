import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import PromoVideoSection from '../components/PromoVideoSection';
import { useAuthStore } from '../store/authStore';
import { PERSONAS, personaColors } from '../config/personas';
import {
  CheckIcon,
  PencilSquareIcon,
  AcademicCapIcon,
  MagnifyingGlassCircleIcon,
  PhotoIcon,
  BeakerIcon,
  ChartBarIcon,
  ArrowRightIcon,
  BoltIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  LockClosedIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const categoryColorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
};

const HomePage: React.FC = () => {
  usePageTitle(undefined, 'Sovereign — a self-hosted AI agent that audits contracts and policies against GDPR, HIPAA, and SOC 2, running privately on your own AMD Instinct GPUs.');
  const { isAuthenticated } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const ctaLink = isAuthenticated ? '/dashboard' : '/register';
  const auditLink = '/compliance';

  // Tool categories with their tools
  const toolCategories = [
    {
      id: 'writing',
      name: 'Writing & Content',
      icon: PencilSquareIcon,
      color: 'blue',
      tools: [
        'AI Paraphrasing Tool',
        'Grammar & Style Checker',
        'Essay Writer',
        'Writing Improver',
        'Title Generator',
        'Meta Description Generator',
        'Email Writer',
        'Social Media Post Generator',
      ],
      count: 8
    },
    {
      id: 'education',
      name: 'Education & Study',
      icon: AcademicCapIcon,
      color: 'purple',
      tools: [
        'Quiz Generator',
        'Flashcard Creator',
        'Course Outline Creator',
        'Citation Generator',
        'Research Assistant',
        'Text Summarizer',
        'Content Outline Generator',
      ],
      count: 7
    },
    {
      id: 'media',
      name: 'Media & Visual',
      icon: PhotoIcon,
      color: 'pink',
      tools: [
        'VisiSense AI Screen Analyzer',
        'Video Downloader',
        'Video Chat AI',
        'Image Comparison Tool',
      ],
      count: 4
    },
    {
      id: 'productivity',
      name: 'Productivity & Utility',
      icon: ChartBarIcon,
      color: 'green',
      tools: [
        'Language Translator',
        'Code Generator',
        'Resume Builder',
        'Tone Analyzer',
        'Plagiarism Checker',
        'Content Repurposer',
      ],
      count: 6
    },
    {
      id: 'seo',
      name: 'SEO & Marketing',
      icon: MagnifyingGlassCircleIcon,
      color: 'orange',
      tools: [
        'LinkedIn Post Optimizer',
        'Keyword Extractor',
        'Content Calendar',
        'Meta Description Generator',
      ],
      count: 4
    }
  ];

  const features = [
    {
      name: 'Instant AI Processing',
      description: 'Get results in seconds with our advanced AI models',
      icon: BoltIcon,
    },
    {
      name: 'Multi-language Support',
      description: 'Work with content in 20+ languages seamlessly',
      icon: GlobeAltIcon,
    },
    {
      name: 'Privacy Focused',
      description: 'Your data is secure and never used for training',
      icon: ShieldCheckIcon,
    },
    {
      name: 'Affordable Pricing',
      description: 'All 33+ tools for just $5/month with generous usage limits',
      icon: CurrencyDollarIcon,
    },
  ];

  const stats = [
    { label: 'AI Tools Available', value: '33+', icon: BeakerIcon },
    { label: 'Time Saved Daily', value: '2+ hrs', icon: ClockIcon },
    { label: 'Languages Supported', value: '20+', icon: GlobeAltIcon },
  ];

  const faqs = [
    {
      question: 'What is Sovereign?',
      answer: 'Sovereign is an all-in-one AI platform offering 33+ tools for writing, education, productivity, and content creation. All tools are powered by advanced AI models.'
    },
    {
      question: 'How much does it cost?',
      answer: 'Just $5/month for access to all 33+ tools with up to 2,000 uses per month. No hidden fees. Cancel anytime.'
    },
    {
      question: 'Do I need technical knowledge?',
      answer: 'No! All our tools are designed to be user-friendly. Simply input your text or requirements, and let AI do the work.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, we take privacy seriously. Your data is encrypted, never shared with third parties, and not used for AI training.'
    },
    {
      question: 'Can I try it for free?',
      answer: 'Yes! You can try our tools with limited usage before subscribing. No credit card required for the free trial.'
    }
  ];

  const filteredCategories = selectedCategory === 'all'
    ? toolCategories
    : toolCategories.filter(cat => cat.id === selectedCategory);

  return (
    <div className="relative">
      <SEOHead
        description="Sovereign — a self-hosted AI agent that audits contracts and policies against GDPR, HIPAA, and SOC 2, running privately on your own AMD Instinct GPUs. Your confidential documents never leave your infrastructure."
        canonical="/"
        keywords="compliance audit, GDPR audit, HIPAA compliance, SOC 2, private LLM, self-hosted AI, AMD Instinct, data sovereignty, contract review AI, policy review"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Sovereign',
          url: 'https://sovereign.com',
          applicationCategory: 'SecurityApplication',
          operatingSystem: 'Web',
          description: 'A self-hosted AI compliance-audit agent for GDPR, HIPAA, and SOC 2 that runs on your own AMD Instinct GPUs.',
        }}
      />
      {/* Hero — dark, sovereign, compliance-first */}
      <div className="relative overflow-hidden bg-gray-950">
        {/* Ambient field: teal glow + faint grid, no purple blobs */}
        <div className="absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary-500/20 blur-[120px]" />
          <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '46px 46px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, #000 40%, transparent 100%)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-28 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Eyebrow — the sovereignty claim, not a feature count */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/10 px-4 py-1.5"
            >
              <LockClosedIcon className="h-4 w-4 text-primary-300" />
              <span className="text-sm font-medium text-primary-200">
                Self-hosted · runs on your own AMD Instinct GPUs
              </span>
            </motion.div>

            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
              Audit compliance
              <br />
              <span className="bg-gradient-to-r from-primary-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
                without leaking your data
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-gray-300 md:text-xl">
              Sovereign is an AI agent that audits your contracts and policies against
              <span className="font-semibold text-white"> GDPR, HIPAA, and SOC 2</span> — and runs
              entirely on your own AMD hardware. Confidential documents never leave your
              infrastructure, and never reach a third-party API.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to={auditLink}
                className="group relative inline-flex items-center gap-2 rounded-xl bg-primary-500 px-8 py-4 font-semibold text-gray-950 shadow-lg shadow-primary-500/20 transition-all duration-200 hover:bg-primary-400 hover:shadow-xl"
              >
                <DocumentMagnifyingGlassIcon className="h-5 w-5" />
                Run a compliance audit
                <ArrowRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 font-semibold text-white transition-all duration-200 hover:bg-white/10"
              >
                How it works
              </Link>
            </div>

            {/* Trust row — provenance, not marketing fluff */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-primary-400" />
                <span>Data never leaves your GPUs</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 text-primary-400" />
                <span>GDPR · HIPAA · SOC 2 rulesets</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 text-primary-400" />
                <span>AMD Instinct + Fireworks, one toggle</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <PromoVideoSection ctaLink={ctaLink} />

      {/* Tool Categories Section */}
      <div className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Built on a full agent platform</h2>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              More than an auditor
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-300">
              The same private, multi-provider agent runtime that powers compliance audits also ships
              30+ document and research tools — all routed through your own AMD GPUs or Fireworks.
            </p>

            {/* Provider note */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 dark:bg-primary-900/20"
            >
              <BoltIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                One runtime, many providers — AMD Instinct, Fireworks, and Groq with automatic fallback.
              </span>
            </motion.div>
          </div>

          {/* Category Filter */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              All Categories
            </button>
            {toolCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Tool Categories Grid */}
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="relative p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-xl mb-4 ${categoryColorMap[category.color]?.bg || 'bg-gray-100 dark:bg-gray-900/30'}`}>
                    <category.icon className={`w-8 h-8 ${categoryColorMap[category.color]?.text || 'text-gray-600 dark:text-gray-400'}`} />
                  </div>

                  {/* Category Info */}
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {category.name}
                  </h3>
                  <p className="text-sm text-primary-600 dark:text-primary-400 mb-4">
                    {category.count} Tools Available
                  </p>

                  {/* Tool List */}
                  <ul className="space-y-2 mb-6">
                    {category.tools.slice(0, 4).map((tool) => (
                      <li key={tool} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <CheckIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{tool}</span>
                      </li>
                    ))}
                    {category.tools.length > 4 && (
                      <li className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                        +{category.tools.length - 4} more tools
                      </li>
                    )}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Marketplace teaser */}
      <div className="py-10 bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 border border-indigo-100 dark:border-indigo-800">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">New: Sovereign Marketplace</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Access curated external AI tools like Prepza, Logiforge, Vixora, and Slideo.
              </p>
            </div>
            <Link
              to="/marketplace"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-semibold hover:bg-indigo-500 transition-colors"
            >
              Explore Marketplace
              <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive Stats Section */}
      <div className="py-24 bg-gradient-to-r from-primary-600 to-purple-600">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, type: "spring" }}
                viewport={{ once: true }}
                className="text-center"
              >
                <stat.icon className="w-8 h-8 mx-auto mb-2 text-white/80" />
                <div className="text-4xl font-bold text-white">{stat.value}</div>
                <div className="mt-2 text-sm text-white/80">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Persona Discovery Section ── */}
      <div className="py-24 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Find Your Tools</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              AI Tools Tailored to Your Workflow
            </p>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Whether you're a student, content creator, or professional — discover the tools that matter most to you.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PERSONAS.map((persona, index) => {
              const colors = personaColors[persona.color] || personaColors.blue;
              return (
                <motion.div
                  key={persona.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  viewport={{ once: true }}
                >
                  <Link
                    to={`/for/${persona.id}`}
                    className={`group block relative p-6 rounded-2xl border ${colors.border} ${colors.bg} hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 h-full`}
                  >
                    <div className="text-4xl mb-4">{persona.emoji}</div>
                    <h3 className={`text-lg font-bold ${colors.text} mb-2`}>{persona.label}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                      {persona.tagline}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                        {persona.toolSlugs.length} tools
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                        {persona.workflows.length} workflows
                      </span>
                    </div>
                    <div className={`mt-4 flex items-center text-sm font-medium ${colors.text} group-hover:gap-2 transition-all`}>
                      <span>Explore</span>
                      <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Why Choose Sovereign</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Built for Modern Creators
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
              {features.map((feature) => (
                <motion.div
                  key={feature.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className="flex flex-col"
                >
                  <dt className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-purple-500">
                      <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    {feature.name}
                  </dt>
                  <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </motion.div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Social Proof / Testimonials Section */}
      <div className="py-24 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Loved by Creators</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              What Our Users Say
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            {[
              {
                name: 'Ahmad Hassan',
                role: 'Content Creator',
                avatar: 'AH',
                color: 'from-blue-500 to-cyan-500',
                quote: 'Sovereign has completely transformed my workflow. I used to spend 4 hours writing a single blog post — now I can produce 3 high-quality articles in the same time. The paraphrasing and grammar tools are next level.',
                rating: 5,
              },
              {
                name: 'Abdullah Malik',
                role: 'University Student',
                avatar: 'AM',
                color: 'from-purple-500 to-pink-500',
                quote: "As a student, I can't afford expensive tools. Sovereign gives me everything — essay help, citations, flashcards, and summaries — all for just $5. My grades have improved noticeably since I started using it.",
                rating: 5,
              },
              {
                name: 'Sara Noor',
                role: 'Freelance Writer',
                avatar: 'SN',
                color: 'from-orange-500 to-red-500',
                quote: "I've tried Jasper, Copy.ai, and Grammarly — none of them offer this many tools at this price. The Video Chat AI alone is worth it. I use it to research YouTube videos for my articles in minutes.",
                rating: 5,
              },
              {
                name: 'Omar Farooq',
                role: 'Digital Marketer',
                avatar: 'OF',
                color: 'from-green-500 to-emerald-500',
                quote: "The SEO tools and content calendar have been game-changers for my agency. We manage 12 client accounts and Sovereign helps us stay on top of everything without breaking the budget.",
                rating: 5,
              },
              {
                name: 'Fatima Zahra',
                role: 'PhD Researcher',
                avatar: 'FZ',
                color: 'from-indigo-500 to-purple-500',
                quote: "The research assistant and summarizer save me hours every week. I analyze papers and lecture videos much faster now. It's the best tool for academic productivity I've found.",
                rating: 5,
              },
              {
                name: 'Bilal Ahmed',
                role: 'Small Business Owner',
                avatar: 'BA',
                color: 'from-pink-500 to-rose-500',
                quote: "I use Sovereign for everything — product descriptions, social media posts, email newsletters. It replaced 4 different subscriptions I was paying $60+/month for. Incredible value.",
                rating: 5,
              },
            ].map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex flex-col bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                {/* Quote */}
                <p className="flex-1 text-gray-600 dark:text-gray-300 text-sm leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                {/* Author */}
                <div className="mt-6 flex items-center gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white text-sm font-bold`}>
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{testimonial.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* What's Coming Section */}
      <div className="py-24 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/50 rounded-full mb-4"
            >
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">COMING SOON</span>
            </motion.div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              We're Building the Future of AI Tools
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Our team is working around the clock to bring you cutting-edge AI tools.
              Here's what's in our development pipeline:
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-4">
            {[
              { name: 'Voice Note Transcriber', description: 'Convert audio to formatted text', icon: '🎙️' },
              { name: 'Presentation Builder', description: 'Create slides with AI', icon: '📊' },
              { name: 'Document Analyzer Pro', description: 'Extract insights from PDFs', icon: '📄' },
              { name: 'Legal Document Helper', description: 'Simplify legal language', icon: '⚖️' },
              { name: 'Math Problem Solver', description: 'Step-by-step solutions', icon: '🔢' },
              { name: 'Blog Post Optimizer', description: 'SEO-optimized blog posts', icon: '📝' },
              { name: 'Data Visualization Tool', description: 'Turn data into charts', icon: '📈' },
              { name: 'Meeting Notes Summarizer', description: 'AI-powered meeting summaries', icon: '🗒️' },
            ].map((tool, index) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
                className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-3">{tool.icon}</div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {tool.name}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {tool.description}
                </p>
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                    Soon
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <BoltIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                New AI tools added every week — stay tuned!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">FAQs</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Frequently Asked Questions
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-3xl">
            <dl className="space-y-8">
              {faqs.map((faq, index) => (
                <motion.div
                  key={faq.question}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"
                >
                  <dt className="text-lg font-semibold text-gray-900 dark:text-white">
                    {faq.question}
                  </dt>
                  <dd className="mt-2 text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </dd>
                </motion.div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 via-purple-600 to-pink-600 px-6 py-24 sm:px-24 xl:py-32">
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to Transform Your Workflow?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-lg leading-8 text-white/90">
          Save hours every day with Sovereign's comprehensive AI tools.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            to={ctaLink}
            className="rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-600 shadow-lg hover:bg-gray-100 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Start Your Free Trial'}
          </Link>
          <Link
            to="/pricing"
            className="rounded-xl bg-white/10 backdrop-blur-md px-8 py-4 text-base font-semibold text-white border border-white/20 hover:bg-white/20 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            View Pricing
          </Link>
        </div>

        {/* Background decoration */}
        <svg
          viewBox="0 0 1024 1024"
          className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-x-1/2"
          aria-hidden="true"
        >
          <circle
            cx={512}
            cy={512}
            r={512}
            fill="url(#gradient)"
            fillOpacity="0.15"
          />
          <defs>
            <radialGradient
              id="gradient"
              cx={0}
              cy={0}
              r={1}
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(512 512) rotate(90) scale(512)"
            >
              <stop stopColor="#fff" />
              <stop offset={1} stopColor="#fff" stopOpacity={0} />
            </radialGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

export default HomePage;