import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import ToolCard from '../components/ToolCard';
import { MagnifyingGlassIcon, FunnelIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead, { toolListJsonLd } from '../components/SEOHead';
import { PERSONAS, personaColors, getPersonaToolSlugs } from '../config/personas';

interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  icon: string;
  is_premium: boolean;
  is_implemented: boolean;
  usage_count: number;
  user_has_access: boolean;
}

interface ToolsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Tool[];
}

const categories = [
  { value: 'all', label: 'All Tools' },
  { value: 'writing', label: 'Writing Tools' },
  { value: 'education', label: 'Education Tools' },
  { value: 'seo', label: 'SEO & Marketing Tools' },
  { value: 'utility', label: 'Utility Tools' },
];

const ToolsPage: React.FC = () => {
  usePageTitle('AI Writing Tools', 'Browse 33+ AI-powered writing, education, and productivity tools. Filter by category, search, or choose free and pro tools.');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [selectedPersona, setSelectedPersona] = useState<string>(searchParams.get('persona') || '');

  const { data: toolsData, isLoading, error } = useQuery<ToolsResponse>({
    queryKey: ['tools', selectedCategory],
    queryFn: async () => {
      const params = selectedCategory !== 'all' ? { params: { category: selectedCategory } } : undefined;
      return apiClient.get('/tools/', params);
    },
  });

  const tools = Array.isArray(toolsData) ? toolsData : (toolsData?.results || []);

  // Persona-based reordering: persona tools first, then the rest
  const personaSlugs = selectedPersona ? getPersonaToolSlugs(selectedPersona) : [];
  const orderedTools = selectedPersona
    ? [
        ...tools.filter(t => personaSlugs.includes(t.slug)),
        ...tools.filter(t => !personaSlugs.includes(t.slug)),
      ]
    : tools;

  const filteredTools = orderedTools?.filter(tool => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccess =
      accessFilter === 'all' ||
      (accessFilter === 'free' && !tool.is_premium) ||
      (accessFilter === 'pro' && tool.is_premium);
    return matchesSearch && matchesAccess;
  });

  const freeCount = tools?.filter(t => !t.is_premium).length || 0;
  const proCount = tools?.filter(t => t.is_premium).length || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <SEOHead
        title="AI Writing Tools"
        description="Browse 33+ AI-powered writing, education, and productivity tools. Filter by category, search, or choose free and pro tools."
        canonical="/tools"
        keywords="AI writing tools, free AI tools, paraphrase tool, grammar checker, essay writer, text summarizer, citation generator"
        jsonLd={tools ? toolListJsonLd(tools) : undefined}
      />
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          AI-Powered Writing Tools
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Access 33+ AI-powered tools to enhance your writing, improve grammar,
          and create compelling content with the power of AI.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="search"
                placeholder="Search tools..."
                className="input pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search tools"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="sm:w-64">
            <select
              className="input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Access Filter Buttons (Free / Pro) */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <FunnelIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <button
          onClick={() => setAccessFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            accessFilter === 'all'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All Tools ({tools?.length || 0})
        </button>
        <button
          onClick={() => setAccessFilter('free')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
            accessFilter === 'free'
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          🆓 Free ({freeCount})
        </button>
        <button
          onClick={() => setAccessFilter('pro')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
            accessFilter === 'pro'
              ? 'bg-yellow-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          ⭐ Pro ({proCount})
        </button>
      </div>

      {/* Persona Filter Chips */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <UserGroupIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">I'm a:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedPersona(''); setSearchParams({}); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !selectedPersona
                ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All Users
          </button>
          {PERSONAS.map((persona) => {
            const colors = personaColors[persona.color] || personaColors.blue;
            const isActive = selectedPersona === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => {
                  setSelectedPersona(isActive ? '' : persona.id);
                  if (!isActive) {
                    setSearchParams({ persona: persona.id });
                  } else {
                    setSearchParams({});
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                  isActive
                    ? `bg-gradient-to-r ${colors.gradient} text-white shadow-sm`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>{persona.emoji}</span>
                {persona.label}
                {isActive && (
                  <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">
                    {persona.toolSlugs.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedPersona && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-gray-500 dark:text-gray-400"
          >
            Showing tools recommended for <strong>{PERSONAS.find(p => p.id === selectedPersona)?.label}</strong> first. All tools are still accessible below.
          </motion.p>
        )}
      </div>

      {/* Tools Grid */}
      {error ? (
        <div className="text-center py-12">
          <p className="text-red-500 dark:text-red-400">
            Failed to load tools. Please try again later.
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredTools?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No tools found matching your search.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredTools?.map((tool, index) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative"
            >
              {selectedPersona && personaSlugs.includes(tool.slug) && (
                <div className="absolute -top-2 -right-2 z-10">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r ${personaColors[PERSONAS.find(p => p.id === selectedPersona)?.color || 'blue']?.gradient} text-white shadow-sm`}>
                    ✓ Recommended
                  </span>
                </div>
              )}
              <ToolCard tool={tool} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Featured Tools Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Most Popular Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700">
            <h3 className="text-xl font-semibold text-purple-900 dark:text-purple-100 mb-2">
              VisiSense AI - Screen Analyzer
            </h3>
            <p className="text-purple-700 dark:text-purple-200 mb-4">
              Analyze screenshots with OCR, extract text in multiple languages, and get instant AI insights.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-600 dark:text-purple-300">
                ⭐ Pro
              </span>
              <Link to="/tools/visisense-ai" className="btn bg-purple-600 text-white hover:bg-purple-700">
                Try Now
              </Link>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 border-primary-200 dark:border-primary-700">
            <h3 className="text-xl font-semibold text-primary-900 dark:text-primary-100 mb-2">
              AI Paraphrasing Tool
            </h3>
            <p className="text-primary-700 dark:text-primary-200 mb-4">
              Rewrite any text instantly with multiple modes including formal, creative, and simple styles.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-600 dark:text-primary-300">
                🆓 Free
              </span>
              <Link to="/tools/paraphrase" className="btn btn-primary">
                Try Now
              </Link>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-green-200 dark:border-green-700">
            <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
              Grammar & Style Checker
            </h3>
            <p className="text-green-700 dark:text-green-200 mb-4">
              Fix grammar errors and improve your writing style with AI-powered suggestions.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600 dark:text-green-300">
                🆓 Free
              </span>
              <Link to="/tools/grammar-check" className="btn bg-green-600 text-white hover:bg-green-700">
                Try Now
              </Link>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Blog Post Generator
            </h3>
            <p className="text-blue-700 dark:text-blue-200 mb-4">
              Generate structured, SEO-friendly blog posts quickly from a topic and target audience.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-600 dark:text-blue-300">
                ⭐ Pro
              </span>
              <Link to="/tools/blog-post-generator" className="btn bg-blue-600 text-white hover:bg-blue-700">
                Try Now
              </Link>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-800 border-indigo-200 dark:border-indigo-700">
            <h3 className="text-xl font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
              Code Generator
            </h3>
            <p className="text-indigo-700 dark:text-indigo-200 mb-4">
              Generate production-ready code snippets with explanations and test scaffolds.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-indigo-600 dark:text-indigo-300">
                ⭐ Pro
              </span>
              <Link to="/tools/code-generator" className="btn bg-indigo-600 text-white hover:bg-indigo-700">
                Try Now
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Looking for external tools?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Explore Prepza, Logiforge, Vixora, and Slideo in the new Marketplace.
            </p>
          </div>
          <Link to="/marketplace" className="btn bg-indigo-600 text-white hover:bg-indigo-700">
            Open Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;