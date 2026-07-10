import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  FilmIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface YouTubeScriptWriterProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const styles = [
  { value: 'educational', label: '📚 Educational' },
  { value: 'entertainment', label: '🎭 Entertainment' },
  { value: 'tutorial', label: '🛠️ Tutorial / How-To' },
  { value: 'vlog', label: '📹 Vlog' },
  { value: 'review', label: '⭐ Review' },
  { value: 'storytelling', label: '📖 Storytelling' },
  { value: 'listicle', label: '📋 Listicle (Top 10...)' },
];

const durations = [
  { value: '5', label: '5 min', sub: 'Short' },
  { value: '10', label: '10 min', sub: 'Standard' },
  { value: '15', label: '15 min', sub: 'In-depth' },
  { value: '20', label: '20 min', sub: 'Deep dive' },
  { value: '30', label: '30 min', sub: 'Long-form' },
];

interface Segment {
  title: string;
  timestamp: string;
  script: string;
  visual_notes: string;
  duration_estimate: string;
}

interface ScriptResult {
  title: string;
  thumbnail_text: string;
  description: string;
  tags: string[];
  hook: string;
  intro: string;
  segments: Segment[];
  outro: string;
  total_duration: string;
  style_notes: string;
}

const YouTubeScriptWriter: React.FC<YouTubeScriptWriterProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('10');
  const [style, setStyle] = useState('educational');
  const [targetAudience, setTargetAudience] = useState('');
  const [includeHooks, setIncludeHooks] = useState(true);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());

  const toggleSegment = (idx: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return toast.error('Please enter a video topic');
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await apiClient.post<{ result: ScriptResult; processing_time: number }>(
        '/tools/youtube-script-writer/',
        { topic, duration, style, target_audience: targetAudience, include_hooks: includeHooks }
      );
      setResult(response.result);
      if (response.result?.segments) {
        setExpandedSegments(new Set(response.result.segments.map((_: any, i: number) => i)));
      }
      toast.success(`Script generated in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate script');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyFullScript = () => {
    if (!result) return;
    const parts = [
      `# ${result.title}`,
      `\n## 🎣 HOOK\n${result.hook}`,
      `\n## 🎬 INTRO\n${result.intro}`,
      ...result.segments.map(s => `\n## [${s.timestamp}] ${s.title}\n${s.script}\n\n📹 Visual: ${s.visual_notes}`),
      `\n## 🎯 OUTRO\n${result.outro}`,
      `\n---\n## YouTube Description\n${result.description}`,
      `\nTags: ${result.tags?.join(', ')}`,
    ];
    navigator.clipboard.writeText(parts.join('\n'));
    toast.success('Full script copied!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <FilmIcon className="h-8 w-8 text-red-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Video Topic *</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., How I Learned Python in 30 Days (as a complete beginner)"
            className="input w-full"
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Duration</label>
          <div className="grid grid-cols-5 gap-2">
            {durations.map(d => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`py-2.5 px-2 rounded-lg text-center border transition ${
                  duration === d.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-2 ring-red-500'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-sm">{d.label}</p>
                <p className="text-xs opacity-70">{d.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Style</label>
          <div className="flex flex-wrap gap-2">
            {styles.map(s => (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  style === s.value
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-2 ring-red-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Audience <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., aspiring developers, age 18-30"
              className="input w-full"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeHooks}
                onChange={(e) => setIncludeHooks(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include attention hooks &amp; pattern interrupts</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isProcessing || !topic.trim()}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Writing Script...</>
          ) : (
            <><FilmIcon className="h-5 w-5" /> Generate YouTube Script</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Title */}
          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{result.title}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><ClockIcon className="h-4 w-4" /> {result.total_duration}</span>
                  {result.thumbnail_text && (
                    <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-xs font-bold">
                      📸 {result.thumbnail_text}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={copyFullScript} className="btn btn-primary text-xs flex items-center gap-1 px-3 py-1.5 shrink-0">
                <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy All
              </button>
            </div>
          </div>

          {/* Hook */}
          {result.hook && (
            <div className="card !bg-red-50 dark:!bg-red-900/20 border-red-200 dark:border-red-800">
              <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-2">🎣 Hook — First 5 Seconds</h4>
              <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{result.hook}</p>
            </div>
          )}

          {/* Intro */}
          {result.intro && (
            <div className="card !bg-amber-50 dark:!bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-2">🎬 Intro — ~30 Seconds</h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{result.intro}</p>
            </div>
          )}

          {/* Segments */}
          {result.segments?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">📝 Script Segments</h3>
              {result.segments.map((seg, idx) => (
                <div key={idx} className="card !p-0 overflow-hidden">
                  <button
                    onClick={() => toggleSegment(idx)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{seg.title}</p>
                        <p className="text-xs text-gray-500">{seg.timestamp} · ~{seg.duration_estimate}</p>
                      </div>
                    </div>
                    {expandedSegments.has(idx) ? (
                      <ChevronUpIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                  </button>
                  {expandedSegments.has(idx) && (
                    <div className="px-5 pb-5 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                      <div>
                        <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Script</h5>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{seg.script}</p>
                      </div>
                      {seg.visual_notes && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                          <h5 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">📹 Visual Notes</h5>
                          <p className="text-sm text-purple-700 dark:text-purple-300">{seg.visual_notes}</p>
                        </div>
                      )}
                      <button
                        onClick={() => { navigator.clipboard.writeText(seg.script); toast.success('Segment copied!'); }}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <ClipboardDocumentIcon className="h-3 w-3" /> Copy this segment
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Outro */}
          {result.outro && (
            <div className="card !bg-green-50 dark:!bg-green-900/20 border-green-200 dark:border-green-800">
              <h4 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase mb-2">🎯 Outro &amp; CTA</h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{result.outro}</p>
            </div>
          )}

          {/* Description & Tags */}
          {(result.description || result.tags?.length > 0) && (
            <div className="card">
              {result.description && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">📋 YouTube Description</h4>
                    <button
                      onClick={() => { navigator.clipboard.writeText(result.description); toast.success('Description copied!'); }}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <ClipboardDocumentIcon className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{result.description}</p>
                  </div>
                </div>
              )}
              {result.tags?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">🏷️ Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default YouTubeScriptWriter;
