'use client';

import React, { useEffect, useState } from 'react';
import { 
  Volume2, 
  Play, 
  Sparkles, 
  Loader2, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Sliders,
  Check,
  Radio
} from 'lucide-react';
import { ContentStyle, TtsProvider } from '@/lib/types';
import { hasSarvamVoice, SARVAM_VOICE_GROUPS } from '@/lib/sarvam/voices';

interface TtsStudioTesterProps {
  onSavedAsDefault?: () => void;
}

type ProviderHealth = 'ready' | 'configured' | 'missing' | 'error';

function ProviderStatus({ status }: { status: ProviderHealth }) {
  const label = status === 'ready' ? 'Ready' : status === 'configured' ? 'Configured' : status === 'error' ? 'Check key/quota' : 'Key required';
  return <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${status === 'ready' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : status === 'error' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' : status === 'configured' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-gray-500/10 text-secondary'}`}>{label}</span>;
}

const SAMPLE_TEXTS = [
  {
    label: 'Space Mystery',
    text: 'Far beyond the observable cosmos, primordial gravitational waves echo across fourteen billion years of silence.',
  },
  {
    label: 'Bermuda Enigma',
    text: 'In the western Atlantic, violent underwater currents and sudden atmospheric disturbances have perplexed navigators for centuries.',
  },
  {
    label: 'Ancient History',
    text: 'Deep beneath the desert sands lie the forgotten colossal gates of an empire that vanished overnight.',
  },
  {
    label: 'Hindi Documentary',
    text: 'हिमालय के दुर्गम शिखरों और प्राचीन गुफाओं में आज भी अनगिनत अनसुलझे रहस्य दबे हुए हैं।',
  },
];

const KIDS_PREVIEW_TEXT = 'Milo the little dragon unfolded a rainbow map, packed three berry sandwiches, and invited his best friends on a cheerful adventure.';

const ELEVENLABS_VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Deep Narrative)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Calm & Clear)' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Dynamic & Bold)' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Documentary Male)' },
];

export const TtsStudioTester: React.FC<TtsStudioTesterProps> = ({ onSavedAsDefault }) => {
  const [audience, setAudience] = useState<ContentStyle>('documentary');
  const [provider, setProvider] = useState<TtsProvider>('neural');
  
  // Cloudflare settings
  const [cfModel, setCfModel] = useState<string>('elevenlabs/eleven-v3');
  const [cfVoiceId, setCfVoiceId] = useState<string>('JBFqnCBsd6RMkjVDRZzb');
  
  // OpenRouter settings
  const [orModel, setOrModel] = useState<string>('fish-audio/s2.1-pro-free:free');
  const [orVoice, setOrVoice] = useState<string>('onyx');
  
  // Neural settings
  const [neuralVoice, setNeuralVoice] = useState<string>('en-US-ChristopherNeural');

  // Sarvam settings
  const [sarvamModel, setSarvamModel] = useState('bulbul:v4-flash');
  const [sarvamVoice, setSarvamVoice] = useState('anand_hi_documentary');

  // Input & state
  const [text, setText] = useState<string>(SAMPLE_TEXTS[0].text);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSizeBytes, setAudioSizeBytes] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [providerHealth, setProviderHealth] = useState<Record<TtsProvider, ProviderHealth>>({ neural: 'ready', openrouter: 'missing', cloudflare: 'missing', sarvam: 'missing' });

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(response => response.json())
      .then(data => {
        const config = data.runtimeConfig || {};
        setProviderHealth(current => ({
          ...current,
          neural: 'ready',
          openrouter: config.hasOpenRouterKey ? 'configured' : 'missing',
          cloudflare: config.hasCloudflareToken ? 'configured' : 'missing',
          sarvam: config.hasSarvamKey ? 'configured' : 'missing',
        }));
        const nextProvider = audience === 'kids' ? config.kidsTtsProvider : config.documentaryTtsProvider;
        const nextModel = audience === 'kids' ? config.kidsTtsModel : config.documentaryTtsModel;
        const nextVoice = audience === 'kids' ? config.kidsTtsVoice : config.documentaryTtsVoice;
        if (nextProvider) setProvider(nextProvider);
        if (nextProvider === 'sarvam') {
          setSarvamModel(nextModel || 'bulbul:v4-flash');
          setSarvamVoice(nextVoice || (audience === 'kids' ? 'chhavi_hi_kids' : 'anand_hi_documentary'));
        } else if (nextProvider === 'neural' && nextVoice) {
          setNeuralVoice(nextVoice);
        } else if (nextProvider === 'openrouter') {
          if (nextModel) setOrModel(nextModel);
          if (nextVoice) setOrVoice(nextVoice);
        } else if (nextProvider === 'cloudflare') {
          if (nextModel) setCfModel(nextModel);
          if (nextVoice) setCfVoiceId(nextVoice);
        }
      })
      .catch(() => undefined);
  }, [audience]);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setAudioUrl(null);
    setSaveSuccessMsg(null);

    try {
      const payload: Record<string, string> = {
        text: text.trim(),
        provider,
        contentStyle: audience,
      };

      if (provider === 'cloudflare') {
        payload.model = cfModel;
        payload.voiceId = cfVoiceId;
      } else if (provider === 'openrouter') {
        payload.model = orModel;
        payload.voice = orVoice;
      } else if (provider === 'sarvam') {
        payload.model = sarvamModel;
        payload.voice = sarvamVoice;
        payload.language = /[\u0900-\u097F]/.test(text) ? 'Hindi' : 'English';
      } else {
        payload.voice = neuralVoice;
      }

      const res = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate speech audio.');
      }

      setAudioUrl(data.audioUrl);
      setAudioSizeBytes(data.sizeBytes);
      setProviderHealth(current => ({ ...current, [provider]: 'ready' }));
    } catch (err: unknown) {
      console.error('TTS test error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'TTS generation failed.');
      setProviderHealth(current => ({ ...current, [provider]: 'error' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetAsDefault = async () => {
    setIsSavingDefault(true);
    setSaveSuccessMsg(null);
    try {
      const prefix = audience === 'kids' ? 'kids' : 'documentary';
      const updates: Record<string, string> = {
        [`${prefix}TtsProvider`]: provider,
      };

      if (provider === 'cloudflare') {
        updates[`${prefix}TtsModel`] = cfModel;
        updates[`${prefix}TtsVoice`] = cfVoiceId;
      } else if (provider === 'openrouter') {
        updates[`${prefix}TtsModel`] = orModel;
        updates[`${prefix}TtsVoice`] = orVoice;
      } else if (provider === 'sarvam') {
        updates[`${prefix}TtsModel`] = sarvamModel;
        updates[`${prefix}TtsVoice`] = sarvamVoice;
      } else {
        updates[`${prefix}TtsModel`] = 'edge-neural';
        updates[`${prefix}TtsVoice`] = neuralVoice;
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (data.success) {
        const selectedModel = provider === 'cloudflare' ? cfModel : provider === 'openrouter' ? orModel : provider === 'sarvam' ? sarvamModel : neuralVoice;
        setSaveSuccessMsg(`${audience === 'kids' ? 'Kids & Family' : 'Documentary'} voice updated to ${provider.toUpperCase()} (${selectedModel}).`);
        if (onSavedAsDefault) onSavedAsDefault();
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      } else {
        throw new Error(data.error || 'Failed to save default settings');
      }
    } catch (err: unknown) {
      alert(`Could not save default: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSavingDefault(false);
    }
  };

  return (
    <div className="surface-raised rounded-3xl p-6 sm:p-8 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-1/4 -mt-16 w-80 h-80 bg-gradient-to-br from-cyan-500/10 via-indigo-500/10 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-800/80 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Admin-only narration testing</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Voice provider quality lab
          </h2>
          <p className="text-xs sm:text-sm text-gray-400">
            Compare Sarvam, Cloudflare, OpenRouter, and neural voices before promoting one to an audience-specific production profile.
          </p>
        </div>

        {audioUrl && (
          <button
            onClick={handleSetAsDefault}
            disabled={isSavingDefault}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-lg transition active:scale-95 disabled:opacity-50 shrink-0 self-start sm:self-auto"
          >
            {isSavingDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Use for {audience === 'kids' ? 'Kids Videos' : 'Documentaries'}</span>
          </button>
        )}
      </div>

      {saveSuccessMsg && (
        <div className="mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Left Controls, Right Text & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Provider & Voice Selectors */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">1. Choose audience profile</label>
            <div className="grid grid-cols-2 gap-2 rounded-2xl surface-soft p-1.5">
              <button
                type="button"
                onClick={() => { setAudience('documentary'); setText(SAMPLE_TEXTS[0].text); }}
                className={`min-h-11 rounded-xl text-xs font-bold transition ${audience === 'documentary' ? 'bg-[var(--app-surface)] text-primary shadow-sm' : 'text-secondary'}`}
                aria-pressed={audience === 'documentary'}
              >
                Documentary
              </button>
              <button
                type="button"
                onClick={() => { setAudience('kids'); setText(KIDS_PREVIEW_TEXT); }}
                className={`min-h-11 rounded-xl text-xs font-bold transition ${audience === 'kids' ? 'bg-[var(--app-surface)] text-primary shadow-sm' : 'text-secondary'}`}
                aria-pressed={audience === 'kids'}
              >
                Kids & Family
              </button>
            </div>
          </div>
          
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
              2. Choose TTS Provider
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setProvider('cloudflare')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  provider === 'cloudflare'
                    ? 'bg-orange-500/10 border-orange-500 ring-1 ring-orange-500/30 shadow-sm'
                    : 'bg-[var(--app-surface)] border-theme hover:border-orange-500/50 hover:bg-orange-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-bold text-xs text-primary flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 shrink-0" />Cloudflare</span>
                  <ProviderStatus status={providerHealth.cloudflare} />
                </div>
                <div className="text-[10px] text-secondary mt-1">ElevenLabs & Deepgram</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProvider('sarvam');
                  setSarvamModel('bulbul:v4-flash');
                  setSarvamVoice(audience === 'kids' ? 'chhavi_hi_kids' : 'anand_hi_documentary');
                }}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  provider === 'sarvam'
                    ? 'bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500/30 shadow-sm'
                    : 'bg-[var(--app-surface)] border-theme hover:border-indigo-500/50 hover:bg-indigo-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-bold text-xs text-primary flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 shrink-0" />Sarvam AI</span>
                  <ProviderStatus status={providerHealth.sarvam} />
                </div>
                <div className="text-[10px] text-secondary mt-1">Bulbul v4 · Indic voices</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('openrouter')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  provider === 'openrouter'
                    ? 'bg-rose-500/10 border-rose-500 ring-1 ring-rose-500/30 shadow-sm'
                    : 'bg-[var(--app-surface)] border-theme hover:border-rose-500/50 hover:bg-rose-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-bold text-xs text-primary flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 shrink-0" />OpenRouter</span>
                  <ProviderStatus status={providerHealth.openrouter} />
                </div>
                <div className="text-[10px] text-secondary mt-1">Fish Audio & OpenAI</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('neural')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  provider === 'neural'
                    ? 'bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500/30 shadow-sm'
                    : 'bg-[var(--app-surface)] border-theme hover:border-cyan-500/50 hover:bg-cyan-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-bold text-xs text-primary flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 shrink-0" />Neural</span>
                  <ProviderStatus status={providerHealth.neural} />
                </div>
                <div className="text-[10px] text-secondary mt-1">Local studio voice</div>
              </button>
            </div>
          </div>

          {/* Provider-Specific Options */}
          <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800/80 space-y-3.5">
            {provider === 'cloudflare' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-orange-300">
                      Cloudflare TTS Model
                    </label>
                    <span className="text-[10px] text-orange-400 font-mono">ElevenLabs / Deepgram</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: '@cf/myshell-ai/melotts', label: '@cf/myshell-ai/melotts (Free Multilingual)', badge: 'MeloTTS' },
                      { id: '@cf/deepgram/aura-2-en', label: '@cf/deepgram/aura-2-en (Free Deepgram)', badge: 'Aura 2 Eng' },
                      { id: '@cf/deepgram/aura-1', label: '@cf/deepgram/aura-1 (Free Standard)', badge: 'Aura 1' },
                      { id: '@cf/deepgram/aura-2-es', label: '@cf/deepgram/aura-2-es (Spanish)', badge: 'Aura Spanish' },
                      { id: 'elevenlabs/eleven-v3', label: 'elevenlabs/eleven-v3 (ElevenLabs V3)', badge: 'ElevenLabs' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCfModel(m.id)}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition border flex items-center justify-between ${
                          cfModel === m.id
                            ? 'bg-orange-950/50 border-orange-500 text-orange-200 font-medium'
                            : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <span>{m.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                          {m.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <input
                      type="text"
                      value={cfModel}
                      onChange={(e) => setCfModel(e.target.value)}
                      placeholder="e.g. @cf/myshell-ai/melotts"
                      className="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-orange-300 font-mono focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {cfModel === 'elevenlabs/eleven-v3' && (
                  <div className="pt-2 border-t border-gray-800/80 space-y-2">
                    <label className="text-xs font-semibold text-orange-300 block">
                      ElevenLabs Voice Persona
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ELEVENLABS_VOICES.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setCfVoiceId(v.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] border transition ${
                            cfVoiceId === v.id
                              ? 'bg-orange-900/40 border-orange-500 text-orange-200 font-medium'
                              : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1">
                      <input
                        type="text"
                        value={cfVoiceId}
                        onChange={(e) => setCfVoiceId(e.target.value)}
                        placeholder="Or custom Voice ID: JBFqnCBsd6RMkjVDRZzb"
                        className="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-orange-300 font-mono focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {provider === 'openrouter' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-rose-300 block mb-1.5">
                    OpenRouter Speech Model
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: 'fish-audio/s2.1-pro-free:free', label: 'fish-audio/s2.1-pro-free:free (Free Tier)' },
                      { id: 'openai/tts-1', label: 'openai/tts-1 (Consistent Narrator Voice)' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setOrModel(m.id)}
                        className={`px-3 py-2 rounded-xl text-left text-xs transition border ${
                          orModel === m.id
                            ? 'bg-rose-950/50 border-rose-500 text-rose-200 font-medium'
                            : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {orModel.includes('openai') && (
                  <div className="pt-2 border-t border-gray-800/80 space-y-2">
                    <label className="text-xs font-semibold text-rose-300 block">
                      OpenAI Voice Actor
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['onyx', 'alloy', 'echo', 'fable', 'nova', 'shimmer'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setOrVoice(v)}
                          className={`px-2 py-1 rounded-lg text-center text-xs border capitalize transition ${
                            orVoice === v
                              ? 'bg-rose-900/40 border-rose-500 text-rose-200 font-medium'
                              : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {provider === 'neural' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-cyan-300 block mb-1.5">
                  Studio Neural Narrator
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'en-US-ChristopherNeural', label: 'Christopher (Deep Documentary Male)', lang: 'English' },
                    { id: 'en-US-JennyNeural', label: 'Jenny (Clear Expressive Female)', lang: 'English' },
                    { id: 'hi-IN-MadhurNeural', label: 'Madhur (Authentic Hindi Documentary Male)', lang: 'Hindi' },
                    { id: 'hi-IN-SwaraNeural', label: 'Swara (Natural Hindi Female Narrator)', lang: 'Hindi' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setNeuralVoice(v.id)}
                      className={`px-3 py-2 rounded-xl text-left text-xs transition border flex items-center justify-between ${
                        neuralVoice === v.id
                          ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 font-medium'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <span>{v.label}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{v.lang}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {provider === 'sarvam' && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-indigo-300 block">
                  Sarvam model
                  <select value={sarvamModel} onChange={event => setSarvamModel(event.target.value)} className="app-field mt-1.5 text-xs">
                    <option value="bulbul:v4-flash">bulbul:v4-flash · recommended</option>
                    <option value="bulbul:v3">bulbul:v3 · stable</option>
                    <option value="bulbul:v2">bulbul:v2 · legacy</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-indigo-300 block">
                  Sarvam speaker
                  <select value={sarvamVoice} onChange={event => setSarvamVoice(event.target.value)} className="app-field mt-1.5 text-xs">
                    {!hasSarvamVoice(sarvamVoice) && <option value={sarvamVoice}>{sarvamVoice}</option>}
                    {SARVAM_VOICE_GROUPS.map(group => (
                      <optgroup key={group.label} label={group.label}>
                        {group.voices.map(option => <option key={`${group.label}-${option.id}`} value={option.id}>{option.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Text Prompt, Generator & Audio Player */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                3. Enter Narration Text
              </label>
              <span className="text-[11px] text-gray-500">{text.length} characters</span>
            </div>

            {/* Quick text chips */}
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_TEXTS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => setText(sample.text)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                    text === sample.text
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste any documentary narration sentence here..."
              className="w-full p-3.5 bg-gray-900 border border-gray-800 rounded-2xl text-xs sm:text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition leading-relaxed resize-none shadow-inner"
            />
          </div>

          {/* Action Button */}
          <div className="pt-1">
            <button
              onClick={handleGenerate}
              disabled={isLoading || !text.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-amber-600 hover:from-cyan-500 hover:to-amber-500 text-white font-semibold text-sm shadow-xl shadow-cyan-950/40 transition active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing Voice Narration...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Generate Voice Audio Now</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">TTS Synthesis Failed</span>
                <span className="text-[11px] text-rose-300/80 block leading-relaxed">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Audio Player Card */}
          {audioUrl && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 border border-cyan-500/30 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Speech Generated Successfully
                </span>
                {audioSizeBytes && (
                  <span className="text-gray-400 font-mono text-[11px]">
                    {(audioSizeBytes / 1024).toFixed(1)} KB • MP3
                  </span>
                )}
              </div>

              {/* Native audio player */}
              <div className="bg-gray-950 rounded-xl p-2 border border-gray-800">
                <audio
                  controls
                  autoPlay
                  src={audioUrl}
                  className="w-full h-10 filter invert hue-rotate-180 brightness-150 contrast-125"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-gray-500 font-mono">
                  Engine: <span className="text-cyan-400">{provider}</span> ({provider === 'cloudflare' ? cfModel : provider === 'openrouter' ? orModel : provider === 'sarvam' ? sarvamModel : neuralVoice})
                </span>

                <a
                  href={audioUrl}
                  download="cinedoc_narration_sample.mp3"
                  className="flex items-center gap-1.5 text-xs text-cyan-300 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP3</span>
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
