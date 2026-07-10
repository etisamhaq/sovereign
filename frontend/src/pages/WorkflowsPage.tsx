import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuthStore } from '../store/authStore';
import {
  MegaphoneIcon,
  CodeBracketIcon,
  ChartBarIcon,
  MicrophoneIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  VideoCameraIcon,
  GlobeAltIcon,
  ClockIcon,
  ArrowRightIcon,
  SparklesIcon,
  RocketLaunchIcon,
  BoltIcon,
  ArrowLongRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

/* ───────────────────────── Data ───────────────────────── */

const personas = [
  {
    id: 'marketer',
    icon: MegaphoneIcon,
    title: 'For Marketers',
    tagline: 'Campaign launch in 1 hour',
    color: 'from-orange-500 to-red-500',
    colorLight: 'bg-orange-50 dark:bg-orange-900/20',
    textColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-800',
    steps: [
      { tool: 'Blog Post Generator', action: 'Draft a long-form blog' },
      { tool: 'Content Repurposer', action: 'Turn blog into 5 social posts' },
      { tool: 'SEO Meta Description', action: 'Generate meta tags' },
      { tool: 'Keyword Extractor', action: 'Find top keywords' },
      { tool: 'Email Composer', action: 'Create launch email' },
    ],
  },
  {
    id: 'developer',
    icon: CodeBracketIcon,
    title: 'For Developers',
    tagline: 'Docs from a video tutorial',
    color: 'from-blue-500 to-cyan-500',
    colorLight: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    steps: [
      { tool: 'Video Chat AI', action: 'Upload tutorial video' },
      { tool: 'Summarizer', action: 'Extract key concepts' },
      { tool: 'Outline Generator', action: 'Structure documentation' },
      { tool: 'Writing Improver', action: 'Polish technical docs' },
      { tool: 'Grammar Check', action: 'Final review & publish' },
    ],
  },
  {
    id: 'analyst',
    icon: ChartBarIcon,
    title: 'For Analysts',
    tagline: 'Report to stakeholders fast',
    color: 'from-emerald-500 to-teal-500',
    colorLight: 'bg-emerald-50 dark:bg-emerald-900/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    steps: [
      { tool: 'Research Assistant', action: 'Gather data insights' },
      { tool: 'Summarizer', action: 'Condense findings' },
      { tool: 'Outline Generator', action: 'Structure the report' },
      { tool: 'Essay Writer', action: 'Draft analysis sections' },
      { tool: 'Tone Analyzer', action: 'Ensure professional tone' },
    ],
  },
];

const pipelines = [
  {
    id: 'repurpose',
    icon: MicrophoneIcon,
    title: 'Content Repurposing Pipeline',
    subtitle: '1 Podcast → 5 Platforms',
    color: 'bg-purple-600',
    gradient: 'from-purple-500 to-pink-500',
    input: '1 Podcast Episode',
    mainTool: 'Content Repurposer',
    outputs: [
      { platform: 'LinkedIn', tool: 'Writing Improver' },
      { platform: 'Twitter/X', tool: 'Text Simplifier' },
      { platform: 'Newsletter', tool: 'Email Composer' },
      { platform: 'Blog Post', tool: 'Blog Post Generator' },
      { platform: 'Instagram', tool: 'Social Media Post' },
    ],
  },
  {
    id: 'academic',
    icon: AcademicCapIcon,
    title: 'Academic Writing Pipeline',
    subtitle: 'Research → Submission-Ready Paper',
    color: 'bg-indigo-600',
    gradient: 'from-indigo-500 to-blue-500',
    input: 'Research Topic',
    mainTool: 'Research Assistant',
    steps: [
      'Outline Generator',
      'Essay Writer',
      'Writing Improver',
      'Grammar Check',
      'Plagiarism Check',
      'Citation Generator',
    ],
    result: 'Submission-Ready Paper',
  },
  {
    id: 'social',
    icon: CalendarDaysIcon,
    title: 'Social Media Campaign Pipeline',
    subtitle: 'Goal → 30 Days of Content',
    color: 'bg-pink-600',
    gradient: 'from-pink-500 to-rose-500',
    input: 'Campaign Goal',
    mainTool: 'Content Calendar',
    outputs: [
      { platform: '30x LinkedIn Posts', tool: 'Writing Improver' },
      { platform: '30x Twitter Threads', tool: 'Text Simplifier' },
      { platform: '4x Newsletters', tool: 'Email Composer' },
    ],
  },
  {
    id: 'education',
    icon: VideoCameraIcon,
    title: 'Education Pipeline',
    subtitle: 'Video → Complete Study Materials',
    color: 'bg-amber-600',
    gradient: 'from-amber-500 to-orange-500',
    input: '1-Hour Lecture Video',
    mainTool: 'Video Chat AI',
    steps: ['Summarizer', 'Flashcard Creator', 'Quiz Generator'],
    result: 'Complete Study Materials',
  },
  {
    id: 'seo',
    icon: GlobeAltIcon,
    title: 'Global SEO Pipeline',
    subtitle: 'English Blog → 3 Localized Posts',
    color: 'bg-teal-600',
    gradient: 'from-teal-500 to-emerald-500',
    input: 'English Blog Post',
    steps: [
      'Keyword Extractor',
      'Meta Description Generator',
      'Translator (3 Languages)',
      'Grammar Check',
    ],
    result: '3 Localized SEO-Ready Posts',
  },
];

const productivityStats = [
  { value: '2-4', unit: 'hrs', label: 'Saved Daily', icon: ClockIcon },
  { value: '10-20', unit: 'hrs', label: 'Reclaimed Weekly', icon: BoltIcon },
  { value: '30+', unit: '', label: 'AI Tools Available', icon: SparklesIcon },
  { value: '95%', unit: '', label: 'Time Reduction', icon: RocketLaunchIcon },
];

/* ──────────────── Helper Components ──────────────── */

const SectionHeading: React.FC<{
  badge?: string;
  title: string;
  subtitle: string;
  delay?: number;
}> = ({ badge, title, subtitle, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="mx-auto max-w-2xl text-center mb-16"
  >
    {badge && (
      <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-4 py-1.5 text-sm font-medium text-primary-700 dark:text-primary-300 ring-1 ring-inset ring-primary-600/20 mb-4">
        {badge}
      </span>
    )}
    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
      {title}
    </h2>
    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{subtitle}</p>
  </motion.div>
);

const FlowArrow: React.FC = () => (
  <div className="flex items-center justify-center">
    <ArrowLongRightIcon className="h-6 w-6 text-gray-400 dark:text-gray-500 hidden md:block" />
    <ArrowRightIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 md:hidden rotate-90" />
  </div>
);

/* ──────────────── Page Component ──────────────── */

const WorkflowsPage: React.FC = () => {
  usePageTitle('Workflows & Guide');
  const { isAuthenticated } = useAuthStore();
  const ctaLink = isAuthenticated ? '/dashboard' : '/register';
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>('repurpose');

  return (
    <div className="bg-white dark:bg-gray-900">
      {/* ─── Hero Section ─── */}
      <div className="relative isolate px-6 pt-14 lg:px-8 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary-400 to-purple-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>

        <div className="mx-auto max-w-3xl py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-4 py-1.5 text-sm font-medium text-primary-700 dark:text-primary-300 ring-1 ring-inset ring-primary-600/20 mb-6">
              <SparklesIcon className="h-4 w-4 mr-2" />
              Workflows &amp; Case Studies
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              Turn Hours of Work into{' '}
              <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                Minutes
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Discover how professionals use Sovereign's AI tools in powerful workflows.
              From content repurposing to academic research — see real pipelines, real
              case studies, and the time you'll save.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to={ctaLink}
                className="rounded-md bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition-colors"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Start Building Workflows'}
              </Link>
              <a
                href="#pipelines"
                className="text-sm font-semibold leading-6 text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Explore Pipelines <span aria-hidden="true">↓</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Productivity Stats Bar ─── */}
      <div className="bg-gray-50 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {productivityStats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50">
                  <stat.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                  {stat.unit && (
                    <span className="text-lg font-medium text-gray-500 dark:text-gray-400 ml-1">
                      {stat.unit}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Key Workflows by Persona ─── */}
      <div className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionHeading
            badge="Role-Based Workflows"
            title="Built for How You Work"
            subtitle="See exactly how marketers, developers, and analysts use Sovereign to save hours every day."
          />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {personas.map((persona, index) => (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className={`relative rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-sm ring-1 ring-gray-900/5 dark:ring-gray-700 hover:shadow-lg transition-shadow`}
              >
                {/* Header */}
                <div className={`inline-flex rounded-xl p-3 bg-gradient-to-br ${persona.color}`}>
                  <persona.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
                  {persona.title}
                </h3>
                <p className={`text-sm font-medium ${persona.textColor} mt-1`}>
                  {persona.tagline}
                </p>

                {/* Steps */}
                <div className="mt-6 space-y-3">
                  {persona.steps.map((step, si) => (
                    <div
                      key={si}
                      className={`flex items-start gap-3 rounded-lg p-3 ${persona.colorLight} border ${persona.borderColor}`}
                    >
                      <span className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${persona.color} text-white text-xs font-bold`}>
                        {si + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {step.tool}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{step.action}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  to="/tools"
                  className={`mt-6 inline-flex items-center text-sm font-semibold ${persona.textColor} hover:underline`}
                >
                  Try this workflow
                  <ArrowRightIcon className="ml-1.5 h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Visual Pipelines ─── */}
      <div id="pipelines" className="bg-gray-50 dark:bg-gray-800/50 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionHeading
            badge="Visual Pipelines"
            title="See the Flow, Step by Step"
            subtitle="Five powerful pipelines that transform a single input into polished, multi-platform output."
          />

          <div className="space-y-4">
            {pipelines.map((pipeline, index) => (
              <motion.div
                key={pipeline.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <button
                  onClick={() =>
                    setExpandedPipeline(expandedPipeline === pipeline.id ? null : pipeline.id)
                  }
                  className="w-full rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-gray-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-xl p-3 bg-gradient-to-br ${pipeline.gradient}`}>
                        <pipeline.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {pipeline.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {pipeline.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronDownIcon
                      className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                        expandedPipeline === pipeline.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {expandedPipeline === pipeline.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-b-2xl bg-white dark:bg-gray-800 px-6 pb-8 ring-1 ring-gray-900/5 dark:ring-gray-700 -mt-2 pt-4">
                        {/* Pipeline flow visualization */}
                        <div className="flex flex-col md:flex-row items-center gap-3 md:gap-2 justify-center flex-wrap">
                          {/* Input */}
                          <div className="rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-center min-w-[140px]">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Input
                            </p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                              {pipeline.input}
                            </p>
                          </div>

                          <FlowArrow />

                          {/* Main Tool */}
                          {pipeline.mainTool && (
                            <>
                              <div
                                className={`rounded-xl bg-gradient-to-br ${pipeline.gradient} px-4 py-3 text-center min-w-[140px] shadow-md`}
                              >
                                <p className="text-xs text-white/80 uppercase tracking-wider">
                                  Core Tool
                                </p>
                                <p className="text-sm font-bold text-white mt-1">
                                  {pipeline.mainTool}
                                </p>
                              </div>
                              <FlowArrow />
                            </>
                          )}

                          {/* Steps (linear pipeline) */}
                          {pipeline.steps &&
                            pipeline.steps.map((step, si) => (
                              <React.Fragment key={si}>
                                <div className="rounded-xl bg-white dark:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-600 px-4 py-3 text-center min-w-[120px]">
                                  <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Step {si + 1}
                                  </p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {step}
                                  </p>
                                </div>
                                {si < pipeline.steps!.length - 1 && <FlowArrow />}
                              </React.Fragment>
                            ))}

                          {/* Outputs (multi-platform) */}
                          {pipeline.outputs && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full md:w-auto">
                              {pipeline.outputs.map((out, oi) => (
                                <div
                                  key={oi}
                                  className="rounded-lg bg-white dark:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-600 px-4 py-2.5 text-center"
                                >
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {out.platform}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    via {out.tool}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Result (for linear pipelines) */}
                          {pipeline.result && (
                            <>
                              <FlowArrow />
                              <div className="rounded-xl bg-green-50 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-800 px-4 py-3 text-center min-w-[140px]">
                                <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider">
                                  Result
                                </p>
                                <p className="text-sm font-bold text-green-800 dark:text-green-300 mt-1">
                                  {pipeline.result}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── How It Works (Simple Steps) ─── */}
      <div className="bg-gradient-to-br from-primary-50 to-purple-50 dark:from-gray-900 dark:to-purple-900/20 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionHeading
            title="How It Works"
            subtitle="Three simple steps to supercharge your productivity."
          />

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                step: '1',
                title: 'Choose Your Workflow',
                desc: 'Pick from ready-made workflows for marketing, academics, social media, and more.',
                icon: SparklesIcon,
              },
              {
                step: '2',
                title: 'Chain AI Tools',
                desc: 'Feed the output of one tool into the next. Each step refines and enhances your content.',
                icon: BoltIcon,
              },
              {
                step: '3',
                title: 'Publish Everywhere',
                desc: 'Get polished, platform-ready content in minutes instead of hours.',
                icon: RocketLaunchIcon,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-purple-600 shadow-lg">
                  <item.icon className="h-8 w-8 text-white" />
                </div>
                <div className="inline-flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 px-3 py-0.5 text-xs font-semibold text-primary-700 dark:text-primary-300 mb-3">
                  Step {item.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Daily Savings Highlight ─── */}
      <div className="py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl bg-gradient-to-br from-primary-600 to-purple-700 p-10 md:p-14 overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                }}
              />
            </div>

            <div className="relative text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Save 2-4 Hours Every Single Day
              </h2>
              <p className="mt-4 text-lg text-primary-100 max-w-2xl mx-auto">
                That's <span className="font-bold text-white">10-20 hours per week</span> reclaimed
                for strategy, creativity, and the work that actually matters. Stop spending time on
                repetitive content tasks.
              </p>

              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-2xl mx-auto">
                {[
                  { label: 'Content Creation', before: '3 hours', after: '15 min' },
                  { label: 'Research Papers', before: '5+ hours', after: '30 min' },
                  { label: 'Social Campaigns', before: '20+ hrs/mo', after: '2 hrs/mo' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-white/10 backdrop-blur-sm p-4 ring-1 ring-white/20"
                  >
                    <p className="text-sm font-medium text-primary-200">{item.label}</p>
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <span className="text-sm line-through text-red-300">{item.before}</span>
                      <ArrowRightIcon className="h-4 w-4 text-green-300" />
                      <span className="text-lg font-bold text-green-300">{item.after}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link
                  to={ctaLink}
                  className="inline-flex items-center rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-primary-700 shadow-lg hover:bg-primary-50 transition-colors"
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Start Saving Time Today'}
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── CTA Section ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="bg-primary-600 dark:bg-primary-700"
      >
        <div className="px-6 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Build Your First Workflow?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-100">
              Join thousands of professionals already using Sovereign to create better content
              faster. Start with any workflow above — no credit card required.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to={ctaLink}
                className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-primary-600 shadow-sm hover:bg-primary-50 transition-colors"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              </Link>
              <Link
                to="/features"
                className="text-sm font-semibold leading-6 text-white hover:text-primary-100 transition-colors"
              >
                View All Features <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WorkflowsPage;
