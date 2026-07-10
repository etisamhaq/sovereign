import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { toast } from 'react-hot-toast';
import { CalendarIcon, ClockIcon, HashtagIcon, PhotoIcon, DocumentTextIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface CalendarDay {
  day: number;
  date: string;
  hook: string;
  caption: string;
  hashtags: string[];
  design_prompt: string;
  posting_times: {
    instagram: string;
    tiktok: string;
    linkedin: string;
    twitter: string;
  };
}

interface CalendarResult {
  business_name: string;
  business_type: string;
  target_audience: string;
  content_themes: string[];
  calendar: CalendarDay[];
}

const ContentCalendarTool: React.FC = () => {
  const [businessDescription, setBusinessDescription] = useState('');
  const [result, setResult] = useState<CalendarResult | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  const generateMutation = useMutation({
    mutationFn: async (data: { business_description: string }) => {
      return apiClient.post('/tools/content-calendar/', data);
    },
    onSuccess: (data: any) => {
      console.log('Response data:', data); // Debug log
      
      // Check if there's an error in the result
      if (data.result?.error || data.error) {
        toast.error(data.result?.error || data.error || 'Failed to generate calendar. Please try again.');
        console.error('Calendar generation error:', data);
      } else if (data.result?.calendar && Array.isArray(data.result.calendar)) {
        // Verify the result has the expected structure
        setResult(data.result);
        toast.success('Content calendar generated successfully!');
      } else {
        // Handle unexpected response structure
        toast.error('Received invalid calendar data. Please try again.');
        console.error('Invalid response structure:', data);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate calendar');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessDescription.trim()) {
      toast.error('Please enter a business description');
      return;
    }
    generateMutation.mutate({ business_description: businessDescription });
  };

  const toggleDay = (day: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  const exportCalendar = () => {
    if (!result) return;

    const csvContent = [
      ['Day', 'Hook', 'Caption', 'Hashtags', 'Design Prompt', 'Instagram', 'TikTok', 'LinkedIn', 'Twitter'],
      ...result.calendar.map(day => [
        day.day,
        day.hook,
        day.caption,
        day.hashtags.join(' '),
        day.design_prompt,
        day.posting_times.instagram,
        day.posting_times.tiktok,
        day.posting_times.linkedin,
        day.posting_times.twitter
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-calendar-${result.business_name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Calendar exported successfully!');
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Social Media Content Calendar Generator
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Generate a complete 30-day content strategy with engaging hooks, captions, hashtags, and optimal posting times for all major social platforms.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="mb-10 max-w-3xl mx-auto">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <label htmlFor="business" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Describe Your Business
            </label>
            <div className="relative">
              <input
                id="business"
                type="text"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="e.g., Organic coffee shop focusing on sustainability and community"
                className="w-full px-5 py-4 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                disabled={generateMutation.isPending}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <CalendarIcon className="h-6 w-6 text-gray-400" />
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter a brief description of your business, product, or service
            </p>
          </div>
          
          <div className="mt-6 text-center">
            <button
              type="submit"
              disabled={generateMutation.isPending || !businessDescription.trim()}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 transition-all transform hover:scale-105 shadow-lg"
            >
              {generateMutation.isPending ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Your Content Calendar...
                </span>
              ) : (
                'Generate 30-Day Content Calendar'
              )}
            </button>
          </div>
        </form>

        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Business Overview */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-xl text-gray-800 dark:text-white mb-4 flex items-center">
                <DocumentTextIcon className="h-6 w-6 mr-2 text-green-600 dark:text-green-400" />
                Business Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Business Name</span>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{result.business_name}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Business Type</span>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{result.business_type}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Target Audience</span>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{result.target_audience}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Content Themes</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.content_themes.map((theme, idx) => (
                      <span key={idx} className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-800 dark:text-white">Your Content Calendar</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">30 days of engaging social media content</p>
              </div>
              <button
                onClick={exportCalendar}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 shadow-md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to CSV
              </button>
            </div>

            {/* Calendar Days */}
            <div className="space-y-4">
              {result.calendar.map((day) => (
                <motion.div
                  key={day.day}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: day.day * 0.02 }}
                  className="border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm hover:shadow-md"
                >
                  <button
                    onClick={() => toggleDay(day.day)}
                    className="w-full px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-700 dark:hover:to-gray-800 transition-all flex items-center justify-between text-left"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <span className="font-bold text-blue-600 dark:text-blue-300">{day.day}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-lg">{day.hook}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Click to view full content</p>
                      </div>
                    </div>
                    <div className={`transform transition-transform ${expandedDays.has(day.day) ? 'rotate-180' : ''}`}>
                      <ChevronDownIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  </button>

                  {expandedDays.has(day.day) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-6 bg-white dark:bg-gray-800 space-y-6"
                    >
                      {/* Caption */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                        <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">
                          Post Caption
                        </h4>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{day.caption}</p>
                      </div>

                      {/* Hashtags */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                          <HashtagIcon className="h-5 w-5 mr-2 text-purple-500" /> Hashtags
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {day.hashtags.map((tag, idx) => (
                            <span key={idx} className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors cursor-pointer">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Design Prompt */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                          <PhotoIcon className="h-5 w-5 mr-2 text-yellow-500" /> Visual Content Idea
                        </h4>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800">
                          <p className="text-gray-800 dark:text-gray-200">{day.design_prompt}</p>
                        </div>
                      </div>

                      {/* Posting Times */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                          <ClockIcon className="h-5 w-5 mr-2 text-green-500" /> Optimal Posting Times
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/20 dark:to-purple-900/20 p-3 rounded-lg border border-pink-200 dark:border-pink-800">
                            <p className="font-medium text-xs text-gray-600 dark:text-gray-400">Instagram</p>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white mt-1">{day.posting_times.instagram}</p>
                          </div>
                          <div className="bg-gradient-to-br from-gray-100 to-black/5 dark:from-gray-900/20 dark:to-black/20 p-3 rounded-lg border border-gray-300 dark:border-gray-700">
                            <p className="font-medium text-xs text-gray-600 dark:text-gray-400">TikTok</p>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white mt-1">{day.posting_times.tiktok}</p>
                          </div>
                          <div className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-lg border border-blue-300 dark:border-blue-700">
                            <p className="font-medium text-xs text-gray-600 dark:text-gray-400">LinkedIn</p>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white mt-1">{day.posting_times.linkedin}</p>
                          </div>
                          <div className="bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/20 dark:to-blue-900/20 p-3 rounded-lg border border-sky-300 dark:border-sky-700">
                            <p className="font-medium text-xs text-gray-600 dark:text-gray-400">Twitter</p>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white mt-1">{day.posting_times.twitter}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ContentCalendarTool;