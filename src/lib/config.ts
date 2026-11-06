import { AppConfig, ContentStyle, NarrationProfile, TtsProvider } from './types';
import { getServiceSupabase } from './supabase/server';
import type { Json } from './supabase/database.types';

let configCache: { value: AppConfig; expiresAt: number } | null = null;

async function getPersistedConfig(): Promise<Partial<AppConfig>> {
  const { data, error } = await getServiceSupabase().from('saas_settings').select('runtime_config').eq('id', 'global_config').maybeSingle();
  if (error) throw new Error(error.message);
  return data?.runtime_config && typeof data.runtime_config === 'object' ? data.runtime_config as Partial<AppConfig> : {};
}

export async function getConfig(): Promise<AppConfig> {
  if (configCache && configCache.expiresAt > Date.now()) return configCache.value;
  const runtimeConfig = await getPersistedConfig();
  const legacyTtsProvider = (runtimeConfig.ttsProvider || process.env.TTS_PROVIDER || 'neural') as TtsProvider;
  const legacyTtsModel = runtimeConfig.ttsModel || process.env.OPENROUTER_TTS_MODEL || 'fish-audio/s2.1-pro-free:free';
  const legacyTtsVoice = runtimeConfig.ttsVoice || process.env.TTS_VOICE || 'hi-IN-MadhurNeural';
  const cloudflareTtsModel = runtimeConfig.cloudflareTtsModel || process.env.CLOUDFLARE_TTS_MODEL || 'elevenlabs/eleven-v3';
  const cloudflareVoiceId = runtimeConfig.cloudflareVoiceId || process.env.CLOUDFLARE_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  const documentaryProvider = (runtimeConfig.documentaryTtsProvider || process.env.DOCUMENTARY_TTS_PROVIDER || legacyTtsProvider) as TtsProvider;
  const kidsProvider = (runtimeConfig.kidsTtsProvider || process.env.KIDS_TTS_PROVIDER || legacyTtsProvider) as TtsProvider;

  const config: AppConfig = {
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    agentRouterApiKey: process.env.AGENTROUTER_API_KEY || '',
    agentRouterBaseUrl: runtimeConfig.agentRouterBaseUrl || process.env.AGENTROUTER_BASE_URL || 'https://agentrouter.org/v1',
    puterAuthToken: process.env.PUTER_AUTH_TOKEN || '',
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    cloudflareImageModel: runtimeConfig.cloudflareImageModel || process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell',
    imageProvider: runtimeConfig.imageProvider || (process.env.IMAGE_PROVIDER as AppConfig['imageProvider']) || 'cloudflare',
    textModel: runtimeConfig.textModel || process.env.AGENTROUTER_TEXT_MODEL || 'gpt-5.6-sol',
    imageModel: runtimeConfig.imageModel || process.env.OPENROUTER_IMAGE_MODEL || 'bytedance-seed/seedream-5-0-flash',
    ttsModel: legacyTtsModel, ttsProvider: legacyTtsProvider, ttsVoice: legacyTtsVoice,
    cloudflareTtsModel, cloudflareVoiceId,
    cloudflareMusicModel: runtimeConfig.cloudflareMusicModel || process.env.CLOUDFLARE_MUSIC_MODEL || 'minimax/music-2.6',
    cloudflareVideoModel: runtimeConfig.cloudflareVideoModel || process.env.CLOUDFLARE_VIDEO_MODEL || 'minimax/h3-lite',
    sarvamApiKey: process.env.SARVAM_API_KEY || '',
    documentaryTtsProvider: documentaryProvider,
    documentaryTtsModel: runtimeConfig.documentaryTtsModel || process.env.DOCUMENTARY_TTS_MODEL || (documentaryProvider === 'sarvam' ? 'bulbul:v4-flash' : legacyTtsModel),
    documentaryTtsVoice: runtimeConfig.documentaryTtsVoice || process.env.DOCUMENTARY_TTS_VOICE || (documentaryProvider === 'sarvam' ? 'anand_hi_documentary' : legacyTtsVoice),
    kidsTtsProvider: kidsProvider,
    kidsTtsModel: runtimeConfig.kidsTtsModel || process.env.KIDS_TTS_MODEL || (kidsProvider === 'sarvam' ? 'bulbul:v4-flash' : legacyTtsModel),
    kidsTtsVoice: runtimeConfig.kidsTtsVoice || process.env.KIDS_TTS_VOICE || (kidsProvider === 'sarvam' ? 'chhavi_hi_kids' : 'hi-IN-SwaraNeural'),
    masterOutputVideoUrl: runtimeConfig.masterOutputVideoUrl || process.env.MASTER_OUTPUT_VIDEO_URL || '',
    masterOutputPosterUrl: runtimeConfig.masterOutputPosterUrl || process.env.MASTER_OUTPUT_POSTER_URL || '',
    dataDir: 'data',
    testMode: runtimeConfig.testMode ?? (process.env.TEST_MODE === 'true'),
  };
  configCache = { value: config, expiresAt: Date.now() + 30_000 };
  return config;
}

export async function saveConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  const persisted = await getPersistedConfig();
  const safeUpdates = { ...updates };
  delete safeUpdates.openRouterApiKey;
  delete safeUpdates.agentRouterApiKey;
  delete safeUpdates.puterAuthToken;
  delete safeUpdates.cloudflareAccountId;
  delete safeUpdates.cloudflareApiToken;
  delete safeUpdates.sarvamApiKey;
  const { error } = await getServiceSupabase().from('saas_settings').update({ runtime_config: { ...persisted, ...safeUpdates } as unknown as Json, updated_at: new Date().toISOString() }).eq('id', 'global_config');
  if (error) throw new Error(error.message);
  configCache = null;
  return getConfig();
}

export function getNarrationProfile(config: AppConfig, contentStyle: ContentStyle): NarrationProfile {
  return contentStyle === 'kids'
    ? { provider: config.kidsTtsProvider || 'neural', model: config.kidsTtsModel || config.ttsModel, voice: config.kidsTtsVoice || 'hi-IN-SwaraNeural' }
    : { provider: config.documentaryTtsProvider || 'neural', model: config.documentaryTtsModel || config.ttsModel, voice: config.documentaryTtsVoice || 'hi-IN-MadhurNeural' };
}
