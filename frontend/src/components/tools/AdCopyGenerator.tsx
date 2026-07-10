import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  MegaphoneIcon,
  LightBulbIcon,
  BeakerIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface AdCopyGeneratorProps {
  tool: any;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

const platforms = [
  { value: 'google', label: '🔍 Google Ads', desc: '3 headlines + 2 descriptions' },
  { value: 'facebook', label: '📘 Facebook', desc: 'Primary text + headline + CTA' },
  { value: 'instagram', label: '📸 Instagram', desc: 'Caption + hashtags + CTA' },
  { value: 'linkedin', label: '💼 LinkedIn', desc: 'Intro + headline + description' },
  { value: 'tiktok', label: '🎵 TikTok', desc: 'Hook + body copy + CTA' },
];

const tones = [
  { value: 'persuasive', label: '🎯 Persuasive' },
  { value: 'urgent', label: '⚡ Urgent' },
  { value: 'friendly', label: '😊 Friendly' },
  { value: 'professional', label: '💼 Professional' },
  { value: 'playful', label: '🎉 Playful' },
  { value: 'bold', label: '💪 Bold' },
];

interface Variation {
  variation_name: string;
  headlines: string[];
  descriptions: string[];
  cta: string;
  display_url_path?: string;
  strategy_note: string;
}

interface AdResult {
  platform: string;
  variations: Variation[];
  targeting_suggestions: string[];
  a_b_testing_tips: string[];
  estimated_quality_score: string;
}

const AdCopyGenerator: React.FC<AdCopyGeneratorProps> = ({ tool, isProcessing, setIsProcessing }) => {
  const [product, setProduct] = useState('');
  const [platform, setPlatform] = useState('google');
  const [targetAudience, setTargetAudience] = useState('');
  const [usp, setUsp] = useState('');
  const [tone, setTone] = useState('persuasive');
  const [numVariations, setNumVariations] = useState(3);
  const [result, setResult] = useState<AdResult | null>(null);

  const handleGenerate = async () => {
    if (!product.trim()) return toast.error('Please describe your product or service');
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await apiClient.post<{ result: AdResult; processing_time: number }>(
        '/tools/ad-copy-generator/',
        { product_or_service: product, platform, target_audience: targetAudience, unique_selling_points: usp, tone, num_variations: numVariations }
      );
      setResult(response.result);
      toast.success(`${numVariations} ad variation${numVariations > 1 ? 's' : ''} generated in ${response.processing_time?.toFixed(1)}s!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate ad copy');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyVariation = (v: Variation) => {
    const text = [
      v.variation_name,
      v.headlines?.length ? `\nHeadlines:\n${v.headlines.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}` : '',
      v.descriptions?.length ? `\nDescriptions:\n${v.descriptions.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}` : '',
      v.cta ? `\nCTA: ${v.cta}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Ad variation copied!');
  };

  const copyAll = () => {
    if (!result) return;
    const text = result.variations.map((v, i) => {
      return [
        `--- Variation ${i + 1}: ${v.variation_name} ---`,
        v.headlines?.map((h, j) => `Headline ${j + 1}: ${h}`).join('\n'),
        v.descriptions?.map((d, j) => `Description ${j + 1}: ${d}`).join('\n'),
        v.cta ? `CTA: ${v.cta}` : '',
        v.strategy_note ? `Strategy: ${v.strategy_note}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('All variations copied!');
  };

  const platformLabel = platforms.find(p => p.value === platform)?.label || platform;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <MegaphoneIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
      </div>

      {/* Form */}
      <div className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product or Service *</label>
          <textarea
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g., Sovereign — an AI-powered writing platform with 35+ tools for content creation, SEO, education, and job applications"
            className="input w-full h-20 resize-none"
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1">{product.length}/500</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platform</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {platforms.map(p => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className={`p-3 rounded-lg border text-left transition ${
                  platform === p.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <p className="font-medium text-sm text-gray-900 dark:text-white">{p.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
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
              placeholder="e.g., freelance writers aged 25-40"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unique Selling Points <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={usp}
              onChange={(e) => setUsp(e.target.value)}
              placeholder="e.g., free tier, 35+ tools, no signup to try"
              className="input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tone</label>
            <div className="flex flex-wrap gap-2">
              {tones.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    tone === t.value
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Number of Variations</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNumVariations(n)}
                  className={`w-10 h-10 rounded-lg text-sm font-bold border transition ${
                    numVariations === n
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isProcessing || !product.trim()}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating Ad Copy...</>
          ) : (
            <><MegaphoneIcon className="h-5 w-5" /> Generate Ad Copy</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {platformLabel} — {result.variations?.length || 0} Variation{(result.variations?.length || 0) > 1 ? 's' : ''}
              </h3>
              <button onClick={copyAll} className="btn btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy All
              </button>
            </div>
          </div>

          {/* Variations */}
          {result.variations?.map((v, idx) => (
            <div key={idx} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <h4 className="font-bold text-gray-900 dark:text-white">{v.variation_name || `Variation ${idx + 1}`}</h4>
                </div>
                <button onClick={() => copyVariation(v)} className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-1" title="Copy variation">
                  <ClipboardDocumentIcon className="h-4 w-4" />
                </button>
              </div>

              {v.headlines?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Headlines</p>
                  <div className="space-y-1.5">
                    {v.headlines.map((h, i) => (
                      <p key={i} className="text-primary-700 dark:text-primary-300 font-semibold text-[15px]">{h}</p>
                    ))}
                  </div>
                </div>
              )}

              {v.descriptions?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Descriptions</p>
                  <div className="space-y-1.5">
                    {v.descriptions.map((d, i) => (
                      <p key={i} className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{d}</p>
                    ))}
                  </div>
                </div>
              )}

              {v.cta && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-gray-500 uppercase">CTA:</span>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold">{v.cta}</span>
                </div>
              )}

              {v.strategy_note && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 flex items-start gap-1.5">
                    <LightBulbIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                    <span>{v.strategy_note}</span>
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.targeting_suggestions?.length > 0 && (
              <div className="card !bg-blue-50 dark:!bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-1.5">
                  <SparklesIcon className="h-4 w-4" /> Targeting Suggestions
                </h4>
                <ul className="space-y-2">
                  {result.targeting_suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                      <span className="shrink-0">🎯</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.a_b_testing_tips?.length > 0 && (
              <div className="card !bg-purple-50 dark:!bg-purple-900/20 border-purple-200 dark:border-purple-800">
                <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-1.5">
                  <BeakerIcon className="h-4 w-4" /> A/B Testing Tips
                </h4>
                <ul className="space-y-2">
                  {result.a_b_testing_tips.map((t, i) => (
                    <li key={i} className="text-sm text-purple-800 dark:text-purple-200 flex items-start gap-2">
                      <span className="shrink-0">🧪</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdCopyGenerator;
