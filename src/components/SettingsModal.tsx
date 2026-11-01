'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle2, AlertCircle, Loader2, Sparkles, RefreshCw, Server, Volume2, Image as ImageIcon } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [agentRouterApiKey, setAgentRouterApiKey] = useState('');
  const [agentRouterBaseUrl, setAgentRouterBaseUrl] = useState('https://agentrouter.org/v1');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [puterAuthToken, setPuterAuthToken] = useState('');
  const [cloudflareAccountId, setCloudflareAccountId] = useState('');
  const [cloudflareApiToken, setCloudflareApiToken] = useState('');
  const [cloudflareImageModel, setCloudflareImageModel] = useState('@cf/black-forest-labs/flux-1-schnell');
  const [imageProvider, setImageProvider] = useState<'cloudflare' | 'openrouter' | 'puter'>('cloudflare');
  const [textModel, setTextModel] = useState('gpt-5.6-sol');
  const [imageModel, setImageModel] = useState('bytedance-seed/seedream-5-0-flash');
  const [ttsModel, setTtsModel] = useState('fish-audio/s2.1-pro-free:free');
  const [ttsProvider, setTtsProvider] = useState<'neural' | 'openrouter' | 'cloudflare'>('cloudflare');
  const [ttsVoice, setTtsVoice] = useState('hi-IN-MadhurNeural');
  const [cloudflareTtsModel, setCloudflareTtsModel] = useState('elevenlabs/eleven-v3');
  const [cloudflareVoiceId, setCloudflareVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb');
  const [testMode, setTestMode] = useState(false);

  const [maskedAgentRouterKey, setMaskedAgentRouterKey] = useState('');
  const [maskedOpenRouterKey, setMaskedOpenRouterKey] = useState('');
  const [maskedPuterToken, setMaskedPuterToken] = useState('');
  const [maskedCloudflareToken, setMaskedCloudflareToken] = useState('');
  const [isAgentRouterConfigured, setIsAgentRouterConfigured] = useState(false);
  const [isOpenRouterConfigured, setIsOpenRouterConfigured] = useState(false);
  const [isPuterConfigured, setIsPuterConfigured] = useState(false);
  const [isCloudflareConfigured, setIsCloudflareConfigured] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadConfig = async () => {
    setIsLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success && data.config) {
        setIsAgentRouterConfigured(data.config.isAgentRouterConfigured);
        setIsOpenRouterConfigured(data.config.isOpenRouterConfigured);
        setIsPuterConfigured(data.config.isPuterConfigured);
        setIsCloudflareConfigured(data.config.isCloudflareConfigured);
        setMaskedAgentRouterKey(data.config.maskedAgentRouterKey || '');
        setMaskedOpenRouterKey(data.config.maskedApiKey || '');
        setMaskedPuterToken(data.config.maskedPuterToken || '');
        setMaskedCloudflareToken(data.config.maskedCloudflareToken || '');
        if (data.config.cloudflareAccountId) setCloudflareAccountId(data.config.cloudflareAccountId);
        if (data.config.cloudflareImageModel) setCloudflareImageModel(data.config.cloudflareImageModel);
        if (data.config.agentRouterBaseUrl) setAgentRouterBaseUrl(data.config.agentRouterBaseUrl);
        if (data.config.imageProvider) setImageProvider(data.config.imageProvider);
        if (data.config.textModel) setTextModel(data.config.textModel);
        if (data.config.imageModel) setImageModel(data.config.imageModel);
        if (data.config.ttsModel) setTtsModel(data.config.ttsModel);
        if (data.config.ttsProvider) setTtsProvider(data.config.ttsProvider);
        if (data.config.ttsVoice) setTtsVoice(data.config.ttsVoice);
        if (data.config.cloudflareTtsModel) setCloudflareTtsModel(data.config.cloudflareTtsModel);
        if (data.config.cloudflareVoiceId) setCloudflareVoiceId(data.config.cloudflareVoiceId);
        if (data.config.testMode !== undefined) setTestMode(data.config.testMode);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => void loadConfig(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const handleTestConnection = async (provider: 'agentrouter' | 'openrouter' | 'puter' | 'cloudflare') => {
    setTestResult(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_connection',
          provider,
          agentRouterApiKey: agentRouterApiKey || undefined,
          agentRouterBaseUrl: agentRouterBaseUrl || undefined,
          apiKey: openRouterApiKey || undefined,
          puterAuthToken: puterAuthToken || undefined,
          cloudflareAccountId: cloudflareAccountId || undefined,
          cloudflareApiToken: cloudflareApiToken || undefined,
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Connected successfully!' : 'Connection failed.'),
      });
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network request failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentRouterApiKey: agentRouterApiKey || undefined,
          agentRouterBaseUrl: agentRouterBaseUrl || undefined,
          apiKey: openRouterApiKey || undefined,
          puterAuthToken: puterAuthToken || undefined,
          cloudflareAccountId: cloudflareAccountId || undefined,
          cloudflareApiToken: cloudflareApiToken || undefined,
          cloudflareImageModel: cloudflareImageModel || undefined,
          imageProvider,
          textModel,
          imageModel,
          ttsModel,
          ttsProvider,
          ttsVoice,
          cloudflareTtsModel,
          cloudflareVoiceId,
          testMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onConfigSaved();
        onClose();
      } else {
        alert(data.error || 'Failed to save configuration');
      }
    } catch (err: unknown) {
      alert(`Error saving configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-panel rounded-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">API & Model Settings</h3>
              <p className="text-xs text-gray-400">Agent Router + Puter.js AI Images + Free TTS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[calc(88vh-80px)] overflow-y-auto">
          {/* Agent Router API Key */}
          <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                Agent Router ($125 Balance - Scriptwriting)
              </span>
              {isAgentRouterConfigured && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Configured ({maskedAgentRouterKey})
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Agent Router API Key</label>
              <input
                type="password"
                value={agentRouterApiKey}
                onChange={(e) => setAgentRouterApiKey(e.target.value)}
                placeholder={isAgentRouterConfigured ? 'Keep existing key or enter new' : 'sk-3dBybNf...'}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestConnection('agentrouter')}
                disabled={isLoading || (!agentRouterApiKey && !isAgentRouterConfigured)}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Test Agent Router Connection
              </button>
            </div>
          </div>

          {/* Cloudflare Workers AI (10,000 neurons/day free) */}
          <div className="p-3.5 rounded-xl bg-gray-950 border border-orange-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Cloudflare Workers AI (10,000 Free Neurons/Day)
              </span>
              {isCloudflareConfigured && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Configured ({maskedCloudflareToken})
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Cloudflare Account ID</label>
              <input
                type="text"
                value={cloudflareAccountId}
                onChange={(e) => setCloudflareAccountId(e.target.value)}
                placeholder="e.g. 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Cloudflare API Token</label>
              <input
                type="password"
                value={cloudflareApiToken}
                onChange={(e) => setCloudflareApiToken(e.target.value)}
                placeholder={isCloudflareConfigured ? 'Keep existing token or enter new' : 'Paste API token with Workers AI Read/Edit permissions...'}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Get your Account ID & API Token on the{' '}
                <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-orange-400 underline">
                  Cloudflare Dashboard
                </a>{' '}
                (Workers AI &gt; API Tokens).
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestConnection('cloudflare')}
                disabled={isLoading || (!cloudflareApiToken && !isCloudflareConfigured)}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded bg-orange-950/60 hover:bg-orange-900 text-orange-200 border border-orange-700/50 transition disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Test Cloudflare Connection
              </button>
            </div>
          </div>

          {/* Puter.js AI Images */}
          <div className="p-3.5 rounded-xl bg-gray-950 border border-indigo-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Puter.js (Free AI Photorealistic Images)
              </span>
              {isPuterConfigured && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Configured ({maskedPuterToken})
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Puter Auth Token</label>
              <input
                type="password"
                value={puterAuthToken}
                onChange={(e) => setPuterAuthToken(e.target.value)}
                placeholder={isPuterConfigured ? 'Keep existing Puter token or enter new' : 'Paste Puter token from puter.com...'}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Puter generates free AI images using models like FLUX. Get a free token at{' '}
                <a href="https://puter.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">
                  puter.com
                </a>{' '}
                or via <code className="text-gray-300 font-mono">npx @heyputer/cli login</code>.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestConnection('puter')}
                disabled={isLoading || (!puterAuthToken && !isPuterConfigured)}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/50 transition disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Test Puter.js Connection
              </button>
            </div>
          </div>

          {/* OpenRouter Free TTS Key */}
          <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                OpenRouter (Free Fish Audio TTS)
              </span>
              {isOpenRouterConfigured && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Configured ({maskedOpenRouterKey})
                </span>
              )}
            </div>

            <input
              type="password"
              value={openRouterApiKey}
              onChange={(e) => setOpenRouterApiKey(e.target.value)}
              placeholder={isOpenRouterConfigured ? 'Keep existing OpenRouter Key' : 'sk-or-v1-...'}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-rose-500 font-mono"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestConnection('openrouter')}
                disabled={isLoading || (!openRouterApiKey && !isOpenRouterConfigured)}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-700/50 transition disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Test OpenRouter Connection
              </button>
            </div>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          )}

          {/* Models Configuration */}
          <div className="border-t border-gray-800/80 pt-3 space-y-3">
            {/* Image Generation Provider Toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                AI Image Generation Provider
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setImageProvider('cloudflare')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                    imageProvider === 'cloudflare'
                      ? 'bg-orange-950/40 border-orange-500 text-orange-200'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-orange-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Cloudflare AI
                  </div>
                  <div className="text-[10px] text-gray-400">10k neurons/day free</div>
                </button>
                <button
                  type="button"
                  onClick={() => setImageProvider('puter')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                    imageProvider === 'puter'
                      ? 'bg-indigo-950/40 border-indigo-600 text-indigo-200'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-400">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Puter.js
                  </div>
                  <div className="text-[10px] text-gray-400">Free unlimited AI</div>
                </button>
                <button
                  type="button"
                  onClick={() => setImageProvider('openrouter')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                    imageProvider === 'openrouter'
                      ? 'bg-rose-950/40 border-rose-600 text-rose-200'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    OpenRouter
                  </div>
                  <div className="text-[10px] text-gray-400">Seedream, Flux, Qwen</div>
                </button>
              </div>
            </div>

            {/* Cloudflare Workers AI Model Selection */}
            {imageProvider === 'cloudflare' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-300">
                    Cloudflare Workers AI Model
                  </label>
                  <span className="text-[10px] text-orange-400 font-mono">10,000 neurons/day tier</span>
                </div>
                <input
                  type="text"
                  value={cloudflareImageModel}
                  onChange={(e) => setCloudflareImageModel(e.target.value)}
                  placeholder="@cf/black-forest-labs/flux-1-schnell"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-orange-300 font-mono focus:border-orange-500 focus:outline-none mb-1.5"
                />
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {[
                    '@cf/black-forest-labs/flux-1-schnell',
                    '@cf/stabilityai/stable-diffusion-xl-base-1.0',
                    '@cf/bytedance/stable-diffusion-xl-lightning',
                  ].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCloudflareImageModel(m)}
                      className={`px-2 py-0.5 rounded border font-mono transition ${
                        cloudflareImageModel === m
                          ? 'bg-orange-900/60 border-orange-500 text-orange-200'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {m.split('/').slice(-1)[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* OpenRouter Image Model Selection */}
            {imageProvider === 'openrouter' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-300">
                    OpenRouter Image Generation Model
                  </label>
                  <span className="text-[10px] text-rose-400 font-mono">16:9 widescreen output</span>
                </div>
                <input
                  type="text"
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                  placeholder="bytedance-seed/seedream-5-0-flash"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-rose-300 font-mono focus:border-rose-500 focus:outline-none mb-1.5"
                />
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {[
                    'bytedance-seed/seedream-5-0-flash',
                    'qwen/qwen-image-2.1-turbo',
                    'google/gemini-nano-banana-2.1',
                    'black-forest-labs/flux-3-image-klein',
                    'recraft/recraft-v4.1-flash',
                  ].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setImageModel(m)}
                      className={`px-2 py-0.5 rounded border font-mono transition ${
                        imageModel === m
                          ? 'bg-rose-900/60 border-rose-500 text-rose-200'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {m.split('/')[1] || m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-300">
                  Agent Router Text Model
                </label>
                <span className="text-[10px] text-emerald-400 font-mono">gpt-5.6-sol (0.5 ratio)</span>
              </div>
              <input
                type="text"
                value={textModel}
                onChange={(e) => setTextModel(e.target.value)}
                placeholder="gpt-5.6-sol"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-gray-200 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Voice Narration Settings */}
            <div className="pt-2 border-t border-gray-800/80 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1.5 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  Voice Narration Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTtsProvider('cloudflare')}
                    className={`p-2 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                      ttsProvider === 'cloudflare'
                        ? 'bg-orange-950/40 border-orange-500 text-orange-200 shadow-sm shadow-orange-950'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-semibold text-xs text-orange-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      Cloudflare AI
                    </div>
                    <div className="text-[10px] text-gray-400">ElevenLabs & Deepgram</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTtsProvider('neural')}
                    className={`p-2 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                      ttsProvider === 'neural'
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm shadow-cyan-950'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-semibold text-xs text-cyan-400">
                      <Volume2 className="w-3.5 h-3.5" />
                      Studio Neural
                    </div>
                    <div className="text-[10px] text-gray-400">Free, Hindi & English</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTtsProvider('openrouter')}
                    className={`p-2 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                      ttsProvider === 'openrouter'
                        ? 'bg-rose-950/40 border-rose-500 text-rose-200 shadow-sm shadow-rose-950'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-semibold text-xs text-rose-400">
                      <Volume2 className="w-3.5 h-3.5" />
                      OpenRouter
                    </div>
                    <div className="text-[10px] text-gray-400">Fish Audio & OpenAI</div>
                  </button>
                </div>
              </div>

              {ttsProvider === 'cloudflare' && (
                <div className="space-y-2 bg-orange-950/20 p-3 rounded-xl border border-orange-900/30">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-orange-300">
                      Cloudflare TTS Model
                    </label>
                    <span className="text-[10px] text-orange-400/80">elevenlabs/eleven-v3</span>
                  </div>

                  <input
                    type="text"
                    value={cloudflareTtsModel}
                    onChange={(e) => setCloudflareTtsModel(e.target.value)}
                    placeholder="elevenlabs/eleven-v3"
                    className="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-orange-300 font-mono focus:border-orange-500 focus:outline-none"
                  />

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'elevenlabs/eleven-v3',
                      '@cf/deepgram/aura-2-en',
                      '@cf/myshell-ai/melotts',
                    ].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCloudflareTtsModel(m)}
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono transition ${
                          cloudflareTtsModel === m
                            ? 'bg-orange-900/60 border-orange-500 text-orange-200'
                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {cloudflareTtsModel.includes('elevenlabs') && (
                    <div className="pt-2 border-t border-orange-900/30">
                      <label className="text-[11px] font-medium text-orange-300 block mb-1">
                        ElevenLabs Voice ID
                      </label>
                      <input
                        type="text"
                        value={cloudflareVoiceId}
                        onChange={(e) => setCloudflareVoiceId(e.target.value)}
                        placeholder="JBFqnCBsd6RMkjVDRZzb"
                        className="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-orange-200 font-mono focus:border-orange-500 focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
                          { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
                          { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
                          { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
                        ].map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setCloudflareVoiceId(v.id)}
                            className={`px-2 py-0.5 rounded border text-[10px] transition ${
                              cloudflareVoiceId === v.id
                                ? 'bg-orange-900/60 border-orange-500 text-orange-200'
                                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {ttsProvider === 'neural' && (
                <div className="space-y-2 bg-cyan-950/20 p-3 rounded-xl border border-cyan-900/30">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-cyan-300">
                      Realistic Voice Actor
                    </label>
                    <span className="text-[10px] text-cyan-400/80">Zero robotic accent</span>
                  </div>

                  <input
                    type="text"
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    placeholder="hi-IN-MadhurNeural"
                    className="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-cyan-200 font-mono focus:border-cyan-500 focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {[
                      { id: 'hi-IN-MadhurNeural', label: '🇮🇳 Madhur (Hindi Male)', desc: 'Deep Documentary' },
                      { id: 'hi-IN-SwaraNeural', label: '🇮🇳 Swara (Hindi Female)', desc: 'Expressive Story' },
                      { id: 'en-US-ChristopherNeural', label: '🇺🇸 Christopher (Eng)', desc: 'Cinematic Doc' },
                      { id: 'en-US-GuyNeural', label: '🇺🇸 Guy (Eng Male)', desc: 'Clear & Natural' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setTtsVoice(v.id)}
                        className={`px-2 py-1.5 rounded-lg border text-left transition flex flex-col ${
                          ttsVoice === v.id
                            ? 'bg-cyan-900/50 border-cyan-400 text-white'
                            : 'bg-gray-900/80 border-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <span className="text-[11px] font-medium leading-tight">{v.label}</span>
                        <span className="text-[9px] text-gray-500">{v.desc}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 pt-0.5">
                    💡 Auto-selects Madhur (Hindi) or Christopher (English) based on detected script text.
                  </p>
                </div>
              )}

              {ttsProvider === 'openrouter' && (
                <div className="space-y-2 bg-rose-950/20 p-3 rounded-xl border border-rose-900/30">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-rose-300">
                      OpenRouter TTS Model
                    </label>
                    <span className="text-[10px] text-rose-400/80">API Speech Models</span>
                  </div>

                  <input
                    type="text"
                    value={ttsModel}
                    onChange={(e) => setTtsModel(e.target.value)}
                    placeholder="fish-audio/s2.1-pro-free:free"
                    className="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-rose-300 font-mono focus:border-rose-500 focus:outline-none"
                  />

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'fish-audio/s2.1-pro-free:free',
                      'openai/tts-1',
                      'hexgrad/kokoro-82m',
                    ].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTtsModel(m)}
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono transition ${
                          ttsModel === m
                            ? 'bg-rose-900/60 border-rose-500 text-rose-200'
                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-950/40 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
