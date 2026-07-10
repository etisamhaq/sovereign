import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { toast } from 'react-hot-toast';
import {
  MapIcon,
  AcademicCapIcon,
  ClockIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  ArrowDownTrayIcon,
  BookmarkIcon,
  FlagIcon,
  ExclamationTriangleIcon,
  BriefcaseIcon,
  SparklesIcon,
  ArrowPathIcon,
  TrashIcon,
  HeartIcon,
  EyeIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon,
  CheckCircleIcon as CheckCircleSolidIcon,
  StarIcon as StarSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
} from '@heroicons/react/24/solid';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Resource {
  title: string;
  type: string;
  url?: string;
  description: string;
  isFree?: boolean;
}

interface Topic {
  name: string;
  description: string;
  estimatedHours: number;
  priority: string;
  resources: Resource[];
}

interface MilestoneProject {
  title: string;
  description: string;
  skills: string[];
}

interface Phase {
  phaseNumber: number;
  title: string;
  duration: string;
  hours: number;
  description: string;
  learningObjectives: string[];
  topics: Topic[];
  milestoneProject: MilestoneProject;
  checkpoints: string[];
}

interface WeeklySchedule {
  hoursPerWeek: number;
  suggestedBreakdown: Array<{ activity: string; hours: number }>;
}

interface Challenge {
  challenge: string;
  solution: string;
}

interface CareerOutlook {
  roles: string[];
  salaryRange: string;
  demand: string;
  description: string;
}

interface RoadmapData {
  title: string;
  overview: string;
  estimatedDuration: string;
  totalHours: number;
  skillLevel: string;
  phases: Phase[];
  weeklySchedule: WeeklySchedule;
  tips: string[];
  potentialChallenges: Challenge[];
  careerOutlook?: CareerOutlook;
}

interface SavedRoadmap {
  id: string;
  title: string;
  goal: string;
  skill_level: string;
  total_phases: number;
  completed_phases: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  roadmap_data?: RoadmapData;
  phase_progress?: Record<string, boolean>;
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const ResourceBadge: React.FC<{ type: string }> = ({ type }) => {
  const colors: Record<string, string> = {
    video: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    book: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    course: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    project: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    article: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    documentation: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || colors.documentation}`}>
      {type}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    essential: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-700',
    recommended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700',
    optional: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 ring-1 ring-gray-300 dark:ring-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[priority] || colors.optional}`}>
      {priority}
    </span>
  );
};

const ProgressRing: React.FC<{ percent: number; size?: number }> = ({ percent, size = 56 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4}
              className="text-gray-200 dark:text-gray-700" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4}
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              className="text-indigo-500 transition-all duration-700" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
            className="text-xs font-bold fill-current text-gray-700 dark:text-gray-200"
            transform={`rotate(90 ${size / 2} ${size / 2})`}>
        {percent}%
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const RoadmapBuilder: React.FC = () => {
  const queryClient = useQueryClient();
  const resultRef = useRef<HTMLDivElement>(null);

  /* ---- Form state ---- */
  const [formData, setFormData] = useState({
    goal: '',
    skill_level: 'beginner',
    hours_per_week: 10,
    preferred_style: 'mixed',
    timeline: '',
    constraints: '',
  });

  /* ---- Result state ---- */
  const [result, setResult] = useState<RoadmapData | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'roadmap' | 'schedule' | 'tips' | 'career'>('roadmap');
  const [showSaved, setShowSaved] = useState(false);
  const [loadedRoadmapId, setLoadedRoadmapId] = useState<string | null>(null);

  /* ---- API Mutations ---- */
  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiClient.post('/tools/roadmap-builder/', data);
    },
    onSuccess: (data: any) => {
      if (data.result?.error) {
        toast.error(data.result.error || 'Failed to generate roadmap');
      } else if (data.result?.phases && Array.isArray(data.result.phases)) {
        setResult(data.result);
        setExpandedPhases(new Set([1]));
        setCompletedPhases(new Set());
        setLoadedRoadmapId(null);
        toast.success('Roadmap generated successfully!');
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      } else {
        toast.error('Invalid response format. Please try again.');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate roadmap');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (roadmapData: RoadmapData) => {
      return apiClient.post('/tools/roadmap-builder/saved/', { roadmap_data: roadmapData });
    },
    onSuccess: (data: any) => {
      setLoadedRoadmapId(data.id);
      toast.success('Roadmap saved!');
      queryClient.invalidateQueries({ queryKey: ['saved-roadmaps'] });
    },
    onError: () => toast.error('Failed to save roadmap'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/tools/roadmap-builder/saved/${id}/`),
    onSuccess: () => {
      toast.success('Roadmap deleted');
      queryClient.invalidateQueries({ queryKey: ['saved-roadmaps'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const toggleFavMutation = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) =>
      apiClient.patch(`/tools/roadmap-builder/saved/${id}/`, { is_favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-roadmaps'] }),
  });

  /* ---- Saved roadmaps query ---- */
  const { data: savedRoadmaps = [] } = useQuery<SavedRoadmap[]>({
    queryKey: ['saved-roadmaps'],
    queryFn: () => apiClient.get('/tools/roadmap-builder/saved/'),
    enabled: showSaved,
  });

  /* ---- Handlers ---- */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.goal.trim()) {
      toast.error('Please enter a learning goal');
      return;
    }
    generateMutation.mutate(formData);
  };

  const togglePhase = (num: number) => {
    const s = new Set(expandedPhases);
    s.has(num) ? s.delete(num) : s.add(num);
    setExpandedPhases(s);
  };

  const togglePhaseComplete = (num: number) => {
    const s = new Set(completedPhases);
    s.has(num) ? s.delete(num) : s.add(num);
    setCompletedPhases(s);

    // Persist if we have a loaded roadmap
    if (loadedRoadmapId) {
      const progress: Record<string, boolean> = {};
      s.forEach((n) => { progress[String(n)] = true; });
      apiClient.patch(`/tools/roadmap-builder/saved/${loadedRoadmapId}/`, {
        completed_phases: s.size,
        phase_progress: progress,
      });
    }
  };

  const loadSavedRoadmap = async (id: string) => {
    try {
      const data: any = await apiClient.get(`/tools/roadmap-builder/saved/${id}/`);
      if (data.roadmap_data) {
        setResult(data.roadmap_data);
        setLoadedRoadmapId(id);
        const prog = data.phase_progress || {};
        const completed = new Set<number>();
        Object.entries(prog).forEach(([k, v]) => { if (v) completed.add(Number(k)); });
        setCompletedPhases(completed);
        setExpandedPhases(new Set([1]));
        setShowSaved(false);
        toast.success('Roadmap loaded!');
      }
    } catch {
      toast.error('Failed to load roadmap');
    }
  };

  const exportRoadmap = () => {
    if (!result) return;
    const md = generateMarkdown(result);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.title.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Roadmap exported as Markdown!');
  };

  const progressPercent = result
    ? Math.round((completedPhases.size / result.phases.length) * 100)
    : 0;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* -------- Header -------- */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Hero gradient header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-10 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-30" />
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
              <MapIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">
              AI Roadmap Builder
            </h2>
            <p className="text-lg text-indigo-100 max-w-2xl mx-auto">
              Tell us what you want to learn and we'll create a personalized, phase-by-phase roadmap with curated resources, milestone projects, and progress tracking.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {/* -------- Saved roadmaps toggle -------- */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <BookmarkIcon className="h-4 w-4" />
              {showSaved ? 'Hide' : 'My Saved Roadmaps'}
              {!showSaved && savedRoadmaps.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-500 rounded-full">
                  {savedRoadmaps.length}
                </span>
              )}
            </button>
          </div>

          {/* -------- Saved roadmaps list -------- */}
          <AnimatePresence>
            {showSaved && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-8">
                {savedRoadmaps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <BookmarkIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>No saved roadmaps yet. Generate one and save it!</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {(savedRoadmaps as SavedRoadmap[]).map((rm) => (
                      <div key={rm.id}
                           className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <ProgressRing percent={rm.total_phases > 0 ? Math.round((rm.completed_phases / rm.total_phases) * 100) : 0} size={48} />
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white truncate">{rm.title}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {rm.completed_phases}/{rm.total_phases} phases • {new Date(rm.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button onClick={() => toggleFavMutation.mutate({ id: rm.id, is_favorite: !rm.is_favorite })}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            {rm.is_favorite
                              ? <HeartSolidIcon className="h-5 w-5 text-pink-500" />
                              : <HeartIcon className="h-5 w-5 text-gray-400" />}
                          </button>
                          <button onClick={() => loadSavedRoadmap(rm.id)}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-indigo-600 dark:text-indigo-400">
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => { if (window.confirm('Delete this roadmap?')) deleteMutation.mutate(rm.id); }}
                                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500">
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ============================================================ */}
          {/*  INPUT FORM                                                   */}
          {/* ============================================================ */}
          <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto mb-8">
            {/* Learning Goal */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <RocketLaunchIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
                What do you want to learn? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                placeholder="e.g., Full-stack web development with React and Node.js"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                disabled={generateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Skill Level */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <AcademicCapIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
                  Skill Level
                </label>
                <select
                  value={formData.skill_level}
                  onChange={(e) => setFormData({ ...formData, skill_level: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                  disabled={generateMutation.isPending}
                >
                  <option value="beginner">🌱 Beginner</option>
                  <option value="intermediate">🌿 Intermediate</option>
                  <option value="advanced">🌳 Advanced</option>
                </select>
              </div>

              {/* Hours per Week */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <ClockIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
                  Hours / Week
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={formData.hours_per_week}
                    onChange={(e) => setFormData({ ...formData, hours_per_week: Math.max(1, Math.min(80, Number(e.target.value))) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                    disabled={generateMutation.isPending}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">hrs</span>
                </div>
              </div>

              {/* Preferred Style */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <BookOpenIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
                  Learning Style
                </label>
                <select
                  value={formData.preferred_style}
                  onChange={(e) => setFormData({ ...formData, preferred_style: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                  disabled={generateMutation.isPending}
                >
                  <option value="videos">🎬 Video Tutorials</option>
                  <option value="books">📚 Books & Reading</option>
                  <option value="projects">🛠️ Hands-on Projects</option>
                  <option value="mixed">🔄 Mixed (Recommended)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Timeline */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Target Timeline (Optional)
                </label>
                <input
                  type="text"
                  value={formData.timeline}
                  onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                  placeholder="e.g., 6 months, 1 year"
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                  disabled={generateMutation.isPending}
                />
              </div>

              {/* Constraints */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Constraints / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formData.constraints}
                  onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
                  placeholder="e.g., Free resources only, focus on backend"
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                  disabled={generateMutation.isPending}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="text-center pt-2">
              <button
                type="submit"
                disabled={generateMutation.isPending || !formData.goal.trim()}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {generateMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Building Your Roadmap...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-6 w-6" />
                    Generate My Roadmap
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ============================================================ */}
          {/*  RESULT                                                       */}
          {/* ============================================================ */}
          {result && (
            <motion.div ref={resultRef} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }} className="mt-4">
              {/* Title & actions bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{result.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{result.overview}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ProgressRing percent={progressPercent} />
                  <div className="flex gap-2">
                    <button onClick={exportRoadmap}
                            className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Export as Markdown">
                      <ArrowDownTrayIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <button onClick={() => result && saveMutation.mutate(result)}
                            disabled={saveMutation.isPending}
                            className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                            title="Save roadmap">
                      <BookmarkSolidIcon className={`h-5 w-5 ${loadedRoadmapId ? 'text-indigo-500' : 'text-indigo-400'}`} />
                    </button>
                    <button onClick={() => generateMutation.mutate(formData)}
                            disabled={generateMutation.isPending}
                            className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Regenerate">
                      <ArrowPathIcon className={`h-5 w-5 text-gray-600 dark:text-gray-300 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Duration', value: result.estimatedDuration, icon: ClockIcon, color: 'indigo' },
                  { label: 'Total Hours', value: `${result.totalHours}h`, icon: BookOpenIcon, color: 'purple' },
                  { label: 'Phases', value: String(result.phases.length), icon: FlagIcon, color: 'pink' },
                  { label: 'Level', value: result.skillLevel, icon: AcademicCapIcon, color: 'amber' },
                ].map((stat) => (
                  <div key={stat.label}
                       className={`p-4 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 border border-${stat.color}-200 dark:border-${stat.color}-800`}>
                    <stat.icon className={`h-5 w-5 text-${stat.color}-500 mb-1`} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 mb-8 bg-gray-100 dark:bg-gray-700/50 rounded-xl overflow-x-auto">
                {[
                  { id: 'roadmap' as const, label: 'Roadmap', icon: MapIcon },
                  { id: 'schedule' as const, label: 'Weekly Schedule', icon: ClockIcon },
                  { id: 'tips' as const, label: 'Tips & Challenges', icon: LightBulbIcon },
                  { id: 'career' as const, label: 'Career Outlook', icon: BriefcaseIcon },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                            activeTab === tab.id
                              ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}>
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ---- Roadmap Tab ---- */}
              {activeTab === 'roadmap' && (
                <div className="space-y-4">
                  {result.phases.map((phase) => {
                    const isExpanded = expandedPhases.has(phase.phaseNumber);
                    const isDone = completedPhases.has(phase.phaseNumber);
                    return (
                      <motion.div key={phase.phaseNumber} layout
                                  className={`border-2 rounded-2xl overflow-hidden transition-colors ${
                                    isDone
                                      ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                  }`}>
                        {/* Phase header */}
                        <div className="flex items-center justify-between p-5 cursor-pointer select-none"
                             onClick={() => togglePhase(phase.phaseNumber)}>
                          <div className="flex items-center gap-4 min-w-0">
                            <button onClick={(e) => { e.stopPropagation(); togglePhaseComplete(phase.phaseNumber); }}
                                    className="flex-shrink-0">
                              {isDone
                                ? <CheckCircleSolidIcon className="h-7 w-7 text-green-500" />
                                : <CheckCircleIcon className="h-7 w-7 text-gray-300 dark:text-gray-600 hover:text-green-400 transition-colors" />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-bold flex-shrink-0">
                                  {phase.phaseNumber}
                                </span>
                                <h4 className={`text-lg font-bold truncate ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                  {phase.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />{phase.duration}</span>
                                <span className="flex items-center gap-1"><BookOpenIcon className="h-3.5 w-3.5" />{phase.hours}h</span>
                                <span className="flex items-center gap-1">{phase.topics.length} topics</span>
                              </div>
                            </div>
                          </div>
                          {isExpanded
                            ? <ChevronUpIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            : <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                        </div>

                        {/* Phase content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                                        className="overflow-hidden">
                              <div className="px-5 pb-6 border-t border-gray-100 dark:border-gray-700/50 pt-5 space-y-6">
                                {/* Description */}
                                <p className="text-gray-600 dark:text-gray-400">{phase.description}</p>

                                {/* Learning Objectives */}
                                {phase.learningObjectives?.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                                      <FlagIcon className="h-4 w-4 text-indigo-500" /> Learning Objectives
                                    </h5>
                                    <ul className="grid gap-1.5">
                                      {phase.learningObjectives.map((obj, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                          <CheckIcon className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                                          {obj}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Topics */}
                                <div>
                                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                                    <BookOpenIcon className="h-4 w-4 text-purple-500" /> Topics
                                  </h5>
                                  <div className="space-y-4">
                                    {phase.topics.map((topic, ti) => (
                                      <div key={ti} className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                          <div>
                                            <h6 className="font-semibold text-gray-900 dark:text-white">{topic.name}</h6>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{topic.description}</p>
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <PriorityBadge priority={topic.priority} />
                                            <span className="text-xs text-gray-400 whitespace-nowrap">{topic.estimatedHours}h</span>
                                          </div>
                                        </div>

                                        {/* Resources */}
                                        {topic.resources?.length > 0 && (
                                          <div className="mt-3 space-y-2">
                                            {topic.resources.map((res, ri) => (
                                              <div key={ri} className="flex items-start gap-3 p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-600/50">
                                                <ResourceBadge type={res.type} />
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-2">
                                                    {res.url ? (
                                                      <a href={res.url} target="_blank" rel="noopener noreferrer"
                                                         className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                                                        {res.title}
                                                      </a>
                                                    ) : (
                                                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                        {res.title}
                                                      </span>
                                                    )}
                                                    {res.isFree && (
                                                      <span className="px-1.5 py-0.5 text-[10px] font-bold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 rounded">
                                                        FREE
                                                      </span>
                                                    )}
                                                  </div>
                                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{res.description}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Milestone Project */}
                                {phase.milestoneProject && (
                                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                    <h5 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                                      <RocketLaunchIcon className="h-4 w-4" /> Milestone Project
                                    </h5>
                                    <h6 className="font-bold text-gray-900 dark:text-white">{phase.milestoneProject.title}</h6>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{phase.milestoneProject.description}</p>
                                    {phase.milestoneProject.skills?.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {phase.milestoneProject.skills.map((skill, si) => (
                                          <span key={si} className="px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-800/50 rounded-full">
                                            {skill}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Checkpoints */}
                                {phase.checkpoints?.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                                      <CheckCircleIcon className="h-4 w-4 text-green-500" /> Self-Check
                                    </h5>
                                    <ul className="grid gap-1.5">
                                      {phase.checkpoints.map((cp, ci) => (
                                        <li key={ci} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                          <span className="mt-1 w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                                          {cp}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ---- Schedule Tab ---- */}
              {activeTab === 'schedule' && result.weeklySchedule && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-indigo-500" />
                    Suggested Weekly Schedule ({result.weeklySchedule.hoursPerWeek}h/week)
                  </h4>
                  <div className="space-y-3">
                    {result.weeklySchedule.suggestedBreakdown?.map((item, i) => {
                      const pct = (item.hours / result.weeklySchedule.hoursPerWeek) * 100;
                      const colors = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-teal-500'];
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.activity}</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{item.hours}h</span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.8, delay: i * 0.15 }}
                                        className={`h-full rounded-full ${colors[i % colors.length]}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ---- Tips & Challenges Tab ---- */}
              {activeTab === 'tips' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Tips */}
                  {result.tips?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5 text-amber-500" />
                        Pro Tips
                      </h4>
                      <div className="grid gap-3">
                        {result.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                            <StarSolidIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700 dark:text-gray-300">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Challenges */}
                  {result.potentialChallenges?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                        Potential Challenges
                      </h4>
                      <div className="grid gap-3">
                        {result.potentialChallenges.map((ch, i) => (
                          <div key={i} className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800/30">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{ch.challenge}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <span className="font-medium text-green-600 dark:text-green-400">Solution: </span>
                              {ch.solution}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ---- Career Tab ---- */}
              {activeTab === 'career' && result.careerOutlook && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BriefcaseIcon className="h-5 w-5 text-indigo-500" />
                    Career Outlook
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{result.careerOutlook.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Potential Roles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.careerOutlook.roles?.map((role, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-800/50 rounded-full">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Salary Range</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{result.careerOutlook.salaryRange}</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Market Demand</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">{result.careerOutlook.demand}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Markdown export helper                                             */
/* ------------------------------------------------------------------ */

function generateMarkdown(r: RoadmapData): string {
  let md = `# ${r.title}\n\n`;
  md += `> ${r.overview}\n\n`;
  md += `**Duration:** ${r.estimatedDuration} | **Total Hours:** ${r.totalHours}h | **Level:** ${r.skillLevel}\n\n`;
  md += `---\n\n`;

  r.phases.forEach((p) => {
    md += `## Phase ${p.phaseNumber}: ${p.title}\n`;
    md += `*${p.duration} • ${p.hours} hours*\n\n`;
    md += `${p.description}\n\n`;

    if (p.learningObjectives?.length) {
      md += `### Learning Objectives\n`;
      p.learningObjectives.forEach((o) => { md += `- ${o}\n`; });
      md += `\n`;
    }

    p.topics.forEach((t) => {
      md += `### ${t.name} (${t.estimatedHours}h) — *${t.priority}*\n`;
      md += `${t.description}\n\n`;
      if (t.resources?.length) {
        md += `**Resources:**\n`;
        t.resources.forEach((res) => {
          const link = res.url ? `[${res.title}](${res.url})` : res.title;
          md += `- ${link} (${res.type})${res.isFree ? ' — FREE' : ''}: ${res.description}\n`;
        });
        md += `\n`;
      }
    });

    if (p.milestoneProject) {
      md += `### 🚀 Milestone Project: ${p.milestoneProject.title}\n`;
      md += `${p.milestoneProject.description}\n`;
      if (p.milestoneProject.skills?.length) {
        md += `\nSkills: ${p.milestoneProject.skills.join(', ')}\n`;
      }
      md += `\n`;
    }

    if (p.checkpoints?.length) {
      md += `### ✅ Self-Check\n`;
      p.checkpoints.forEach((c) => { md += `- [ ] ${c}\n`; });
      md += `\n`;
    }

    md += `---\n\n`;
  });

  if (r.weeklySchedule) {
    md += `## Weekly Schedule (${r.weeklySchedule.hoursPerWeek}h/week)\n`;
    r.weeklySchedule.suggestedBreakdown?.forEach((s) => {
      md += `- **${s.activity}**: ${s.hours}h\n`;
    });
    md += `\n`;
  }

  if (r.tips?.length) {
    md += `## Pro Tips\n`;
    r.tips.forEach((t) => { md += `- 💡 ${t}\n`; });
    md += `\n`;
  }

  if (r.potentialChallenges?.length) {
    md += `## Potential Challenges\n`;
    r.potentialChallenges.forEach((c) => {
      md += `- **${c.challenge}** — ${c.solution}\n`;
    });
    md += `\n`;
  }

  if (r.careerOutlook) {
    md += `## Career Outlook\n`;
    md += `${r.careerOutlook.description}\n\n`;
    md += `- **Roles**: ${r.careerOutlook.roles?.join(', ')}\n`;
    md += `- **Salary Range**: ${r.careerOutlook.salaryRange}\n`;
    md += `- **Demand**: ${r.careerOutlook.demand}\n`;
  }

  return md;
}

export default RoadmapBuilder;
