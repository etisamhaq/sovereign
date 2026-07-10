import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { toast } from 'react-hot-toast';
import {
  GlobeAltIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  BookmarkIcon,
  ArrowPathIcon,
  TrashIcon,
  HeartIcon,
  EyeIcon,
  SunIcon,
  MapPinIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  TruckIcon,
  ShoppingBagIcon,
  CameraIcon,
  MusicalNoteIcon,
  FireIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
  StarIcon as StarSolidIcon,
  MapPinIcon as MapPinSolidIcon,
} from '@heroicons/react/24/solid';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Activity {
  time: string;
  activity: string;
  description: string;
  location: string;
  duration: string;
  estimatedCost: string;
  tips: string;
  category: string;
}

interface MealRec {
  place: string;
  cuisine: string;
  budget: string;
  tip: string;
}

interface DailyPlan {
  day: number;
  title: string;
  theme: string;
  activities: Activity[];
  meals: {
    breakfast?: MealRec;
    lunch?: MealRec;
    dinner?: MealRec;
  };
  accommodation?: {
    suggestion: string;
    area: string;
    budget: string;
    tip: string;
  };
}

interface BudgetBreakdown {
  accommodation?: { min: number; max: number };
  food?: { min: number; max: number };
  activities?: { min: number; max: number };
  transport?: { min: number; max: number };
  misc?: { min: number; max: number };
}

interface TotalBudget {
  min: number;
  max: number;
  currency: string;
  perPerson: boolean;
  breakdown: BudgetBreakdown;
}

interface Highlight {
  title: string;
  description: string;
  category: string;
}

interface PackingItem {
  item: string;
  reason: string;
  priority: string;
}

interface LocalTip {
  category: string;
  tip: string;
}

interface BestTimeInfo {
  recommended: string;
  weather: string;
  peakSeason: string;
  note: string;
}

interface EmergencyInfo {
  emergencyNumber: string;
  embassy: string;
  hospitals: string;
  notes: string;
}

interface TransportGuide {
  gettingThere: string;
  localTransport: string;
  tips: string[];
}

interface ItineraryData {
  title: string;
  overview: string;
  destination: string;
  duration: string;
  totalEstimatedBudget: TotalBudget;
  dailyPlans: DailyPlan[];
  highlights: Highlight[];
  packingList: PackingItem[];
  localTips: LocalTip[];
  bestTimeToVisit: BestTimeInfo;
  emergencyInfo: EmergencyInfo;
  transportGuide: TransportGuide;
  budgetTips: string[];
  tags: string[];
}

interface SavedItinerary {
  id: string;
  title: string;
  destination: string;
  duration: string;
  budget: string;
  total_days: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  itinerary_data?: ItineraryData;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INTEREST_OPTIONS = [
  'Culture & History', 'Food & Cuisine', 'Nature & Outdoors', 'Beach & Water Sports',
  'Adventure & Hiking', 'Nightlife & Entertainment', 'Shopping', 'Art & Museums',
  'Photography', 'Architecture', 'Wellness & Spa', 'Local Markets',
  'Wildlife', 'Religion & Temples', 'Music & Festivals', 'Wine & Brewery Tours',
];

const BUDGET_OPTIONS = [
  { value: 'Budget ($30-50/day)', label: 'Budget', desc: '$30-50/day', icon: '💰' },
  { value: 'Mid-range ($80-150/day)', label: 'Mid-range', desc: '$80-150/day', icon: '💳' },
  { value: 'Luxury ($200+/day)', label: 'Luxury', desc: '$200+/day', icon: '💎' },
];

const GROUP_OPTIONS = [
  'Solo traveler', 'Couple (2)', 'Small group (3-4)', 'Family with kids',
  'Large group (5-8)', 'Business trip',
];

const DURATION_PRESETS = ['3 days', '5 days', '7 days', '10 days', '14 days'];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const CategoryIcon: React.FC<{ category: string; className?: string }> = ({ category, className = 'h-4 w-4' }) => {
  switch (category) {
    case 'sightseeing': case 'landmark': return <CameraIcon className={className} />;
    case 'food': return <BuildingStorefrontIcon className={className} />;
    case 'adventure': return <FireIcon className={className} />;
    case 'culture': return <StarIcon className={className} />;
    case 'relaxation': case 'wellness': return <SunIcon className={className} />;
    case 'shopping': return <ShoppingBagIcon className={className} />;
    case 'transport': return <TruckIcon className={className} />;
    case 'nature': return <GlobeAltIcon className={className} />;
    case 'music': return <MusicalNoteIcon className={className} />;
    default: return <MapPinIcon className={className} />;
  }
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const styles: Record<string, string> = {
    essential: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    recommended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    optional: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${styles[priority] || styles.optional}`}>
      {priority}
    </span>
  );
};

const BudgetBar: React.FC<{ label: string; min: number; max: number; total: number; color: string }> = ({
  label, min, max, total, color,
}) => {
  const pct = total > 0 ? Math.round(((min + max) / 2 / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">${min} – ${max}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const ItineraryPlanner: React.FC = () => {
  const queryClient = useQueryClient();
  const resultRef = useRef<HTMLDivElement>(null);

  /* Form state */
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('5 days');
  const [customDuration, setCustomDuration] = useState('');
  const [budget, setBudget] = useState('Mid-range ($80-150/day)');
  const [interests, setInterests] = useState<string[]>([]);
  const [groupSize, setGroupSize] = useState('Couple (2)');
  const [travelStyle, setTravelStyle] = useState('');
  const [specialReqs, setSpecialReqs] = useState('');

  /* Result state */
  const [result, setResult] = useState<ItineraryData | null>(null);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'tips' | 'packing'>('itinerary');
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [showSaved, setShowSaved] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  /* Interests toggle */
  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : prev.length < 8 ? [...prev, interest] : prev,
    );
  };

  /* API */
  const generateMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/tools/itinerary-planner/', data),
    onSuccess: (data: any) => {
      if (data.result?.error) {
        toast.error(data.result.error);
      } else if (data.result?.dailyPlans && Array.isArray(data.result.dailyPlans)) {
        setResult(data.result);
        setActiveTab('itinerary');
        setExpandedDay(1);
        setLoadedId(null);
        toast.success('Itinerary generated!');
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      } else {
        toast.error('Invalid response. Please try again.');
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate itinerary'),
  });

  const saveMutation = useMutation({
    mutationFn: (itData: ItineraryData) => apiClient.post('/tools/itinerary-planner/saved/', { itinerary_data: itData }),
    onSuccess: (data: any) => {
      setLoadedId(data.id);
      toast.success('Itinerary saved!');
      queryClient.invalidateQueries({ queryKey: ['saved-itineraries'] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/tools/itinerary-planner/saved/${id}/`),
    onSuccess: () => {
      toast.success('Deleted');
      queryClient.invalidateQueries({ queryKey: ['saved-itineraries'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const toggleFavMutation = useMutation({
    mutationFn: ({ id, is_favorite }: { id: string; is_favorite: boolean }) =>
      apiClient.patch(`/tools/itinerary-planner/saved/${id}/`, { is_favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-itineraries'] }),
  });

  const { data: savedList = [] } = useQuery<SavedItinerary[]>({
    queryKey: ['saved-itineraries'],
    queryFn: () => apiClient.get('/tools/itinerary-planner/saved/'),
    enabled: showSaved,
  });

  /* Handlers */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) { toast.error('Please enter a destination'); return; }
    if (interests.length < 1) { toast.error('Select at least one interest'); return; }
    const finalDuration = duration === 'Custom' ? customDuration : duration;
    if (!finalDuration) { toast.error('Please specify a duration'); return; }
    generateMutation.mutate({
      destination: destination.trim(),
      duration: finalDuration,
      budget,
      interests,
      group_size: groupSize,
      travel_style: travelStyle.trim(),
      special_requirements: specialReqs.trim(),
    });
  };

  const loadSaved = async (id: string) => {
    try {
      const data: any = await apiClient.get(`/tools/itinerary-planner/saved/${id}/`);
      if (data.itinerary_data) {
        setResult(data.itinerary_data);
        setLoadedId(id);
        setShowSaved(false);
        setExpandedDay(1);
        toast.success('Itinerary loaded!');
      }
    } catch {
      toast.error('Failed to load itinerary');
    }
  };

  const exportMarkdown = () => {
    if (!result) return;
    const md = buildMarkdownExport(result);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(result.title || 'itinerary').replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported as Markdown!');
  };

  /* Budget totals */
  const budgetTotal = useMemo(() => {
    const b = result?.totalEstimatedBudget?.breakdown;
    if (!b) return 0;
    return Object.values(b).reduce((sum, v: any) => sum + ((v?.min || 0) + (v?.max || 0)) / 2, 0);
  }, [result]);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="max-w-7xl mx-auto p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600 px-8 py-10 text-white overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
              <GlobeAltIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">AI Itinerary Planner</h2>
            <p className="text-lg text-orange-100 max-w-2xl mx-auto">
              Tell us where you're going and what you love — our AI creates a detailed day-by-day itinerary with restaurant picks, budget breakdowns, packing lists, and insider tips.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8">

          {/* Saved toggle */}
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowSaved(!showSaved)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors">
              <BookmarkIcon className="h-4 w-4" />
              {showSaved ? 'Hide' : 'My Saved Trips'}
              {!showSaved && savedList.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-orange-500 rounded-full">
                  {savedList.length}
                </span>
              )}
            </button>
          </div>

          {/* Saved list */}
          <AnimatePresence>
            {showSaved && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-8">
                {savedList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <GlobeAltIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>No saved itineraries yet. Plan your first trip!</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {(savedList as SavedItinerary[]).map((it) => (
                      <div key={it.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white truncate">{it.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            <MapPinIcon className="inline h-3.5 w-3.5 mr-0.5 -mt-0.5" />
                            {it.destination || '—'} · {it.total_days} days · {new Date(it.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button onClick={() => toggleFavMutation.mutate({ id: it.id, is_favorite: !it.is_favorite })}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            {it.is_favorite ? <HeartSolidIcon className="h-5 w-5 text-pink-500" /> : <HeartIcon className="h-5 w-5 text-gray-400" />}
                          </button>
                          <button onClick={() => loadSaved(it.id)}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-orange-600 dark:text-orange-400">
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => { if (window.confirm('Delete this itinerary?')) deleteMutation.mutate(it.id); }}
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

          {/* ========================================================== */}
          {/*  INPUT FORM                                                 */}
          {/* ========================================================== */}
          <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto mb-8">

            {/* Destination */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <MapPinIcon className="inline h-4 w-4 mr-1 -mt-0.5 text-orange-500" />
                Destination <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Tokyo, Japan"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 dark:bg-gray-700 dark:text-white transition-all text-lg"
                disabled={generateMutation.isPending}
              />
            </div>

            {/* Duration & Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <CalendarDaysIcon className="inline h-4 w-4 mr-1 -mt-0.5 text-orange-500" />
                  Trip Duration <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((d) => (
                    <button key={d} type="button" onClick={() => { setDuration(d); setCustomDuration(''); }}
                            className={`px-3 py-2 text-sm rounded-lg border-2 transition-all ${
                              duration === d
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            }`} disabled={generateMutation.isPending}>
                      {d}
                    </button>
                  ))}
                  <button type="button" onClick={() => setDuration('Custom')}
                          className={`px-3 py-2 text-sm rounded-lg border-2 transition-all ${
                            duration === 'Custom'
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold'
                              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                          }`} disabled={generateMutation.isPending}>
                    Custom
                  </button>
                </div>
                {duration === 'Custom' && (
                  <input type="text" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)}
                         placeholder="e.g., 4 days, 2 weeks"
                         className="mt-2 w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                         disabled={generateMutation.isPending} />
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <UserGroupIcon className="inline h-4 w-4 mr-1 -mt-0.5 text-orange-500" />
                  Group Size <span className="text-red-500">*</span>
                </label>
                <select value={groupSize} onChange={(e) => setGroupSize(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 dark:bg-gray-700 dark:text-white transition-all"
                        disabled={generateMutation.isPending}>
                  {GROUP_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <CurrencyDollarIcon className="inline h-4 w-4 mr-1 -mt-0.5 text-orange-500" />
                Budget Level <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {BUDGET_OPTIONS.map((b) => (
                  <button key={b.value} type="button" onClick={() => setBudget(b.value)}
                          className={`p-4 text-center rounded-xl border-2 transition-all ${
                            budget === b.value
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 shadow-sm'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`} disabled={generateMutation.isPending}>
                    <div className="text-2xl mb-1">{b.icon}</div>
                    <div className={`text-sm font-bold ${budget === b.value ? 'text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {b.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <StarIcon className="inline h-4 w-4 mr-1 -mt-0.5 text-orange-500" />
                Interests & Activities <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-1">(select 1-8)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((int) => (
                  <button key={int} type="button" onClick={() => toggleInterest(int)}
                          className={`px-3 py-1.5 text-sm rounded-full border-2 transition-all ${
                            interests.includes(int)
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold'
                              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                          }`} disabled={generateMutation.isPending}>
                    {interests.includes(int) && <CheckCircleIcon className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                    {int}
                  </button>
                ))}
              </div>
            </div>

            {/* Travel style & special reqs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Travel Style (Optional)</label>
                <input type="text" value={travelStyle} onChange={(e) => setTravelStyle(e.target.value)}
                       placeholder="e.g., Slow travel, packed schedule, off-the-beaten-path"
                       className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                       disabled={generateMutation.isPending} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Special Requirements (Optional)</label>
                <input type="text" value={specialReqs} onChange={(e) => setSpecialReqs(e.target.value)}
                       placeholder="e.g., Wheelchair accessible, vegan food, pet-friendly"
                       className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                       disabled={generateMutation.isPending} />
              </div>
            </div>

            {/* Submit */}
            <div className="text-center pt-2">
              <button type="submit" disabled={generateMutation.isPending || !destination.trim() || interests.length < 1}
                      className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]">
                {generateMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Planning Your Trip...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-6 w-6" />
                    Plan My Trip
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ========================================================== */}
          {/*  RESULT                                                     */}
          {/* ========================================================== */}
          {result && (
            <motion.div ref={resultRef} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }} className="mt-4">

              {/* Title bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{result.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{result.overview}</p>
                  {result.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {result.tags.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-medium">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={exportMarkdown}
                          className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Export">
                    <ArrowDownTrayIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button onClick={() => result && saveMutation.mutate(result)} disabled={saveMutation.isPending}
                          className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors" title="Save">
                    <BookmarkSolidIcon className={`h-5 w-5 ${loadedId ? 'text-orange-500' : 'text-orange-400'}`} />
                  </button>
                  <button onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                          disabled={generateMutation.isPending}
                          className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Regenerate">
                    <ArrowPathIcon className={`h-5 w-5 text-gray-600 dark:text-gray-300 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {[
                  { icon: MapPinSolidIcon, label: 'Destination', value: result.destination, color: 'text-rose-500' },
                  { icon: CalendarDaysIcon, label: 'Duration', value: result.duration || `${result.dailyPlans?.length} days`, color: 'text-blue-500' },
                  { icon: BanknotesIcon, label: 'Est. Budget', value: result.totalEstimatedBudget ? `$${result.totalEstimatedBudget.min}–$${result.totalEstimatedBudget.max}` : '—', color: 'text-emerald-500' },
                  { icon: StarSolidIcon, label: 'Highlights', value: `${result.highlights?.length || 0} must-sees`, color: 'text-amber-500' },
                ].map((stat, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                    <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Highlights strip */}
              {result.highlights?.length > 0 && (
                <div className="mb-8 p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                    <StarSolidIcon className="h-4 w-4 text-amber-500" /> Trip Highlights
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CategoryIcon category={h.category} className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{h.title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{h.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 p-1 mb-8 bg-gray-100 dark:bg-gray-700/50 rounded-xl overflow-x-auto">
                {[
                  { id: 'itinerary' as const, label: 'Day-by-Day', icon: CalendarDaysIcon },
                  { id: 'budget' as const, label: 'Budget', icon: BanknotesIcon },
                  { id: 'tips' as const, label: 'Tips & Info', icon: LightBulbIcon },
                  { id: 'packing' as const, label: 'Packing', icon: ShoppingBagIcon },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                            activeTab === tab.id
                              ? 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 shadow-sm'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}>
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ---- Itinerary Tab ---- */}
              {activeTab === 'itinerary' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {result.dailyPlans?.map((day) => (
                    <div key={day.day} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {/* Day header */}
                      <button onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white text-sm font-bold">
                            {day.day}
                          </span>
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">{day.title}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{day.theme}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 hidden sm:inline">{day.activities?.length || 0} activities</span>
                          {expandedDay === day.day ? <ChevronUpIcon className="h-5 w-5 text-gray-400" /> : <ChevronDownIcon className="h-5 w-5 text-gray-400" />}
                        </div>
                      </button>

                      {/* Day content */}
                      <AnimatePresence>
                        {expandedDay === day.day && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                                      className="overflow-hidden">
                            <div className="px-5 pb-5 space-y-4">
                              {/* Activities timeline */}
                              <div className="relative pl-6 space-y-4">
                                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-300 to-rose-300 dark:from-orange-700 dark:to-rose-700 rounded-full" />
                                {day.activities?.map((act, ai) => (
                                  <div key={ai} className="relative">
                                    <div className="absolute -left-[16px] top-1 w-3 h-3 rounded-full border-2 border-orange-400 bg-white dark:bg-gray-800" />
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-lg">
                                            {act.time}
                                          </span>
                                          <CategoryIcon category={act.category} className="h-4 w-4 text-gray-400" />
                                        </div>
                                        {act.estimatedCost && (
                                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg">
                                            {act.estimatedCost}
                                          </span>
                                        )}
                                      </div>
                                      <h5 className="font-semibold text-gray-900 dark:text-white text-sm">{act.activity}</h5>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{act.description}</p>
                                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {act.location && (
                                          <span className="flex items-center gap-1">
                                            <MapPinIcon className="h-3 w-3" /> {act.location}
                                          </span>
                                        )}
                                        {act.duration && (
                                          <span className="flex items-center gap-1">
                                            <ClockIcon className="h-3 w-3" /> {act.duration}
                                          </span>
                                        )}
                                      </div>
                                      {act.tips && (
                                        <p className="mt-2 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg flex items-start gap-1">
                                          <LightBulbIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                          {act.tips}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Meals */}
                              {day.meals && (Object.keys(day.meals).length > 0) && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => {
                                    const m = day.meals[meal];
                                    if (!m) return null;
                                    const icons: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
                                    return (
                                      <div key={meal} className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                        <div className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase mb-1">
                                          {icons[meal]} {meal}
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.place}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{m.cuisine} · {m.budget}</p>
                                        {m.tip && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">💡 {m.tip}</p>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Accommodation */}
                              {day.accommodation && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-start gap-3">
                                  <HomeIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{day.accommodation.suggestion}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {day.accommodation.area} · {day.accommodation.budget}
                                    </p>
                                    {day.accommodation.tip && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">💡 {day.accommodation.tip}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ---- Budget Tab ---- */}
              {activeTab === 'budget' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {result.totalEstimatedBudget && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <BanknotesIcon className="h-5 w-5 text-emerald-500" /> Budget Breakdown
                        </h4>
                        <div className="text-right">
                          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                            ${result.totalEstimatedBudget.min} – ${result.totalEstimatedBudget.max}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {result.totalEstimatedBudget.currency}{result.totalEstimatedBudget.perPerson ? ' per person' : ' total'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {result.totalEstimatedBudget.breakdown && Object.entries(result.totalEstimatedBudget.breakdown).map(([key, val]) => (
                          <BudgetBar key={key} label={key} min={(val as any)?.min || 0} max={(val as any)?.max || 0}
                                     total={budgetTotal}
                                     color={
                                       key === 'accommodation' ? 'bg-blue-500' :
                                       key === 'food' ? 'bg-amber-500' :
                                       key === 'activities' ? 'bg-purple-500' :
                                       key === 'transport' ? 'bg-teal-500' :
                                       'bg-gray-400'
                                     } />
                        ))}
                      </div>
                    </div>
                  )}

                  {result.budgetTips?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <CurrencyDollarIcon className="h-5 w-5 text-emerald-500" /> Money-Saving Tips
                      </h4>
                      <div className="grid gap-2">
                        {result.budgetTips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <CheckCircleIcon className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            {tip}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ---- Tips & Info Tab ---- */}
              {activeTab === 'tips' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Local tips */}
                  {result.localTips?.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5 text-amber-500" /> Local Insider Tips
                      </h4>
                      <div className="grid gap-3">
                        {result.localTips.map((lt, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                            <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/50 rounded-lg flex-shrink-0 mt-0.5 uppercase">
                              {lt.category}
                            </span>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{lt.tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Best time to visit */}
                  {result.bestTimeToVisit && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <SunIcon className="h-5 w-5 text-orange-500" /> Best Time to Visit
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: 'Recommended', value: result.bestTimeToVisit.recommended },
                          { label: 'Weather', value: result.bestTimeToVisit.weather },
                          { label: 'Peak Season', value: result.bestTimeToVisit.peakSeason },
                          { label: 'Note', value: result.bestTimeToVisit.note },
                        ].map((item, i) => item.value ? (
                          <div key={i} className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800/30">
                            <p className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase mb-1">{item.label}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{item.value}</p>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  {/* Transport guide */}
                  {result.transportGuide && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TruckIcon className="h-5 w-5 text-blue-500" /> Getting Around
                      </h4>
                      <div className="space-y-3">
                        {result.transportGuide.gettingThere && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Getting There</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{result.transportGuide.gettingThere}</p>
                          </div>
                        )}
                        {result.transportGuide.localTransport && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Local Transport</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{result.transportGuide.localTransport}</p>
                          </div>
                        )}
                        {result.transportGuide.tips?.length > 0 && (
                          <div className="grid gap-1.5 mt-2">
                            {result.transportGuide.tips.map((t, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <CheckCircleIcon className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" /> {t}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency info */}
                  {result.emergencyInfo && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ShieldCheckIcon className="h-5 w-5 text-red-500" /> Emergency Information
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: 'Emergency Number', value: result.emergencyInfo.emergencyNumber },
                          { label: 'Embassy/Consulate', value: result.emergencyInfo.embassy },
                          { label: 'Hospital', value: result.emergencyInfo.hospitals },
                          { label: 'Safety Notes', value: result.emergencyInfo.notes },
                        ].map((item, i) => item.value ? (
                          <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                            <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase mb-1">{item.label}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{item.value}</p>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ---- Packing Tab ---- */}
              {activeTab === 'packing' && result.packingList?.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShoppingBagIcon className="h-5 w-5 text-purple-500" /> Packing Checklist
                  </h4>
                  <div className="space-y-2">
                    {['essential', 'recommended', 'optional'].map((priority) => {
                      const items = result.packingList.filter((p) => p.priority === priority);
                      if (items.length === 0) return null;
                      return (
                        <div key={priority} className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <PriorityBadge priority={priority} />
                            <span className="text-xs text-gray-400">({items.length} items)</span>
                          </div>
                          <div className="grid gap-2">
                            {items.map((item, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                <CheckCircleIcon className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.item}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
/*  Markdown export                                                    */
/* ------------------------------------------------------------------ */

function buildMarkdownExport(r: ItineraryData): string {
  let md = `# ${r.title}\n\n`;
  md += `> ${r.overview}\n\n`;

  if (r.tags?.length) md += `**Tags:** ${r.tags.map(t => `#${t}`).join(' ')}\n\n`;

  // Budget summary
  if (r.totalEstimatedBudget) {
    const b = r.totalEstimatedBudget;
    md += `## 💰 Estimated Budget\n`;
    md += `**$${b.min} – $${b.max} ${b.currency}** ${b.perPerson ? 'per person' : 'total'}\n\n`;
    if (b.breakdown) {
      md += `| Category | Min | Max |\n| --- | --- | --- |\n`;
      Object.entries(b.breakdown).forEach(([k, v]) => {
        md += `| ${k} | $${(v as any)?.min || 0} | $${(v as any)?.max || 0} |\n`;
      });
      md += '\n';
    }
  }

  // Highlights
  if (r.highlights?.length) {
    md += `## ⭐ Trip Highlights\n`;
    r.highlights.forEach(h => { md += `- **${h.title}**: ${h.description}\n`; });
    md += '\n';
  }

  // Daily plans
  md += `## 📅 Day-by-Day Itinerary\n\n`;
  r.dailyPlans?.forEach(day => {
    md += `### Day ${day.day}: ${day.title}\n`;
    md += `*${day.theme}*\n\n`;
    day.activities?.forEach(act => {
      md += `- **${act.time}** — **${act.activity}** (${act.duration})\n`;
      md += `  📍 ${act.location} · 💲 ${act.estimatedCost}\n`;
      md += `  ${act.description}\n`;
      if (act.tips) md += `  💡 *${act.tips}*\n`;
      md += '\n';
    });
    if (day.meals) {
      md += `**Meals:**\n`;
      (['breakfast', 'lunch', 'dinner'] as const).forEach(meal => {
        const m = day.meals[meal];
        if (m) md += `- ${meal.charAt(0).toUpperCase() + meal.slice(1)}: **${m.place}** (${m.cuisine}, ${m.budget})${m.tip ? ` — ${m.tip}` : ''}\n`;
      });
      md += '\n';
    }
    if (day.accommodation) {
      md += `**Stay:** ${day.accommodation.suggestion} — ${day.accommodation.area} (${day.accommodation.budget})\n\n`;
    }
  });

  // Local tips
  if (r.localTips?.length) {
    md += `## 💡 Local Tips\n`;
    r.localTips.forEach(t => { md += `- **${t.category}**: ${t.tip}\n`; });
    md += '\n';
  }

  // Transport
  if (r.transportGuide) {
    md += `## 🚌 Transport Guide\n`;
    if (r.transportGuide.gettingThere) md += `**Getting There:** ${r.transportGuide.gettingThere}\n\n`;
    if (r.transportGuide.localTransport) md += `**Local Transport:** ${r.transportGuide.localTransport}\n\n`;
    r.transportGuide.tips?.forEach(t => { md += `- ${t}\n`; });
    md += '\n';
  }

  // Packing
  if (r.packingList?.length) {
    md += `## 🎒 Packing List\n`;
    r.packingList.forEach(p => { md += `- [${p.priority}] **${p.item}** — ${p.reason}\n`; });
    md += '\n';
  }

  // Budget tips
  if (r.budgetTips?.length) {
    md += `## 💸 Budget Tips\n`;
    r.budgetTips.forEach(t => { md += `- ${t}\n`; });
    md += '\n';
  }

  // Emergency
  if (r.emergencyInfo) {
    md += `## 🚨 Emergency Info\n`;
    md += `- Emergency: ${r.emergencyInfo.emergencyNumber}\n`;
    if (r.emergencyInfo.embassy) md += `- Embassy: ${r.emergencyInfo.embassy}\n`;
    if (r.emergencyInfo.hospitals) md += `- Hospital: ${r.emergencyInfo.hospitals}\n`;
    if (r.emergencyInfo.notes) md += `- Notes: ${r.emergencyInfo.notes}\n`;
  }

  return md;
}

export default ItineraryPlanner;
