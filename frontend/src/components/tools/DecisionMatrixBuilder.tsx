import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { toast } from 'react-hot-toast';
import {
  TableCellsIcon,
  PlusIcon,
  XMarkIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  BookmarkIcon,
  ArrowPathIcon,
  TrashIcon,
  HeartIcon,
  EyeIcon,
  CheckCircleIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
  TrophyIcon as TrophySolidIcon,
  StarIcon as StarSolidIcon,
} from '@heroicons/react/24/solid';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScoreDetail {
  score: number;
  reasoning: string;
}

interface MatrixEntry {
  option: string;
  scores: Record<string, ScoreDetail>;
  totalWeighted: number;
  normalizedScore: number;
}

interface Recommendation {
  winner: string;
  confidence: string;
  summary: string;
  runnerUp: string;
  runnerUpGap: number;
}

interface StrengthWeakness {
  option: string;
  strength?: string;
  weakness?: string;
}

interface Analysis {
  strengths: StrengthWeakness[];
  weaknesses: StrengthWeakness[];
  tradeoffs: string[];
}

interface SensitivityItem {
  scenario: string;
  newWinner: string;
  insight: string;
}

interface ProCon {
  option: string;
  pros: string[];
  cons: string[];
}

interface MatrixData {
  title: string;
  overview: string;
  options: string[];
  criteria: string[];
  weights: Record<string, number>;
  matrix: MatrixEntry[];
  recommendation: Recommendation;
  analysis: Analysis;
  sensitivityAnalysis: SensitivityItem[];
  prosAndCons: ProCon[];
  tips: string[];
}

interface SavedMatrix {
  id: string;
  title: string;
  topic: string;
  winner: string;
  options_count: number;
  criteria_count: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  matrix_data?: MatrixData;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const ScoreCell: React.FC<{ score: number; reasoning: string; max?: number }> = ({ score, reasoning, max = 10 }) => {
  const pct = (score / max) * 100;
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-blue-500' :
    pct >= 40 ? 'bg-amber-500' :
    'bg-red-500';
  const textColor =
    pct >= 80 ? 'text-emerald-700 dark:text-emerald-300' :
    pct >= 60 ? 'text-blue-700 dark:text-blue-300' :
    pct >= 40 ? 'text-amber-700 dark:text-amber-300' :
    'text-red-700 dark:text-red-300';

  return (
    <div className="group relative">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full ${color}`}
          />
        </div>
        <span className={`text-sm font-bold w-6 text-right ${textColor}`}>{score}</span>
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 w-52 shadow-xl">
        {reasoning}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
      </div>
    </div>
  );
};

const ConfidenceBadge: React.FC<{ confidence: string }> = ({ confidence }) => {
  const colors: Record<string, string> = {
    High: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700',
    Low: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[confidence] || colors.Medium}`}>
      {confidence} Confidence
    </span>
  );
};

const NormalizedBar: React.FC<{ score: number; isWinner: boolean; label: string }> = ({ score, isWinner, label }) => {
  const color = isWinner ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-400 to-purple-400';
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-28 truncate" title={label}>{label}</span>
      <div className="flex-1 h-7 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-lg ${color}`}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-white mix-blend-normal">
          {score}%
        </span>
      </div>
      {isWinner && <TrophySolidIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const DecisionMatrixBuilder: React.FC = () => {
  const queryClient = useQueryClient();
  const resultRef = useRef<HTMLDivElement>(null);

  /* ---- Form State ---- */
  const [topic, setTopic] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [criteria, setCriteria] = useState<string[]>(['', '']);
  const [weights, setWeights] = useState<number[]>([5, 5]);
  const [context, setContext] = useState('');

  /* ---- Result State ---- */
  const [result, setResult] = useState<MatrixData | null>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'analysis' | 'sensitivity' | 'proscons'>('matrix');
  const [showSaved, setShowSaved] = useState(false);
  const [loadedMatrixId, setLoadedMatrixId] = useState<string | null>(null);
  const [showReasonings, setShowReasonings] = useState(false);

  /* ---- Dynamic form helpers ---- */
  const addOption = () => { if (options.length < 8) { setOptions([...options, '']); } };
  const removeOption = (i: number) => { if (options.length > 2) { setOptions(options.filter((_, idx) => idx !== i)); } };
  const updateOption = (i: number, v: string) => { const n = [...options]; n[i] = v; setOptions(n); };

  const addCriterion = () => { if (criteria.length < 10) { setCriteria([...criteria, '']); setWeights([...weights, 5]); } };
  const removeCriterion = (i: number) => {
    if (criteria.length > 2) {
      setCriteria(criteria.filter((_, idx) => idx !== i));
      setWeights(weights.filter((_, idx) => idx !== i));
    }
  };
  const updateCriterion = (i: number, v: string) => { const n = [...criteria]; n[i] = v; setCriteria(n); };
  const updateWeight = (i: number, v: number) => { const n = [...weights]; n[i] = Math.max(1, Math.min(10, v)); setWeights(n); };

  /* ---- Sort matrix by score ---- */
  const sortedMatrix = useMemo(() => {
    if (!result?.matrix) return [];
    return [...result.matrix].sort((a, b) => b.normalizedScore - a.normalizedScore);
  }, [result]);

  /* ---- API Mutations ---- */
  const generateMutation = useMutation({
    mutationFn: async (data: { topic: string; options: string[]; criteria: string[]; weights: number[]; context: string }) => {
      return apiClient.post('/tools/decision-matrix-builder/', data);
    },
    onSuccess: (data: any) => {
      if (data.result?.error) {
        toast.error(data.result.error || 'Failed to generate matrix');
      } else if (data.result?.matrix && Array.isArray(data.result.matrix)) {
        setResult(data.result);
        setActiveTab('matrix');
        setLoadedMatrixId(null);
        toast.success('Decision matrix generated!');
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      } else {
        toast.error('Invalid response format. Please try again.');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate decision matrix');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (matrixData: MatrixData) => {
      return apiClient.post('/tools/decision-matrix-builder/saved/', { matrix_data: matrixData });
    },
    onSuccess: (data: any) => {
      setLoadedMatrixId(data.id);
      toast.success('Decision matrix saved!');
      queryClient.invalidateQueries({ queryKey: ['saved-matrices'] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/tools/decision-matrix-builder/saved/${id}/`),
    onSuccess: () => {
      toast.success('Deleted');
      queryClient.invalidateQueries({ queryKey: ['saved-matrices'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const toggleFavMutation = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) =>
      apiClient.patch(`/tools/decision-matrix-builder/saved/${id}/`, { is_favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-matrices'] }),
  });

  /* ---- Saved matrices query ---- */
  const { data: savedMatrices = [] } = useQuery<SavedMatrix[]>({
    queryKey: ['saved-matrices'],
    queryFn: () => apiClient.get('/tools/decision-matrix-builder/saved/'),
    enabled: showSaved,
  });

  /* ---- Handlers ---- */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = options.map(o => o.trim()).filter(Boolean);
    const cleanCriteria = criteria.map(c => c.trim()).filter(Boolean);
    if (!topic.trim()) { toast.error('Please enter a decision topic'); return; }
    if (cleanOptions.length < 2) { toast.error('Please enter at least 2 options'); return; }
    if (cleanCriteria.length < 2) { toast.error('Please enter at least 2 criteria'); return; }
    if (cleanCriteria.length !== weights.slice(0, cleanCriteria.length).length) { toast.error('Criteria and weights mismatch'); return; }
    generateMutation.mutate({ topic: topic.trim(), options: cleanOptions, criteria: cleanCriteria, weights: weights.slice(0, cleanCriteria.length), context: context.trim() });
  };

  const loadSavedMatrix = async (id: string) => {
    try {
      const data: any = await apiClient.get(`/tools/decision-matrix-builder/saved/${id}/`);
      if (data.matrix_data) {
        setResult(data.matrix_data);
        setLoadedMatrixId(id);
        setShowSaved(false);
        toast.success('Matrix loaded!');
      }
    } catch {
      toast.error('Failed to load matrix');
    }
  };

  const exportMarkdown = () => {
    if (!result) return;
    const md = generateMarkdownExport(result);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.title.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported as Markdown!');
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="max-w-7xl mx-auto p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">

        {/* Hero header */}
        <div className="relative bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-600 px-8 py-10 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIiIGhlaWdodD0iMiIgeD0iMTkiIHk9IjE5IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIi8+PC9zdmc+')] opacity-40" />
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
              <TableCellsIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">
              AI Decision Matrix Builder
            </h2>
            <p className="text-lg text-cyan-100 max-w-2xl mx-auto">
              Compare your options objectively. Enter a decision, your choices, and criteria — our AI builds a weighted matrix with scores, recommendations, and trade-off analysis.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8">

          {/* Saved toggle */}
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowSaved(!showSaved)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors">
              <BookmarkIcon className="h-4 w-4" />
              {showSaved ? 'Hide' : 'My Saved Matrices'}
              {!showSaved && savedMatrices.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-teal-500 rounded-full">
                  {savedMatrices.length}
                </span>
              )}
            </button>
          </div>

          {/* Saved list */}
          <AnimatePresence>
            {showSaved && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-8">
                {savedMatrices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <BookmarkIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>No saved decision matrices yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {(savedMatrices as SavedMatrix[]).map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white truncate">{m.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Winner: <span className="font-medium text-emerald-600 dark:text-emerald-400">{m.winner || '—'}</span>
                            {' · '}{m.options_count} options · {m.criteria_count} criteria · {new Date(m.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button onClick={() => toggleFavMutation.mutate({ id: m.id, is_favorite: !m.is_favorite })}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            {m.is_favorite ? <HeartSolidIcon className="h-5 w-5 text-pink-500" /> : <HeartIcon className="h-5 w-5 text-gray-400" />}
                          </button>
                          <button onClick={() => loadSavedMatrix(m.id)}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-teal-600 dark:text-teal-400">
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => { if (window.confirm('Delete this matrix?')) deleteMutation.mutate(m.id); }}
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
          <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto mb-8">

            {/* Decision Topic */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <ScaleIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
                Decision Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Which cloud provider to choose for our startup?"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 dark:bg-gray-700 dark:text-white transition-all"
                disabled={generateMutation.isPending}
              />
            </div>

            {/* Options */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <ChartBarIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
                  Options to Compare <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-400 ml-1">({options.length}/8)</span>
                </label>
                <button type="button" onClick={addOption} disabled={options.length >= 8 || generateMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 disabled:opacity-40 transition-colors">
                  <PlusIcon className="h-3.5 w-3.5" /> Add Option
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className="flex-1 px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                      disabled={generateMutation.isPending}
                    />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)}
                              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Criteria with Weights */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <AdjustmentsHorizontalIcon className="inline h-4 w-4 mr-1 -mt-0.5" />
                  Criteria & Weights <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-400 ml-1">({criteria.length}/10)</span>
                </label>
                <button type="button" onClick={addCriterion} disabled={criteria.length >= 10 || generateMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 disabled:opacity-40 transition-colors">
                  <PlusIcon className="h-3.5 w-3.5" /> Add Criterion
                </button>
              </div>
              <div className="space-y-3">
                {criteria.map((crit, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={crit}
                      onChange={(e) => updateCriterion(i, e.target.value)}
                      placeholder={`Criterion ${i + 1} (e.g., Cost, Performance, Ease of use)`}
                      className="flex-1 px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                      disabled={generateMutation.isPending}
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-gray-400 font-medium w-14 text-right">Wt: {weights[i]}</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={weights[i]}
                        onChange={(e) => updateWeight(i, Number(e.target.value))}
                        className="w-20 h-2 accent-teal-500"
                        disabled={generateMutation.isPending}
                      />
                    </div>
                    {criteria.length > 2 && (
                      <button type="button" onClick={() => removeCriterion(i)}
                              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Context */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Additional Context (Optional)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Any constraints, priorities, or additional information that could help the analysis..."
                rows={2}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 dark:bg-gray-700 dark:text-white transition-all text-sm"
                disabled={generateMutation.isPending}
              />
            </div>

            {/* Submit */}
            <div className="text-center pt-2">
              <button
                type="submit"
                disabled={generateMutation.isPending || !topic.trim()}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {generateMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing Options...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-6 w-6" />
                    Build Decision Matrix
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

              {/* Title bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{result.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{result.overview}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={exportMarkdown}
                          className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Export">
                    <ArrowDownTrayIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button onClick={() => result && saveMutation.mutate(result)} disabled={saveMutation.isPending}
                          className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-900/30 hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors" title="Save">
                    <BookmarkSolidIcon className={`h-5 w-5 ${loadedMatrixId ? 'text-teal-500' : 'text-teal-400'}`} />
                  </button>
                  <button onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)} disabled={generateMutation.isPending}
                          className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Regenerate">
                    <ArrowPathIcon className={`h-5 w-5 text-gray-600 dark:text-gray-300 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Winner card */}
              {result.recommendation && (
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="p-5 mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-3 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl">
                      <TrophySolidIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
                          Recommended: {result.recommendation.winner}
                        </h4>
                        <ConfidenceBadge confidence={result.recommendation.confidence} />
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mt-1">{result.recommendation.summary}</p>
                      {result.recommendation.runnerUp && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Runner-up: <span className="font-medium">{result.recommendation.runnerUp}</span>
                          {result.recommendation.runnerUpGap > 0 && (
                            <span className="ml-1">(gap: {result.recommendation.runnerUpGap} points)</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Normalized score bars */}
              <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <ArrowTrendingUpIcon className="h-4 w-4 text-teal-500" />
                  Overall Scores
                </h4>
                <div className="space-y-3">
                  {sortedMatrix.map((entry) => (
                    <NormalizedBar
                      key={entry.option}
                      label={entry.option}
                      score={entry.normalizedScore}
                      isWinner={entry.option === result.recommendation?.winner}
                    />
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 mb-8 bg-gray-100 dark:bg-gray-700/50 rounded-xl overflow-x-auto">
                {[
                  { id: 'matrix' as const, label: 'Score Matrix', icon: TableCellsIcon },
                  { id: 'analysis' as const, label: 'Analysis', icon: LightBulbIcon },
                  { id: 'sensitivity' as const, label: 'Sensitivity', icon: AdjustmentsHorizontalIcon },
                  { id: 'proscons' as const, label: 'Pros & Cons', icon: ScaleIcon },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                            activeTab === tab.id
                              ? 'bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400 shadow-sm'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}>
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ---- Matrix Tab ---- */}
              {activeTab === 'matrix' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {/* Toggle reasonings */}
                  <div className="flex justify-end mb-3">
                    <button onClick={() => setShowReasonings(!showReasonings)}
                            className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                      <InformationCircleIcon className="h-3.5 w-3.5" />
                      {showReasonings ? 'Hide' : 'Show'} reasoning (hover scores)
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/60">
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Option
                          </th>
                          {result.criteria?.map((c) => (
                            <th key={c} className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <div>{c}</div>
                              <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 normal-case">
                                weight: {result.weights?.[c] ?? '—'}
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Weighted
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Score %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white dark:bg-gray-800">
                        {sortedMatrix.map((entry, idx) => {
                          const isWinner = entry.option === result.recommendation?.winner;
                          return (
                            <tr key={entry.option}
                                className={isWinner ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {isWinner && <TrophySolidIcon className="h-4 w-4 text-amber-500" />}
                                  <span className={`text-sm font-semibold ${isWinner ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>
                                    {entry.option}
                                  </span>
                                  {idx === 0 && !isWinner && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded font-medium">#1</span>
                                  )}
                                </div>
                              </td>
                              {result.criteria?.map((c) => {
                                const sd = entry.scores?.[c];
                                return (
                                  <td key={c} className="px-4 py-3">
                                    {sd ? (
                                      <ScoreCell score={sd.score} reasoning={sd.reasoning} />
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-right text-sm font-bold text-gray-700 dark:text-gray-300">
                                {entry.totalWeighted}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${
                                  isWinner
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {entry.normalizedScore}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* ---- Analysis Tab ---- */}
              {activeTab === 'analysis' && result.analysis && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Strengths */}
                  {result.analysis.strengths?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <HandThumbUpIcon className="h-5 w-5 text-emerald-500" /> Key Strengths
                      </h4>
                      <div className="grid gap-3">
                        {result.analysis.strengths.map((s, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                            <span className="px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-800/50 rounded-lg flex-shrink-0 mt-0.5">{s.option}</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{s.strength}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weaknesses */}
                  {result.analysis.weaknesses?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <HandThumbDownIcon className="h-5 w-5 text-red-500" /> Key Weaknesses
                      </h4>
                      <div className="grid gap-3">
                        {result.analysis.weaknesses.map((w, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                            <span className="px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-800/50 rounded-lg flex-shrink-0 mt-0.5">{w.option}</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{w.weakness}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tradeoffs */}
                  {result.analysis.tradeoffs?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ScaleIcon className="h-5 w-5 text-amber-500" /> Trade-offs to Consider
                      </h4>
                      <div className="grid gap-3">
                        {result.analysis.tradeoffs.map((t, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                            <StarSolidIcon className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700 dark:text-gray-300">{t}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tips */}
                  {result.tips?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5 text-teal-500" /> Decision-Making Tips
                      </h4>
                      <div className="grid gap-2">
                        {result.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <CheckCircleIcon className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                            {tip}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ---- Sensitivity Tab ---- */}
              {activeTab === 'sensitivity' && result.sensitivityAnalysis?.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <AdjustmentsHorizontalIcon className="h-5 w-5 text-purple-500" /> Sensitivity Analysis
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    What happens if your priorities change? Here's how the result shifts under different weight scenarios.
                  </p>
                  <div className="space-y-4">
                    {result.sensitivityAnalysis.map((item, i) => (
                      <div key={i} className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30">
                        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.scenario}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            item.newWinner === result.recommendation?.winner
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            Winner: {item.newWinner}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.insight}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ---- Pros & Cons Tab ---- */}
              {activeTab === 'proscons' && result.prosAndCons?.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {result.prosAndCons.map((pc, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
                        <h5 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {pc.option === result.recommendation?.winner && <TrophySolidIcon className="h-4 w-4 text-amber-500" />}
                          {pc.option}
                        </h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
                        <div className="p-5">
                          <h6 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                            <HandThumbUpIcon className="h-4 w-4" /> Pros
                          </h6>
                          <ul className="space-y-2">
                            {pc.pros?.map((p, pi) => (
                              <li key={pi} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <CheckCircleIcon className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-5">
                          <h6 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5">
                            <HandThumbDownIcon className="h-4 w-4" /> Cons
                          </h6>
                          <ul className="space-y-2">
                            {pc.cons?.map((c, ci) => (
                              <li key={ci} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <ExclamationTriangleIcon className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
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

function generateMarkdownExport(r: MatrixData): string {
  let md = `# ${r.title}\n\n`;
  md += `> ${r.overview}\n\n`;

  // Recommendation
  if (r.recommendation) {
    md += `## 🏆 Recommendation\n`;
    md += `**Winner: ${r.recommendation.winner}** (${r.recommendation.confidence} confidence)\n\n`;
    md += `${r.recommendation.summary}\n\n`;
    if (r.recommendation.runnerUp) {
      md += `Runner-up: ${r.recommendation.runnerUp} (gap: ${r.recommendation.runnerUpGap} pts)\n\n`;
    }
  }

  // Score table
  md += `## Score Matrix\n\n`;
  const cols = ['Option', ...(r.criteria || []), 'Weighted', 'Score %'];
  md += `| ${cols.join(' | ')} |\n`;
  md += `| ${cols.map(() => '---').join(' | ')} |\n`;
  const sorted = [...(r.matrix || [])].sort((a, b) => b.normalizedScore - a.normalizedScore);
  sorted.forEach((entry) => {
    const row = [
      entry.option,
      ...(r.criteria || []).map((c) => {
        const sd = entry.scores?.[c];
        return sd ? `${sd.score}/10` : '—';
      }),
      String(entry.totalWeighted),
      `${entry.normalizedScore}%`,
    ];
    md += `| ${row.join(' | ')} |\n`;
  });
  md += `\n`;

  // Weights
  md += `**Weights:** ${(r.criteria || []).map((c) => `${c}=${r.weights?.[c] ?? '?'}`).join(', ')}\n\n`;

  // Analysis
  if (r.analysis) {
    md += `## Analysis\n\n`;
    if (r.analysis.strengths?.length) {
      md += `### Strengths\n`;
      r.analysis.strengths.forEach((s) => { md += `- **${s.option}**: ${s.strength}\n`; });
      md += `\n`;
    }
    if (r.analysis.weaknesses?.length) {
      md += `### Weaknesses\n`;
      r.analysis.weaknesses.forEach((w) => { md += `- **${w.option}**: ${w.weakness}\n`; });
      md += `\n`;
    }
    if (r.analysis.tradeoffs?.length) {
      md += `### Trade-offs\n`;
      r.analysis.tradeoffs.forEach((t) => { md += `- ${t}\n`; });
      md += `\n`;
    }
  }

  // Sensitivity
  if (r.sensitivityAnalysis?.length) {
    md += `## Sensitivity Analysis\n`;
    r.sensitivityAnalysis.forEach((s) => {
      md += `- **${s.scenario}** → Winner: ${s.newWinner}. ${s.insight}\n`;
    });
    md += `\n`;
  }

  // Pros & Cons
  if (r.prosAndCons?.length) {
    md += `## Pros & Cons\n\n`;
    r.prosAndCons.forEach((pc) => {
      md += `### ${pc.option}\n`;
      md += `**Pros:** ${pc.pros?.join('; ')}\n`;
      md += `**Cons:** ${pc.cons?.join('; ')}\n\n`;
    });
  }

  // Tips
  if (r.tips?.length) {
    md += `## Tips\n`;
    r.tips.forEach((t) => { md += `- 💡 ${t}\n`; });
  }

  return md;
}

export default DecisionMatrixBuilder;
