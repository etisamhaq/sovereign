import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  MagnifyingGlassIcon,
  NewspaperIcon,
  AcademicCapIcon,
  GlobeAltIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  ClockIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

interface ResearchAssistantProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const ResearchAssistant: React.FC<ResearchAssistantProps> = ({
  tool,
  isProcessing,
  setIsProcessing,
}) => {
  const [topic, setTopic] = useState('');
  const [depthLevel, setDepthLevel] = useState('standard');
  const [maxSources, setMaxSources] = useState(10);
  const [includeAcademic, setIncludeAcademic] = useState(true);
  const [includeNews, setIncludeNews] = useState(true);
  const [includeWeb, setIncludeWeb] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [researchData, setResearchData] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    sources: false,
    facts: false,
    knowledge: false,
  });
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleExpandSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const startResearch = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a research topic');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post<any>('/tools/research-assistant/', {
        topic,
        depth_level: depthLevel,
        max_sources: maxSources,
        include_academic: includeAcademic,
        include_news: includeNews,
        include_web: includeWeb,
      });

      if (response.project_id) {
        setProjectId(response.project_id);
        setProjectStatus('processing');
        toast.success('Research started! We\'ll notify you when it\'s complete.');
        
        // Start polling for results
        const interval = setInterval(() => {
          checkResearchStatus(response.project_id);
        }, 5000); // Check every 5 seconds
        setPollingInterval(interval);
      }
    } catch (error: any) {
      console.error('Research error:', error);
      toast.error(error.response?.data?.error || 'Failed to start research');
    } finally {
      setIsProcessing(false);
    }
  };

  const checkResearchStatus = async (projectId: string) => {
    try {
      const project = await apiClient.get<any>(`/research/projects/${projectId}/`);
      
      setProjectStatus(project.status);
      
      if (project.status === 'completed') {
        setResearchData(project);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        toast.success('Research completed!');
      } else if (project.status === 'failed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        toast.error('Research failed. Please try again.');
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  const exportResearch = async (format: string) => {
    if (!projectId) return;

    try {
      const response = await apiClient.get<Blob>(`/research/projects/${projectId}/export/`, {
        params: { format },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `research_${topic.replace(/\s+/g, '_')}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`Research exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export research');
    }
  };

  return (
    <div className="card">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {tool.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {tool.description}
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Research Topic
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter a topic to research..."
            disabled={isProcessing || projectStatus === 'processing'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="depth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Research Depth
            </label>
            <select
              id="depth"
              value={depthLevel}
              onChange={(e) => setDepthLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={isProcessing || projectStatus === 'processing'}
            >
              <option value="quick">Quick Overview</option>
              <option value="standard">Standard Research</option>
              <option value="comprehensive">Comprehensive Analysis</option>
            </select>
          </div>

          <div>
            <label htmlFor="sources" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Maximum Sources
            </label>
            <input
              id="sources"
              type="number"
              value={maxSources}
              onChange={(e) => setMaxSources(parseInt(e.target.value))}
              min={5}
              max={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={isProcessing || projectStatus === 'processing'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Types
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeAcademic}
                  onChange={(e) => setIncludeAcademic(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={isProcessing || projectStatus === 'processing'}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex items-center">
                  <AcademicCapIcon className="h-4 w-4 mr-1" />
                  Academic
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeNews}
                  onChange={(e) => setIncludeNews(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={isProcessing || projectStatus === 'processing'}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex items-center">
                  <NewspaperIcon className="h-4 w-4 mr-1" />
                  News
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeWeb}
                  onChange={(e) => setIncludeWeb(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={isProcessing || projectStatus === 'processing'}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex items-center">
                  <GlobeAltIcon className="h-4 w-4 mr-1" />
                  Web
                </span>
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={startResearch}
          disabled={isProcessing || projectStatus === 'processing' || !topic.trim()}
          className="w-full btn btn-primary flex items-center justify-center"
        >
          {projectStatus === 'processing' ? (
            <>
              <ClockIcon className="animate-spin h-5 w-5 mr-2" />
              Research in Progress...
            </>
          ) : (
            <>
              <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
              Start Research
            </>
          )}
        </button>

        {projectStatus === 'processing' && (
          <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
            <div className="flex items-center">
              <ClockIcon className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Analyzing sources and building knowledge graph... This may take a few minutes.
              </p>
            </div>
          </div>
        )}
      </div>

      {researchData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Research Results
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => exportResearch('pdf')}
                className="btn btn-secondary btn-sm flex items-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                PDF
              </button>
              <button
                onClick={() => exportResearch('docx')}
                className="btn btn-secondary btn-sm flex items-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Word
              </button>
              <button
                onClick={() => exportResearch('markdown')}
                className="btn btn-secondary btn-sm flex items-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Markdown
              </button>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleExpandSection('summary')}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Executive Summary
              </h3>
              {expandedSections.summary ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSections.summary && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-gray-700 dark:text-gray-300">
                  {researchData.summary}
                </p>
              </div>
            )}
          </div>

          {/* Sources */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleExpandSection('sources')}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sources ({researchData.sources?.length || 0})
              </h3>
              {expandedSections.sources ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSections.sources && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                {researchData.sources?.map((source: any) => (
                  <div key={source.id} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {source.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {source.summary}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {source.source_type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Credibility: {source.credibility_score}/10
                      </span>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 flex items-center"
                      >
                        <LinkIcon className="h-3 w-3 mr-1" />
                        View Source
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Key Facts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleExpandSection('facts')}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Key Facts ({researchData.facts?.length || 0})
              </h3>
              {expandedSections.facts ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSections.facts && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <ul className="space-y-3">
                  {researchData.facts?.map((fact: any) => (
                    <li key={fact.id} className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-gray-700 dark:text-gray-300">{fact.fact_text}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Confidence: {fact.confidence_score}/10
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Knowledge Graph Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleExpandSection('knowledge')}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Knowledge Graph
              </h3>
              {expandedSections.knowledge ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSections.knowledge && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {researchData.knowledge_nodes?.length || 0}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Concepts Identified
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {researchData.knowledge_edges?.length || 0}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Relationships Found
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                  The knowledge graph connects key concepts and their relationships
                  discovered during research.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ResearchAssistant;