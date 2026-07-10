import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';
import { PERSONAS, personaColors, getPersonaById } from '../config/personas';
import { getToolIcon } from '../utils/toolIcons';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  icon: string;
  is_premium: boolean;
  usage_count: number;
}

const ForPersonaPage: React.FC = () => {
  const { personaId } = useParams<{ personaId: string }>();
  const { isAuthenticated } = useAuthStore();
  const persona = getPersonaById(personaId || '');

  usePageTitle(
    persona ? `AI Tools for ${persona.label}` : 'AI Tools',
    persona?.description
  );

  const { data: toolsRaw, isLoading } = useQuery({
    queryKey: ['tools-all'],
    queryFn: () => apiClient.get('/tools/'),
    staleTime: 60000,
  });

  // If persona doesn't exist, redirect to home
  if (!persona) {
    return <Navigate to="/" replace />;
  }

  const colors = personaColors[persona.color] || personaColors.blue;
  const allTools: Tool[] = Array.isArray(toolsRaw) ? toolsRaw : (toolsRaw as any)?.results ?? [];

  // Get persona tools in the defined order, then remaining tools
  const personaTools = persona.toolSlugs
    .map((slug) => allTools.find((t) => t.slug === slug))
    .filter(Boolean) as Tool[];

  const otherTools = allTools.filter((t) => !persona.toolSlugs.includes(t.slug));

  // SEO structured data
  const personaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `AI Tools for ${persona.label} — Sovereign`,
    description: persona.description,
    url: `https://sovereign.com/for/${persona.id}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: personaTools.length,
      itemListElement: personaTools.map((tool, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: tool.name,
        url: `https://sovereign.com/tool/${tool.slug}`,
      })),
    },
  };

  return (
    <div className="relative">
      <SEOHead
        title={`AI Tools for ${persona.label}`}
        description={`${persona.description} Discover ${personaTools.length}+ curated AI tools — free to try, just $5/month for unlimited access.`}
        canonical={`/for/${persona.id}`}
        keywords={`AI tools for ${persona.label.toLowerCase()}, ${persona.toolSlugs.slice(0, 5).join(', ')}, Sovereign`}
        jsonLd={[
          personaJsonLd,
          breadcrumbJsonLd([
            { name: 'Home', url: 'https://sovereign.com' },
            { name: `AI Tools for ${persona.label}`, url: `https://sovereign.com/for/${persona.id}` },
          ]),
        ]}
      />

      {/* Hero Section */}
      <div className={`relative overflow-hidden ${colors.bg} border-b ${colors.border}`}>
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob bg-gradient-to-r ${colors.gradient}`}></div>
          <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob bg-gradient-to-r ${colors.gradient}`} style={{ animationDelay: '3s' }}></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="text-6xl mb-6">{persona.emoji}</div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
              AI Tools for{' '}
              <span className={`bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
                {persona.label}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-600 dark:text-gray-300">
              {persona.description}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={isAuthenticated ? `/tools?persona=${persona.id}` : `/register?redirect=${encodeURIComponent(`/tools?persona=${persona.id}`)}`}
                className={`group px-8 py-4 bg-gradient-to-r ${colors.gradient} text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200`}
              >
                <span className="flex items-center gap-2">
                  {isAuthenticated ? 'Open My Tools' : 'Get Started Free'}
                  <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <Link
                to="/pricing"
                className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700 transform hover:-translate-y-0.5 transition-all"
              >
                View Pricing
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                <span><strong>{personaTools.length}</strong> curated tools</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                <span><strong>{persona.workflows.length}</strong> ready-to-use workflows</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                <span>Free tier available</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Workflows Section */}
      <div className="py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Workflows</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              How {persona.label} Use Sovereign
            </p>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Common workflows that chain multiple AI tools together for maximum productivity.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {persona.workflows.map((workflow, wIndex) => (
              <motion.div
                key={workflow.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: wIndex * 0.1 }}
                viewport={{ once: true }}
                className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-gradient-to-r ${colors.gradient}`}>
                  <span className="text-white font-bold text-sm">{wIndex + 1}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {workflow.title}
                </h3>
                <div className="space-y-3">
                  {workflow.steps.map((step, sIndex) => (
                    <div key={step} className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colors.badge}`}>
                        {sIndex + 1}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{step}</span>
                      {sIndex < workflow.steps.length - 1 && (
                        <ArrowRightIcon className="w-3 h-3 text-gray-400 ml-auto flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Persona Tools Grid */}
      <div className="py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Recommended Tools</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Top Tools for {persona.label}
            </p>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              These tools are hand-picked for your workflow. Click any tool to learn more.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personaTools.map((tool, index) => (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  viewport={{ once: true }}
                >
                  <Link
                    to={`/tool/${tool.slug}`}
                    className={`block p-6 rounded-2xl border ${colors.border} bg-white dark:bg-gray-900 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 h-full`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                        {React.createElement(getToolIcon(tool.icon), { className: `w-6 h-6 ${colors.text}` })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {tool.name}
                          </h3>
                          {tool.is_premium ? (
                            <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                              Pro
                            </span>
                          ) : (
                            <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                              Free
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {tool.description}
                        </p>
                        {tool.usage_count > 0 && (
                          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            {tool.usage_count.toLocaleString()}+ uses
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {/* Show remaining tools */}
          {otherTools.length > 0 && (
            <div className="mt-16">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                More AI Tools
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                All {otherTools.length} additional tools are also available to you.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherTools.map((tool) => (
                  <Link
                    key={tool.id}
                    to={`/tool/${tool.slug}`}
                    className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      {React.createElement(getToolIcon(tool.icon), { className: 'w-4 h-4 text-gray-600 dark:text-gray-400' })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tool.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tool.description}</p>
                    </div>
                    {tool.is_premium ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">Pro</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">Free</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Why Sovereign Section */}
      <div className="py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Why {persona.label} Choose Sovereign
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BoltIcon, title: 'Instant Results', desc: 'Get AI-powered output in seconds, not minutes' },
              { icon: CurrencyDollarIcon, title: 'Just $5/month', desc: `All ${personaTools.length}+ recommended tools plus every other tool on the platform` },
              { icon: ShieldCheckIcon, title: 'Privacy First', desc: 'Your data is never stored or used for training' },
              { icon: SparklesIcon, title: 'Always Improving', desc: 'New tools and updates added every week' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${colors.gradient}`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Other Personas Cross-Links */}
      <div className="py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Not a {persona.label.replace(/s$/, '')}? Sovereign Works for Everyone
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {PERSONAS.filter((p) => p.id !== persona.id).map((p) => {
              const pColors = personaColors[p.color] || personaColors.blue;
              return (
                <Link
                  key={p.id}
                  to={`/for/${p.id}`}
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border ${pColors.border} ${pColors.bg} hover:shadow-md transition-all`}
                >
                  <span className="text-xl">{p.emoji}</span>
                  <span className={`font-medium ${pColors.text}`}>For {p.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className={`relative overflow-hidden px-6 py-20 sm:px-24 bg-gradient-to-r ${colors.gradient}`}>
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to Work Smarter?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-white/90">
          Join thousands of {persona.label.toLowerCase()} who use Sovereign to save hours every week.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            to={isAuthenticated ? `/tools?persona=${persona.id}` : `/register?redirect=${encodeURIComponent(`/tools?persona=${persona.id}`)}`}
            className="rounded-xl bg-white px-8 py-4 text-base font-semibold shadow-lg hover:bg-gray-100 transform hover:-translate-y-0.5 transition-all"
            style={{ color: 'inherit' }}
          >
            <span className="text-gray-900">{isAuthenticated ? 'Open My Tools' : 'Get Started Free'}</span>
          </Link>
          <Link
            to="/pricing"
            className="rounded-xl bg-white/10 backdrop-blur-md px-8 py-4 text-base font-semibold text-white border border-white/20 hover:bg-white/20 transform hover:-translate-y-0.5 transition-all"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForPersonaPage;
