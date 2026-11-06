import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';
import { OpenRouterClient } from '@/lib/openrouter/client';
import { CloudflareClient } from '@/lib/cloudflare/client';
import { SessionManager } from '@/lib/auth/session';
import { AppConfig } from '@/lib/types';
import { requireSameOrigin } from '@/lib/security/origin';
import { assertAllowedOutboundUrl } from '@/lib/security/outbound-url';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { configMutationSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'public-config', limit: 60, windowSeconds: 60, failClosed: false });
    if (limited) return limited;
    const config = await getConfig();
    const isKeyConfigured = Boolean(config.agentRouterApiKey || config.openRouterApiKey || config.cloudflareApiToken);

    return NextResponse.json({
      success: true,
      config: {
        isKeyConfigured,
        isAgentRouterConfigured: Boolean(config.agentRouterApiKey),
        isOpenRouterConfigured: Boolean(config.openRouterApiKey),
        isPuterConfigured: Boolean(config.puterAuthToken),
        isCloudflareConfigured: Boolean(config.cloudflareAccountId && config.cloudflareApiToken),
        isSarvamConfigured: Boolean(config.sarvamApiKey),
        cloudflareImageModel: config.cloudflareImageModel || '@cf/black-forest-labs/flux-1-schnell',
        agentRouterBaseUrl: config.agentRouterBaseUrl || 'https://co.agentrouter.org/v1',
        imageProvider: config.imageProvider || 'cloudflare',
        textModel: config.textModel,
        imageModel: config.imageModel,
        ttsModel: config.ttsModel,
        ttsProvider: config.ttsProvider || 'neural',
        ttsVoice: config.ttsVoice || 'hi-IN-MadhurNeural',
        cloudflareTtsModel: config.cloudflareTtsModel || 'elevenlabs/eleven-v3',
        cloudflareVoiceId: config.cloudflareVoiceId || 'JBFqnCBsd6RMkjVDRZzb',
        documentaryTtsProvider: config.documentaryTtsProvider,
        documentaryTtsModel: config.documentaryTtsModel,
        documentaryTtsVoice: config.documentaryTtsVoice,
        kidsTtsProvider: config.kidsTtsProvider,
        kidsTtsModel: config.kidsTtsModel,
        kidsTtsVoice: config.kidsTtsVoice,
        masterOutputVideoUrl: config.masterOutputVideoUrl || '',
        masterOutputPosterUrl: config.masterOutputPosterUrl || '',
        testMode: config.testMode ?? false,
      },
    });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Configuration is unavailable.');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'admin-config', limit: 20, windowSeconds: 300, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    const body = await parseJsonBody(req, configMutationSchema, 16 * 1024);
    const action = body.action || '';
    const agentRouterBaseUrl = body.agentRouterBaseUrl || '';
    const cloudflareImageModel = body.cloudflareImageModel || '';
    const imageProvider = body.imageProvider || '';
    const textModel = body.textModel || '';
    const imageModel = body.imageModel || '';
    const ttsModel = body.ttsModel || '';
    const ttsProvider = body.ttsProvider || '';
    const ttsVoice = body.ttsVoice || '';
    const cloudflareTtsModel = body.cloudflareTtsModel || '';
    const cloudflareVoiceId = body.cloudflareVoiceId || '';
    const documentaryTtsProvider = body.documentaryTtsProvider || '';
    const documentaryTtsModel = body.documentaryTtsModel || '';
    const documentaryTtsVoice = body.documentaryTtsVoice || '';
    const kidsTtsProvider = body.kidsTtsProvider || '';
    const kidsTtsModel = body.kidsTtsModel || '';
    const kidsTtsVoice = body.kidsTtsVoice || '';
    const testMode = body.testMode;
    const provider = body.provider || 'agentrouter';

    if (action === 'test_connection') {
      const config = await getConfig();
      if (provider === 'cloudflare') {
        const actId = config.cloudflareAccountId;
        const token = config.cloudflareApiToken;
        const result = await CloudflareClient.testConnection(actId, token);
        return NextResponse.json(result);
      }

      if (provider === 'puter') {
        const token = config.puterAuthToken;
        if (!token) {
          return NextResponse.json({ success: false, message: 'Puter Auth Token is not configured.' });
        }
        try {
          const { init } = await import('@heyputer/puter.js/src/init.cjs');
          const puter = init(token);
          const user = await puter.getUser() as { username?: string };
          return NextResponse.json({
            success: true,
            message: `Connected to Puter.js as "${user.username || 'User'}"! Ready for free AI image generation.`,
          });
        } catch {
          return NextResponse.json({ success: false, message: 'Puter.js authentication failed.' });
        }
      }

      const testKey = provider === 'agentrouter' 
        ? config.agentRouterApiKey
        : config.openRouterApiKey;
      const result = await OpenRouterClient.testConnection(testKey, provider);
      return NextResponse.json(result);
    }

    const updates: Partial<AppConfig> = {};
    if (agentRouterBaseUrl) updates.agentRouterBaseUrl = assertAllowedOutboundUrl(agentRouterBaseUrl, ['agentrouter.org']).toString().replace(/\/$/, '');
    if (cloudflareImageModel !== undefined && cloudflareImageModel !== '') updates.cloudflareImageModel = cloudflareImageModel.trim();
    if (['cloudflare', 'openrouter', 'puter'].includes(imageProvider)) updates.imageProvider = imageProvider as AppConfig['imageProvider'];
    if (textModel !== undefined && textModel !== '') updates.textModel = textModel.trim();
    if (imageModel !== undefined && imageModel !== '') updates.imageModel = imageModel.trim();
    if (ttsModel !== undefined && ttsModel !== '') updates.ttsModel = ttsModel.trim();
    if (['neural', 'openrouter', 'cloudflare', 'sarvam'].includes(ttsProvider)) updates.ttsProvider = ttsProvider as AppConfig['ttsProvider'];
    if (ttsVoice !== undefined && ttsVoice !== '') updates.ttsVoice = ttsVoice.trim();
    if (cloudflareTtsModel !== undefined && cloudflareTtsModel !== '') updates.cloudflareTtsModel = cloudflareTtsModel.trim();
    if (cloudflareVoiceId !== undefined && cloudflareVoiceId !== '') updates.cloudflareVoiceId = cloudflareVoiceId.trim();
    if (['neural', 'openrouter', 'cloudflare', 'sarvam'].includes(documentaryTtsProvider)) updates.documentaryTtsProvider = documentaryTtsProvider as AppConfig['documentaryTtsProvider'];
    if (documentaryTtsModel !== undefined && documentaryTtsModel !== '') updates.documentaryTtsModel = documentaryTtsModel.trim();
    if (documentaryTtsVoice !== undefined && documentaryTtsVoice !== '') updates.documentaryTtsVoice = documentaryTtsVoice.trim();
    if (['neural', 'openrouter', 'cloudflare', 'sarvam'].includes(kidsTtsProvider)) updates.kidsTtsProvider = kidsTtsProvider as AppConfig['kidsTtsProvider'];
    if (kidsTtsModel !== undefined && kidsTtsModel !== '') updates.kidsTtsModel = kidsTtsModel.trim();
    if (kidsTtsVoice !== undefined && kidsTtsVoice !== '') updates.kidsTtsVoice = kidsTtsVoice.trim();
    if (testMode !== undefined) updates.testMode = Boolean(testMode);

    const currentConfig = await getConfig();
    const sarvamSelected = updates.documentaryTtsProvider === 'sarvam' || updates.kidsTtsProvider === 'sarvam';
    if (sarvamSelected && !updates.sarvamApiKey && !currentConfig.sarvamApiKey) {
      throw new Error('A Sarvam API subscription key is required before selecting Sarvam narration.');
    }

    const saved = await saveConfig(updates);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully.',
      config: {
        isKeyConfigured: Boolean(saved.agentRouterApiKey || saved.openRouterApiKey || saved.cloudflareApiToken),
        isAgentRouterConfigured: Boolean(saved.agentRouterApiKey),
        isOpenRouterConfigured: Boolean(saved.openRouterApiKey),
        isCloudflareConfigured: Boolean(saved.cloudflareAccountId && saved.cloudflareApiToken),
        cloudflareImageModel: saved.cloudflareImageModel,
        agentRouterBaseUrl: saved.agentRouterBaseUrl,
        imageProvider: saved.imageProvider,
        textModel: saved.textModel,
        imageModel: saved.imageModel,
        ttsModel: saved.ttsModel,
        ttsProvider: saved.ttsProvider || 'neural',
        ttsVoice: saved.ttsVoice || 'hi-IN-MadhurNeural',
        cloudflareTtsModel: saved.cloudflareTtsModel || 'elevenlabs/eleven-v3',
        cloudflareVoiceId: saved.cloudflareVoiceId || 'JBFqnCBsd6RMkjVDRZzb',
        documentaryTtsProvider: saved.documentaryTtsProvider,
        documentaryTtsModel: saved.documentaryTtsModel,
        documentaryTtsVoice: saved.documentaryTtsVoice,
        kidsTtsProvider: saved.kidsTtsProvider,
        kidsTtsModel: saved.kidsTtsModel,
        kidsTtsVoice: saved.kidsTtsVoice,
        testMode: saved.testMode,
      },
    });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Configuration update failed.');
  }
}
