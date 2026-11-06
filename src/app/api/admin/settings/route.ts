import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import { getConfig, saveConfig } from '@/lib/config';
import { AppConfig, PricingPack, SaasSettings } from '@/lib/types';
import { minutesForCredits } from '@/lib/credits';
import { requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { adminSettingsSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

function publicRuntimeConfig(config: AppConfig) {
  return {
    imageProvider: config.imageProvider || 'cloudflare',
    cloudflareImageModel: config.cloudflareImageModel,
    imageModel: config.imageModel,
    textModel: config.textModel,
    ttsProvider: config.ttsProvider || 'neural',
    ttsModel: config.ttsModel,
    ttsVoice: config.ttsVoice,
    cloudflareTtsModel: config.cloudflareTtsModel,
    cloudflareVoiceId: config.cloudflareVoiceId,
    documentaryTtsProvider: config.documentaryTtsProvider,
    documentaryTtsModel: config.documentaryTtsModel,
    documentaryTtsVoice: config.documentaryTtsVoice,
    kidsTtsProvider: config.kidsTtsProvider,
    kidsTtsModel: config.kidsTtsModel,
    kidsTtsVoice: config.kidsTtsVoice,
    testMode: config.testMode,
    masterOutputVideoUrl: config.masterOutputVideoUrl || '',
    masterOutputPosterUrl: config.masterOutputPosterUrl || '',
    agentRouterBaseUrl: config.agentRouterBaseUrl,
    hasAgentRouterKey: Boolean(config.agentRouterApiKey),
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    hasCloudflareToken: Boolean(config.cloudflareApiToken),
    hasPuterToken: Boolean(config.puterAuthToken),
    hasSarvamKey: Boolean(config.sarvamApiKey),
  };
}

function safeSettings(settings: SaasSettings) {
  return {
    ...settings,
    stripePublishableKey: '', stripeSecretKey: '', razorpayKeyId: '', razorpayKeySecret: '', dodoApiKey: '', dodoWebhookKey: '',
  };
}

function paymentConfiguration(settings: SaasSettings) {
  return {
    stripeConfigured: Boolean(settings.stripePublishableKey && settings.stripeSecretKey),
    razorpayConfigured: Boolean(settings.razorpayKeyId && settings.razorpayKeySecret),
    dodoConfigured: Boolean(settings.dodoApiKey && settings.dodoWebhookKey),
  };
}

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'admin-settings-read', limit: 60, windowSeconds: 60, failClosed: false });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    const settings = await DbManager.getSettings();
    return NextResponse.json({
      success: true,
      settings: safeSettings(settings),
      paymentConfiguration: paymentConfiguration(settings),
      runtimeConfig: publicRuntimeConfig(await getConfig()),
    });
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Unable to load settings.');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'admin-settings-write', limit: 20, windowSeconds: 300, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    const body = await parseJsonBody(req, adminSettingsSchema, 128 * 1024);
    const configUpdates: Partial<AppConfig> = {};

    const stringConfigKeys = [
      'cloudflareImageModel', 'imageModel', 'textModel', 'ttsModel', 'ttsVoice',
      'cloudflareTtsModel', 'cloudflareVoiceId',
      'documentaryTtsModel', 'documentaryTtsVoice', 'kidsTtsModel', 'kidsTtsVoice',
    ] as const;
    for (const key of stringConfigKeys) {
      if (typeof body[key] === 'string' && body[key]) configUpdates[key] = body[key];
    }
    if (typeof body.masterOutputVideoUrl === 'string') {
      configUpdates.masterOutputVideoUrl = body.masterOutputVideoUrl.trim();
    }
    if (typeof body.masterOutputPosterUrl === 'string') {
      configUpdates.masterOutputPosterUrl = body.masterOutputPosterUrl.trim();
    }
    if (['cloudflare', 'openrouter', 'puter'].includes(String(body.imageProvider))) {
      configUpdates.imageProvider = body.imageProvider as AppConfig['imageProvider'];
    }
    if (['neural', 'openrouter', 'cloudflare', 'sarvam'].includes(String(body.ttsProvider))) {
      configUpdates.ttsProvider = body.ttsProvider as AppConfig['ttsProvider'];
    }
    if (['neural', 'openrouter', 'cloudflare', 'sarvam'].includes(String(body.documentaryTtsProvider))) {
      configUpdates.documentaryTtsProvider = body.documentaryTtsProvider as AppConfig['documentaryTtsProvider'];
    }
    if (['neural', 'openrouter', 'cloudflare', 'sarvam'].includes(String(body.kidsTtsProvider))) {
      configUpdates.kidsTtsProvider = body.kidsTtsProvider as AppConfig['kidsTtsProvider'];
    }
    const currentRuntime = await getConfig();
    const sarvamSelected = configUpdates.documentaryTtsProvider === 'sarvam' || configUpdates.kidsTtsProvider === 'sarvam';
    if (sarvamSelected && !configUpdates.sarvamApiKey && !currentRuntime.sarvamApiKey) {
      throw new Error('A Sarvam API subscription key is required before selecting Sarvam narration.');
    }
    if (Object.keys(configUpdates).length > 0) await saveConfig(configUpdates);

    const current = await DbManager.getSettings();
    const settingsUpdates: Partial<SaasSettings> = {};
    if (typeof body.welcomeCredits === 'number') settingsUpdates.welcomeCredits = Math.max(0, Math.floor(body.welcomeCredits));
    if (typeof body.creditsPerScene === 'number') settingsUpdates.creditsPerScene = Math.max(1, Math.floor(body.creditsPerScene));
    if (typeof body.enableTestMode === 'boolean') settingsUpdates.enableTestMode = body.enableTestMode;
    if (typeof body.enableStripe === 'boolean') settingsUpdates.enableStripe = body.enableStripe;
    if (typeof body.enableRazorpay === 'boolean') settingsUpdates.enableRazorpay = body.enableRazorpay;
    if (typeof body.enableDodo === 'boolean') settingsUpdates.enableDodo = body.enableDodo;

    if (body.dodoMode === 'test' || body.dodoMode === 'live') settingsUpdates.dodoMode = body.dodoMode;

    if (Array.isArray(body.pricingPacks)) {
      const creditsPerScene = settingsUpdates.creditsPerScene || current.creditsPerScene;
      settingsUpdates.pricingPacks = body.pricingPacks.map((value, index): PricingPack => {
        const pack = value as Record<string, unknown>;
        const id = String(pack.id || `pack_${index + 1}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
        const name = String(pack.name || '').trim().slice(0, 80);
        const credits = Math.max(10, Math.floor(Number(pack.credits) || 0));
        const priceUsd = Math.max(1, Number(pack.priceUsd) || 0);
        const priceInr = Math.max(1, Number(pack.priceInr) || 0);
        if (!id || !name) throw new Error('Every pricing plan requires an ID and name.');
        return {
          id,
          name,
          credits,
          priceUsd,
          priceInr,
          videoMinutes: minutesForCredits(credits, creditsPerScene),
          description: String(pack.description || '').trim().slice(0, 240),
          popular: Boolean(pack.popular),
          dodoProductId: String(pack.dodoProductId || '').trim().slice(0, 100) || undefined,
        };
      });
    }

    const updated = await DbManager.updateSettings(settingsUpdates);
    return NextResponse.json({
      success: true,
      settings: safeSettings(updated),
      paymentConfiguration: paymentConfiguration(updated),
      runtimeConfig: publicRuntimeConfig(await getConfig()),
    });
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Unable to update settings.');
  }
}
