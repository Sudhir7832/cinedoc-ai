import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig, maskApiKey } from '@/lib/config';
import { OpenRouterClient } from '@/lib/openrouter/client';
import { CloudflareClient } from '@/lib/cloudflare/client';
import { SessionManager } from '@/lib/auth/session';
import { AppConfig } from '@/lib/types';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected configuration error';
}

export async function GET() {
  try {
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
        maskedApiKey: maskApiKey(config.openRouterApiKey),
        maskedAgentRouterKey: maskApiKey(config.agentRouterApiKey || ''),
        maskedPuterToken: maskApiKey(config.puterAuthToken || ''),
        maskedCloudflareToken: maskApiKey(config.cloudflareApiToken || ''),
        maskedSarvamKey: maskApiKey(config.sarvamApiKey || ''),
        cloudflareAccountId: config.cloudflareAccountId || '',
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
        testMode: config.testMode ?? false,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    const body = await req.json() as Record<string, unknown>;
    const readString = (key: string, fallback = '') => typeof body[key] === 'string' ? body[key] as string : fallback;
    const action = readString('action');
    const apiKey = readString('apiKey');
    const agentRouterApiKey = readString('agentRouterApiKey');
    const agentRouterBaseUrl = readString('agentRouterBaseUrl');
    const puterAuthToken = readString('puterAuthToken');
    const cloudflareAccountId = readString('cloudflareAccountId');
    const cloudflareApiToken = readString('cloudflareApiToken');
    const cloudflareImageModel = readString('cloudflareImageModel');
    const imageProvider = readString('imageProvider');
    const textModel = readString('textModel');
    const imageModel = readString('imageModel');
    const ttsModel = readString('ttsModel');
    const ttsProvider = readString('ttsProvider');
    const ttsVoice = readString('ttsVoice');
    const cloudflareTtsModel = readString('cloudflareTtsModel');
    const cloudflareVoiceId = readString('cloudflareVoiceId');
    const sarvamApiKey = readString('sarvamApiKey');
    const documentaryTtsProvider = readString('documentaryTtsProvider');
    const documentaryTtsModel = readString('documentaryTtsModel');
    const documentaryTtsVoice = readString('documentaryTtsVoice');
    const kidsTtsProvider = readString('kidsTtsProvider');
    const kidsTtsModel = readString('kidsTtsModel');
    const kidsTtsVoice = readString('kidsTtsVoice');
    const testMode = body.testMode;
    const provider = readString('provider', 'agentrouter');

    if (action === 'test_connection') {
      const config = await getConfig();
      if (provider === 'cloudflare') {
        const actId = cloudflareAccountId || config.cloudflareAccountId;
        const token = cloudflareApiToken || config.cloudflareApiToken;
        const result = await CloudflareClient.testConnection(actId, token);
        return NextResponse.json(result);
      }

      if (provider === 'puter') {
        const token = puterAuthToken || config.puterAuthToken;
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
        } catch (e: unknown) {
          return NextResponse.json({ success: false, message: `Puter.js authentication error: ${errorMessage(e)}` });
        }
      }

      const testKey = provider === 'agentrouter' 
        ? (agentRouterApiKey || config.agentRouterApiKey)
        : (apiKey || config.openRouterApiKey);
      const result = await OpenRouterClient.testConnection(testKey, provider);
      return NextResponse.json(result);
    }

    const updates: Partial<AppConfig> = {};
    if (apiKey !== undefined && apiKey !== '') updates.openRouterApiKey = apiKey.trim();
    if (agentRouterApiKey !== undefined && agentRouterApiKey !== '') updates.agentRouterApiKey = agentRouterApiKey.trim();
    if (agentRouterBaseUrl !== undefined && agentRouterBaseUrl !== '') updates.agentRouterBaseUrl = agentRouterBaseUrl.trim();
    if (puterAuthToken !== undefined && puterAuthToken !== '') updates.puterAuthToken = puterAuthToken.trim();
    if (cloudflareAccountId !== '') updates.cloudflareAccountId = cloudflareAccountId.trim();
    if (cloudflareApiToken !== undefined && cloudflareApiToken !== '') updates.cloudflareApiToken = cloudflareApiToken.trim();
    if (cloudflareImageModel !== undefined && cloudflareImageModel !== '') updates.cloudflareImageModel = cloudflareImageModel.trim();
    if (['cloudflare', 'openrouter', 'puter'].includes(imageProvider)) updates.imageProvider = imageProvider as AppConfig['imageProvider'];
    if (textModel !== undefined && textModel !== '') updates.textModel = textModel.trim();
    if (imageModel !== undefined && imageModel !== '') updates.imageModel = imageModel.trim();
    if (ttsModel !== undefined && ttsModel !== '') updates.ttsModel = ttsModel.trim();
    if (['neural', 'openrouter', 'cloudflare', 'sarvam'].includes(ttsProvider)) updates.ttsProvider = ttsProvider as AppConfig['ttsProvider'];
    if (ttsVoice !== undefined && ttsVoice !== '') updates.ttsVoice = ttsVoice.trim();
    if (cloudflareTtsModel !== undefined && cloudflareTtsModel !== '') updates.cloudflareTtsModel = cloudflareTtsModel.trim();
    if (cloudflareVoiceId !== undefined && cloudflareVoiceId !== '') updates.cloudflareVoiceId = cloudflareVoiceId.trim();
    if (sarvamApiKey !== undefined && sarvamApiKey !== '') updates.sarvamApiKey = sarvamApiKey.trim();
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
        maskedApiKey: maskApiKey(saved.openRouterApiKey),
        maskedAgentRouterKey: maskApiKey(saved.agentRouterApiKey || ''),
        maskedCloudflareToken: maskApiKey(saved.cloudflareApiToken || ''),
        cloudflareAccountId: saved.cloudflareAccountId,
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
    const message = errorMessage(err);
    const status = message.includes('Authentication required')
      ? 401
      : message.includes('Forbidden')
        ? 403
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
