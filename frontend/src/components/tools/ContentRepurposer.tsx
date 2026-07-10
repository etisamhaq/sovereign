import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  LightBulbIcon,
  LinkIcon,
  MusicalNoteIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ---- Types ----------------------------------------------------------

interface Insights {
  main_topics: string[];
  strong_hooks: string[];
  actionable_insights: string[];
  story_segments: string[];
  key_quotes: string[];
  target_audience: string;
}

interface ProcessResult {
  success: boolean;
  source_title: string;
  source_meta: Record<string, any>;
  transcript: string;
  word_count: number;
  insights: Insights;
}

interface PlatformContent {
  linkedin: string;
  twitter: string;
  newsletter: string;
}

type Platform = 'linkedin' | 'twitter' | 'newsletter';

// ---- Platform metadata ----------------------------------------------

const PLATFORM_META: Record<Platform, { label: string; icon: string; color: string; bgClass: string }> = {
  linkedin: {
    label: 'LinkedIn Post',
    icon: '💼',
    color: 'text-blue-700 dark:text-blue-400',
    bgClass: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800',
  },
  twitter: {
    label: 'Twitter / X Thread',
    icon: '🐦',
    color: 'text-sky-700 dark:text-sky-400',
    bgClass: 'from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20 border-sky-200 dark:border-sky-800',
  },
  newsletter: {
    label: 'Newsletter Draft',
    icon: '📧',
    color: 'text-purple-700 dark:text-purple-400',
    bgClass: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800',
  },
};

// ---- Component ------------------------------------------------------

const ContentRepurposer: React.FC = () => {
  // Input state
  const [inputMode, setInputMode] = useState<'url' | 'upload'>('url');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline state
  const [step, setStep] = useState<'input' | 'processing' | 'insights' | 'content'>('input');
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [platformContent, setPlatformContent] = useState<PlatformContent | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');

  // Loading states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingPlatform, setRegeneratingPlatform] = useState<Platform | null>(null);

  const [error, setError] = useState('');
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | null>(null);

  // ---- Handlers -------------------------------------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File is too large. Maximum size is 25 MB.');
      return;
    }

    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/mp4', 'audio/ogg'];
    const allowedExts = ['.mp3', '.wav', '.m4a', '.ogg'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      toast.error('Unsupported file type. Please upload MP3, WAV, M4A, or OGG.');
      return;
    }

    setAudioFile(file);
    setError('');
  };

  const handleProcess = useCallback(async () => {
    if (inputMode === 'url' && !youtubeUrl.trim()) {
      setError('Please enter a YouTube URL.');
      return;
    }
    if (inputMode === 'upload' && !audioFile) {
      setError('Please select an audio file.');
      return;
    }

    setError('');
    setIsProcessing(true);
    setStep('processing');

    try {
      const formData = new FormData();
      if (inputMode === 'url') {
        formData.append('url', youtubeUrl.trim());
      } else if (audioFile) {
        formData.append('audio_file', audioFile);
      }

      const response: any = await apiClient.post(
        '/tools/content-repurposer/process/',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      if (response.success) {
        setProcessResult(response as ProcessResult);
        setStep('insights');
        toast.success('Transcription & analysis complete!');
      } else {
        throw new Error(response.error || 'Processing failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Processing failed';
      setError(msg);
      toast.error(msg);
      setStep('input');
    } finally {
      setIsProcessing(false);
    }
  }, [inputMode, youtubeUrl, audioFile]);

  const handleGenerate = useCallback(async () => {
    if (!processResult) return;

    setIsGenerating(true);
    setError('');

    try {
      const response: any = await apiClient.post('/tools/content-repurposer/generate/', {
        transcript: processResult.transcript,
        insights: processResult.insights,
        source_title: processResult.source_title,
        platforms: ['linkedin', 'twitter', 'newsletter'],
      });

      if (response.success) {
        setPlatformContent(response.content as PlatformContent);
        setStep('content');
        toast.success('Content generated for all platforms!');
      } else {
        throw new Error(response.error || 'Generation failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Generation failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [processResult]);

  const handleRegenerate = useCallback(
    async (platform: Platform) => {
      if (!processResult) return;

      setRegeneratingPlatform(platform);

      try {
        const response: any = await apiClient.post('/tools/content-repurposer/regenerate/', {
          platform,
          transcript: processResult.transcript,
          insights: processResult.insights,
          source_title: processResult.source_title,
        });

        if (response.success) {
          setPlatformContent((prev) =>
            prev ? { ...prev, [platform]: response.content } : prev,
          );
          toast.success(`${PLATFORM_META[platform].label} regenerated!`);
        } else {
          throw new Error(response.error);
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.error || 'Regeneration failed');
      } finally {
        setRegeneratingPlatform(null);
      }
    },
    [processResult],
  );

  const handleCopy = async (platform: Platform) => {
    if (!platformContent) return;
    try {
      await navigator.clipboard.writeText(platformContent[platform]);
      setCopiedPlatform(platform);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedPlatform(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleReset = () => {
    setStep('input');
    setProcessResult(null);
    setPlatformContent(null);
    setYoutubeUrl('');
    setAudioFile(null);
    setError('');
    setActivePlatform('linkedin');
  };

  // ---- Render ---------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Progress Bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        {(['input', 'insights', 'content'] as const).map((s, i) => {
          const labels = ['Input', 'Insights', 'Content'];
          const stepOrder = { input: 0, processing: 0, insights: 1, content: 2 };
          const current = stepOrder[step];
          const isActive = i <= current;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`ml-2 text-sm font-medium hidden sm:inline ${
                    isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {labels[i]}
                </span>
              </div>
              {i < 2 && (
                <div
                  className={`flex-1 h-0.5 mx-3 rounded transition-colors ${
                    i < current ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Error Banner ───────────────────────────────────────────── */}
      <AnimatePresence>
        {error && step !== 'processing' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          >
            <XMarkIcon className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* STEP 1 — Input                                                */}
      {/* ============================================================ */}
      {step === 'input' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card space-y-6"
        >
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-primary-500" />
              Provide Your Content Source
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Paste a YouTube URL or upload an audio file (MP3, WAV) to repurpose into social media content.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            <button
              onClick={() => setInputMode('url')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'url'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <LinkIcon className="h-4 w-4" />
              YouTube URL
            </button>
            <button
              onClick={() => setInputMode('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'upload'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Upload Audio
            </button>
          </div>

          {/* URL input */}
          {inputMode === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                YouTube Video URL
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => { setYoutubeUrl(e.target.value); setError(''); }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="input w-full"
              />
            </div>
          )}

          {/* File upload */}
          {inputMode === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Audio File
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition-colors bg-gray-50 dark:bg-gray-800/50"
              >
                {audioFile ? (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <MusicalNoteIcon className="h-8 w-8 text-primary-500" />
                    <div>
                      <p className="font-medium">{audioFile.name}</p>
                      <p className="text-xs text-gray-500">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-xs text-gray-400 mt-1">MP3, WAV, M4A, OGG — max 25 MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={isProcessing || (inputMode === 'url' ? !youtubeUrl.trim() : !audioFile)}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <SparklesIcon className="h-5 w-5" />
            Analyze & Extract Insights
          </button>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 1.5 — Processing indicator                               */}
      {/* ============================================================ */}
      {step === 'processing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card text-center py-16 space-y-4"
        >
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary-200 dark:border-primary-900" />
            <div className="absolute inset-0 rounded-full border-4 border-t-primary-600 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Processing your content…
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {inputMode === 'url'
              ? 'Downloading audio, transcribing with Whisper AI, and extracting insights. This may take 30-60 seconds.'
              : 'Transcribing your audio with Whisper AI and extracting insights. This may take 30-60 seconds.'}
          </p>
          <div className="flex justify-center gap-1.5 pt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 2 — Insights + Transcript                                */}
      {/* ============================================================ */}
      {step === 'insights' && processResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Source info */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {processResult.source_title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {processResult.word_count.toLocaleString()} words transcribed
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ← Start Over
              </button>
            </div>
          </div>

          {/* Insights cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard
              title="Main Topics"
              icon="📌"
              items={processResult.insights.main_topics}
            />
            <InsightCard
              title="Strong Hooks"
              icon="🪝"
              items={processResult.insights.strong_hooks}
            />
            <InsightCard
              title="Actionable Insights"
              icon="💡"
              items={processResult.insights.actionable_insights}
            />
            <InsightCard
              title="Key Quotes"
              icon="💬"
              items={processResult.insights.key_quotes}
            />
          </div>

          {processResult.insights.target_audience && (
            <div className="card bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm">
                <span className="font-semibold text-amber-800 dark:text-amber-300">🎯 Target Audience:</span>{' '}
                <span className="text-amber-700 dark:text-amber-400">{processResult.insights.target_audience}</span>
              </p>
            </div>
          )}

          {/* Transcript preview */}
          <details className="card group">
            <summary className="flex items-center justify-between cursor-pointer">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                Full Transcript
              </h3>
              <span className="text-sm text-primary-600 dark:text-primary-400 group-open:hidden">Show</span>
              <span className="text-sm text-primary-600 dark:text-primary-400 hidden group-open:inline">Hide</span>
            </summary>
            <div className="mt-4 max-h-64 overflow-y-auto text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {processResult.transcript}
            </div>
          </details>

          {/* Generate CTA */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
          >
            {isGenerating ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Generating content for all platforms…
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5" />
                Generate Platform Content
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 3 — Generated Content                                    */}
      {/* ============================================================ */}
      {step === 'content' && platformContent && processResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Generated Content
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Based on: <span className="font-medium">{processResult.source_title}</span>
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ← New Content
              </button>
            </div>
          </div>

          {/* Platform Tabs */}
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            {(Object.keys(PLATFORM_META) as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setActivePlatform(p)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-colors ${
                  activePlatform === p
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span>{PLATFORM_META[p].icon}</span>
                <span className="hidden sm:inline">{PLATFORM_META[p].label}</span>
              </button>
            ))}
          </div>

          {/* Active Platform Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePlatform}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className={`card bg-gradient-to-br border ${PLATFORM_META[activePlatform].bgClass}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${PLATFORM_META[activePlatform].color} flex items-center gap-2`}>
                  <span className="text-xl">{PLATFORM_META[activePlatform].icon}</span>
                  {PLATFORM_META[activePlatform].label}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(activePlatform)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    {copiedPlatform === activePlatform ? (
                      <><CheckCircleIcon className="h-4 w-4 text-green-500" /> Copied!</>
                    ) : (
                      <><ClipboardDocumentIcon className="h-4 w-4" /> Copy</>
                    )}
                  </button>
                  <button
                    onClick={() => handleRegenerate(activePlatform)}
                    disabled={regeneratingPlatform === activePlatform}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${regeneratingPlatform === activePlatform ? 'animate-spin' : ''}`} />
                    {regeneratingPlatform === activePlatform ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                {platformContent[activePlatform]}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Quick access — other platforms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(PLATFORM_META) as Platform[])
              .filter((p) => p !== activePlatform)
              .map((p) => (
                <div
                  key={p}
                  onClick={() => setActivePlatform(p)}
                  className="card cursor-pointer hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <span>{PLATFORM_META[p].icon}</span>
                      {PLATFORM_META[p].label}
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(p); }}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Copy"
                      >
                        {copiedPlatform === p ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <ClipboardDocumentIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-3">
                    {platformContent[p]?.slice(0, 150)}…
                  </p>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* ── Tips Card ──────────────────────────────────────────────── */}
      {step === 'input' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20 border border-primary-200 dark:border-primary-800"
        >
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <LightBulbIcon className="h-5 w-5 text-primary-500" />
            Tips for Best Results
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>Works best with videos/podcasts that have <strong>clear speech</strong> and minimal background noise.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>YouTube videos up to <strong>60 minutes</strong> are supported. Audio files up to <strong>25 MB</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>Content-rich material like <strong>interviews, tutorials, and talks</strong> produce the best repurposed content.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>After generation, use the <strong>Regenerate</strong> button to get a fresh take on any section.</span>
            </li>
          </ul>
        </motion.div>
      )}
    </div>
  );
};

// ---- Sub-components -------------------------------------------------

const InsightCard: React.FC<{ title: string; icon: string; items: string[] }> = ({
  title,
  icon,
  items,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <span className="text-primary-500 mt-0.5 flex-shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContentRepurposer;
