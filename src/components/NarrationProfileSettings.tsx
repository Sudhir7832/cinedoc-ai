'use client';

import { BookOpen, CheckCircle2, Film, KeyRound, Mic2 } from 'lucide-react';
import { TtsProvider } from '@/lib/types';
import { hasSarvamVoice, SARVAM_VOICE_GROUPS } from '@/lib/sarvam/voices';

export interface NarrationSettingsValue {
  hasSarvamKey: boolean;
  documentaryTtsProvider: TtsProvider;
  documentaryTtsModel: string;
  documentaryTtsVoice: string;
  kidsTtsProvider: TtsProvider;
  kidsTtsModel: string;
  kidsTtsVoice: string;
}

interface NarrationProfileSettingsProps {
  value: NarrationSettingsValue;
  onChange: (updates: Partial<NarrationSettingsValue>) => void;
}

const PROVIDERS: Array<{ id: TtsProvider; label: string }> = [
  { id: 'neural', label: 'Microsoft Neural' },
  { id: 'sarvam', label: 'Sarvam AI' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'cloudflare', label: 'Cloudflare' },
];

const NEURAL_DOCUMENTARY_VOICES = [
  ['hi-IN-MadhurNeural', 'Madhur · Hindi documentary'],
  ['en-US-ChristopherNeural', 'Christopher · English documentary'],
  ['en-GB-RyanNeural', 'Ryan · British documentary'],
];

const NEURAL_KIDS_VOICES = [
  ['hi-IN-SwaraNeural', 'Swara · Hindi kids'],
  ['en-US-AriaNeural', 'Aria · English kids'],
  ['en-GB-SoniaNeural', 'Sonia · British stories'],
];

function ProfileEditor({
  audience,
  provider,
  model,
  voice,
  onChange,
}: {
  audience: 'documentary' | 'kids';
  provider: TtsProvider;
  model: string;
  voice: string;
  onChange: (updates: { provider?: TtsProvider; model?: string; voice?: string }) => void;
}) {
  const isKids = audience === 'kids';
  const Icon = isKids ? BookOpen : Film;
  const voiceOptions = isKids ? NEURAL_KIDS_VOICES : NEURAL_DOCUMENTARY_VOICES;

  const selectProvider = (nextProvider: TtsProvider) => {
    if (nextProvider === 'sarvam') {
      onChange({ provider: nextProvider, model: 'bulbul:v4-flash', voice: isKids ? 'chhavi_hi_kids' : 'anand_hi_documentary' });
    } else if (nextProvider === 'neural') {
      onChange({ provider: nextProvider, model: 'edge-neural', voice: isKids ? 'hi-IN-SwaraNeural' : 'hi-IN-MadhurNeural' });
    } else if (nextProvider === 'cloudflare') {
      onChange({ provider: nextProvider, model: 'elevenlabs/eleven-v3', voice: 'JBFqnCBsd6RMkjVDRZzb' });
    } else {
      onChange({ provider: nextProvider, model: 'fish-audio/s2.1-pro-free:free', voice: isKids ? 'shimmer' : 'onyx' });
    }
  };

  return (
    <section className="surface-card rounded-3xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isKids ? 'accent-soft' : 'brand-soft'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h4 className="text-sm font-extrabold text-primary">{isKids ? 'Kids & Family narration' : 'Documentary narration'}</h4>
          <p className="mt-1 text-[11px] leading-5 text-secondary">{isKids ? 'Friendly, expressive voices for entertainment, adventures, learning, and bedtime.' : 'Measured voices for documentary-style, cinematic productions.'}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROVIDERS.map(option => (
          <button
            type="button"
            key={option.id}
            onClick={() => selectProvider(option.id)}
            className={`min-h-11 rounded-xl border px-2.5 text-[11px] font-bold transition ${provider === option.id ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)] brand-text' : 'border-theme bg-[var(--app-surface-soft)] text-secondary hover:text-[var(--app-text)]'}`}
            aria-pressed={provider === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-secondary">
          Model
          {provider === 'sarvam' ? (
            <select value={model} onChange={event => onChange({ model: event.target.value })} className="app-field mt-1.5 text-xs">
              <option value="bulbul:v4-flash">bulbul:v4-flash · recommended</option>
              <option value="bulbul:v3">bulbul:v3 · stable</option>
              <option value="bulbul:v2">bulbul:v2 · legacy controls</option>
            </select>
          ) : provider === 'neural' ? (
            <input value="edge-neural" readOnly className="app-field mt-1.5 text-xs opacity-70" />
          ) : (
            <input value={model} onChange={event => onChange({ model: event.target.value })} className="app-field mt-1.5 text-xs" placeholder="Provider model ID" />
          )}
        </label>

        <label className="text-xs font-semibold text-secondary">
          Voice / speaker
          {provider === 'sarvam' ? (
            <select value={voice} onChange={event => onChange({ voice: event.target.value })} className="app-field mt-1.5 text-xs">
              {!hasSarvamVoice(voice) && <option value={voice}>{voice}</option>}
              {SARVAM_VOICE_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.voices.map(option => <option key={`${group.label}-${option.id}`} value={option.id}>{option.label}</option>)}
                </optgroup>
              ))}
            </select>
          ) : provider === 'neural' ? (
            <select value={voice} onChange={event => onChange({ voice: event.target.value })} className="app-field mt-1.5 text-xs">
              {!voiceOptions.some(([id]) => id === voice) && <option value={voice}>{voice}</option>}
              {voiceOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          ) : (
            <input value={voice} onChange={event => onChange({ voice: event.target.value })} className="app-field mt-1.5 text-xs" placeholder="Voice ID or name" />
          )}
        </label>
      </div>
    </section>
  );
}

export function NarrationProfileSettings({ value, onChange }: NarrationProfileSettingsProps) {
  return (
    <div className="space-y-4">
      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><KeyRound className="h-5 w-5" /></span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-extrabold text-primary">Sarvam AI connection</h3>
              {value.hasSarvamKey && <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Configured</span>}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-secondary">The subscription key stays server-side. Enter a value only to add or replace it.</p>
          </div>
        </div>
        <div className="surface-soft mt-4 flex items-center gap-2 rounded-xl p-3 text-xs text-secondary"><Mic2 className="h-4 w-4" /><span>{value.hasSarvamKey ? 'Sarvam credential loaded securely from the server environment.' : 'Set SARVAM_API_KEY in .env.local to enable Sarvam.'}</span></div>
      </section>

      {(value.documentaryTtsProvider === 'sarvam' || value.kidsTtsProvider === 'sarvam') && !value.hasSarvamKey && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300" role="alert">
          Add a Sarvam subscription key before saving a profile that uses Sarvam AI.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ProfileEditor
          audience="documentary"
          provider={value.documentaryTtsProvider}
          model={value.documentaryTtsModel}
          voice={value.documentaryTtsVoice}
          onChange={updates => onChange({
            documentaryTtsProvider: updates.provider ?? value.documentaryTtsProvider,
            documentaryTtsModel: updates.model ?? value.documentaryTtsModel,
            documentaryTtsVoice: updates.voice ?? value.documentaryTtsVoice,
          })}
        />
        <ProfileEditor
          audience="kids"
          provider={value.kidsTtsProvider}
          model={value.kidsTtsModel}
          voice={value.kidsTtsVoice}
          onChange={updates => onChange({
            kidsTtsProvider: updates.provider ?? value.kidsTtsProvider,
            kidsTtsModel: updates.model ?? value.kidsTtsModel,
            kidsTtsVoice: updates.voice ?? value.kidsTtsVoice,
          })}
        />
      </div>
    </div>
  );
}
