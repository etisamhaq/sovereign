import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead from '../components/SEOHead';
import {
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  GlobeAltIcon,
  ClockIcon,
  ChartBarIcon,
  UserGroupIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  CalendarIcon,
  VideoCameraIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';

const FeaturesPage: React.FC = () => {
  usePageTitle('Features', 'A self-hosted AI agent that audits contracts and policies against GDPR, HIPAA, and SOC 2 — privately, on your own AMD Instinct GPUs. Plus a full toolkit of document and research tools.');
  const mainFeatures = [
    {
      name: 'Private by design',
      description: 'Audits run an open model on your own AMD Instinct GPUs via vLLM/ROCm — confidential documents never reach a third-party API.',
      icon: LockClosedIcon,
    },
    {
      name: 'Cited compliance findings',
      description: 'Every gap is mapped to a specific GDPR, HIPAA, or SOC 2 article or control, with the evidence quoted straight from your document.',
      icon: ShieldCheckIcon,
    },
    {
      name: 'One toggle, many providers',
      description: 'Run the same audit on AMD (private), Fireworks (fast), or Groq — with automatic fallback if a provider is down.',
      icon: BoltIcon,
    },
    {
      name: 'More than an auditor',
      description: 'The same private agent runtime powers 30+ document, research, and writing tools and multi-step workflows.',
      icon: SparklesIcon,
    },
  ];

  const toolCategories = [
    {
      title: 'Writing & Content Creation',
      icon: DocumentTextIcon,
      tools: [
        'Essay Writer',
        'AI Paraphrasing Tool',
        'Writing Improver',
        'Email Writer',
        'Social Media Post Generator',
        'Title Generator',
        'Content Repurposer',
        'Resume Builder'
      ]
    },
    {
      title: 'Academic & Education',
      icon: AcademicCapIcon,
      tools: [
        'Research Assistant',
        'Citation Generator',
        'Course Outline Creator',
        'Text Summarizer',
        'Flashcard Creator',
        'Quiz Generator',
        'Content Outline Generator'
      ]
    },
    {
      title: 'Language & Analysis',
      icon: GlobeAltIcon,
      tools: [
        'Language Translator',
        'Grammar & Style Checker',
        'Tone Analyzer',
        'Plagiarism Checker',
        'Keyword Extractor',
        'Code Generator'
      ]
    },
    {
      title: 'SEO & Marketing',
      icon: ChartBarIcon,
      tools: [
        'Meta Description Generator',
        'LinkedIn Post Optimizer',
        'Content Calendar',
        'Keyword Extractor'
      ]
    },
    {
      title: 'Media & Visual Tools',
      icon: VideoCameraIcon,
      tools: [
        'VisiSense AI Screen Analyzer',
        'Video Downloader',
        'Video Chat AI',
        'Image Comparison Tool'
      ]
    }
  ];

  const benefits = [
    {
      icon: ClockIcon,
      title: 'Audit in minutes',
      description: 'Turn a manual, expensive compliance review into a cited risk report you can produce on demand.'
    },
    {
      icon: UserGroupIcon,
      title: 'Built for regulated teams',
      description: 'Legal, healthcare, security, and compliance teams that cannot send documents to a public API.'
    },
    {
      icon: CloudArrowUpIcon,
      title: 'Runs on your infrastructure',
      description: 'Self-host the agent on AMD Developer Cloud or your own AMD Instinct GPUs via vLLM/ROCm.'
    },
    {
      icon: LockClosedIcon,
      title: 'Data sovereignty',
      description: 'Confidential documents are processed entirely inside your environment and never used for training.'
    }
  ];

  const topTools = [
    {
      name: 'AI Course Outline Creator',
      description: 'Generate comprehensive course outlines with modules, lessons, learning objectives, and assessments for any subject.',
      icon: AcademicCapIcon,
      link: '/tools/course-outline-creator',
      color: 'bg-indigo-600'
    },
    {
      name: 'Social Media Content Calendar',
      description: 'Generate a complete 30-day content strategy with hooks, captions, hashtags, and optimal posting times for all platforms.',
      icon: CalendarIcon,
      link: '/tools/content-calendar',
      color: 'bg-purple-600'
    },
    {
      name: 'Video Chat AI',
      description: 'Upload any video and have intelligent conversations about its content using advanced AI transcription.',
      icon: VideoCameraIcon,
      link: '/tools/video-chat',
      color: 'bg-blue-600'
    },
    {
      name: 'Quiz Generator',
      description: 'Transform any text into interactive multiple-choice quizzes perfect for studying or testing knowledge.',
      icon: QuestionMarkCircleIcon,
      link: '/tools/quiz-generator',
      color: 'bg-green-600'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-900">
      <SEOHead
        title="Features"
        description="Sovereign audits contracts and policies against GDPR, HIPAA, and SOC 2 — privately, on your own AMD Instinct GPUs — and ships a full toolkit of document and research tools."
        canonical="/features"
        keywords="compliance audit, GDPR, HIPAA, SOC 2, private LLM, self-hosted AI, AMD Instinct, data sovereignty, document audit"
      />
      {/* Hero Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="font-display text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              Compliance auditing, kept private
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Sovereign audits your contracts and policies against GDPR, HIPAA, and SOC 2 — running on
              your own AMD GPUs so nothing leaves your infrastructure. And it's built on a full agent
              platform with 30+ document and research tools.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main Features */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-4"
          >
            {mainFeatures.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex flex-col"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600">
                  <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                  {feature.name}
                </h3>
                <p className="mt-2 flex flex-auto flex-col text-base text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Tool Categories */}
      <div className="bg-gray-50 dark:bg-gray-800 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              A full toolkit behind the audit
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Beyond compliance, the same private runtime ships 30+ document and research tools
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {toolCategories.map((category, index) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-sm ring-1 ring-gray-900/5"
              >
                <div className="flex items-center gap-x-4 mb-6">
                  <category.icon className="h-8 w-8 text-primary-600" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {category.title}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {category.tools.map((tool) => (
                    <div
                      key={tool}
                      className="flex items-center text-sm text-gray-600 dark:text-gray-300"
                    >
                      <span className="mr-2 text-primary-600">•</span>
                      {tool}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Tools Section */}
      <div className="py-24 bg-gradient-to-br from-primary-50 to-purple-50 dark:from-gray-900 dark:to-purple-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Popular tools
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              A few of the document and research tools that ship alongside the compliance auditor
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {topTools.map((tool, index) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="relative rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-lg ring-1 ring-gray-900/5 hover:shadow-xl transition-shadow"
              >
                <div className={`inline-flex rounded-lg p-3 ${tool.color}`}>
                  <tool.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                  {tool.name}
                </h3>
                <p className="mt-2 text-base text-gray-600 dark:text-gray-300">
                  {tool.description}
                </p>
                <Link
                  to={tool.link}
                  className="mt-4 inline-flex items-center text-sm font-semibold text-primary-600 hover:text-primary-700"
                >
                  Try it now
                  <span className="ml-2" aria-hidden="true">→</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Why teams choose Sovereign
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Compliance-grade AI you can run without handing your data to anyone
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                  <benefit.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="bg-primary-600 dark:bg-primary-700"
      >
        <div className="px-6 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Run your first private audit
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-100">
              Check a contract or policy against GDPR, HIPAA, or SOC 2 on your own AMD GPUs —
              your documents never leave your infrastructure.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/compliance"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-primary-600 shadow-sm hover:bg-primary-50"
              >
                Run a compliance audit
              </Link>
              <Link
                to="/pricing"
                className="text-sm font-semibold leading-6 text-white hover:text-primary-100"
              >
                View Pricing <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FeaturesPage;