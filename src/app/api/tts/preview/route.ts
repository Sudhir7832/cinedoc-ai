import { NextRequest, NextResponse } from 'next/server';
import { getConfig, getNarrationProfile } from '@/lib/config';
import { AudioGenerator } from '@/lib/openrouter/audio-generator';
import { OpenRouterClient } from '@/lib/openrouter/client';
import { CloudflareClient } from '@/lib/cloudflare/client';
import { SessionManager } from '@/lib/auth/session';

const MAX_PREVIEW_CHARS = 5000;

export async function POST(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    const body = await req.json();
    const {
      text = 'In the depths of space, ancient stars whisper the forgotten secrets of the cosmos.',
      provider = 'cloudflare',
      model,
      voice,
      voiceId,
      language = 'English',
      contentStyle = 'documentary',
    } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Text prompt is required.' }, { status: 400 });
    }
    if (text.length > MAX_PREVIEW_CHARS) {
      return NextResponse.json(
        { success: false, error: `Text must be ${MAX_PREVIEW_CHARS} characters or fewer.` },
        { status: 400 }
      );
    }

    const cfg = await getConfig();
    const profile = getNarrationProfile(cfg, contentStyle === 'kids' ? 'kids' : 'documentary');
    let audioBuffer: Buffer;
    const actualProvider = provider;
    let actualModel = model;

    if (provider === 'cloudflare') {
      const chosenModel = model || cfg.cloudflareTtsModel || 'elevenlabs/eleven-v3';
      const chosenVoiceId = voiceId || cfg.cloudflareVoiceId || 'JBFqnCBsd6RMkjVDRZzb';
      actualModel = chosenModel;
      audioBuffer = await CloudflareClient.generateSpeech(text.trim(), {
        model: chosenModel,
        voiceId: chosenVoiceId,
      });
    } else if (provider === 'openrouter') {
      const chosenModel = model || cfg.ttsModel || 'fish-audio/s2.1-pro-free:free';
      actualModel = chosenModel;
      audioBuffer = await OpenRouterClient.generateSpeech(text.trim(), voice, chosenModel);
    } else if (provider === 'sarvam') {
      const { SarvamClient } = await import('@/lib/sarvam/client');
      const chosenModel = model || profile.model || 'bulbul:v4-flash';
      const chosenSpeaker = voice || voiceId || profile.voice || (contentStyle === 'kids' ? 'chhavi_hi_kids' : 'anand_hi_documentary');
      actualModel = chosenModel;
      audioBuffer = await SarvamClient.generateSpeech(text.trim(), {
        apiKey: cfg.sarvamApiKey || '',
        model: chosenModel,
        speaker: chosenSpeaker,
        language,
        contentStyle: contentStyle === 'kids' ? 'kids' : 'documentary',
      });
    } else {
      // neural (Microsoft Edge)
      const chosenVoice = voice || cfg.ttsVoice || 'en-US-ChristopherNeural';
      actualModel = chosenVoice;
      audioBuffer = await AudioGenerator.generateNeuralSpeech(text.trim(), chosenVoice, language);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('TTS service returned empty audio data.');
    }

    const base64Audio = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;
    const sizeBytes = audioBuffer.length;

    return NextResponse.json({
      success: true,
      audioUrl: base64Audio,
      sizeBytes,
      provider: actualProvider,
      model: actualModel,
    });
  } catch (err: unknown) {
    console.error('[TTS Preview API Error]:', err);
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Authentication required') ? 401 : message.includes('Forbidden') ? 403 : 500 }
    );
  }
}
