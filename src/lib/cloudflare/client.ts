import { getConfig } from '../config';

export class CloudflareClient {
  public static async testConnection(accountId?: string, apiToken?: string): Promise<{ success: boolean; message: string }> {
    const config = await getConfig();
    const actId = accountId || config.cloudflareAccountId;
    const token = apiToken || config.cloudflareApiToken;

    if (!actId || !token) {
      return {
        success: false,
        message: 'Cloudflare Account ID and API Token are required.',
      };
    }

    try {
      // Test by checking Workers AI model availability or running a 1-step test
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${actId}/ai/models/search?task=Text-to-Image`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          message: `Cloudflare API returned status ${res.status}: ${errText.slice(0, 150)}`,
        };
      }

      const json = await res.json();
      const modelsCount = json.result?.length || 0;
      return {
        success: true,
        message: `Connected to Cloudflare Workers AI successfully! (${modelsCount} Text-to-Image models available)`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to connect to Cloudflare Workers AI API',
      };
    }
  }

  public static async generateImage(
    prompt: string,
    modelOverride?: string
  ): Promise<{ buffer: Buffer; cost?: number }> {
    const config = await getConfig();
    const accountId = config.cloudflareAccountId;
    const apiToken = config.cloudflareApiToken;
    let model = modelOverride || config.cloudflareImageModel || '@cf/black-forest-labs/flux-1-schnell';
    if (!model.startsWith('@cf/')) {
      if (model.includes('flux')) {
        model = '@cf/black-forest-labs/flux-1-schnell';
      } else {
        model = `@cf/${model}`;
      }
    }

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare Workers AI Account ID or API Token is not configured.');
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const bodyPayload: Record<string, unknown> = { prompt };
    if (model.includes('stable-diffusion') && !model.includes('flux')) {
      bodyPayload.num_steps = 20;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(90000), // 90 seconds timeout
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const json = JSON.parse(errText);
        parsedMsg = json.errors?.[0]?.message || errText;
      } catch {}
      throw new Error(`Cloudflare Workers AI (${model}) error ${res.status}: ${parsedMsg}`);
    }

    const contentType = res.headers.get('content-type') || '';

    // Handle JSON response with base64 image (standard for FLUX.1 [schnell])
    if (contentType.includes('application/json')) {
      const json = await res.json();
      const base64Data = json.result?.image || json.image;
      if (!base64Data) {
        throw new Error(`Cloudflare Workers AI returned no image data: ${JSON.stringify(json).slice(0, 150)}`);
      }
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      return {
        buffer: Buffer.from(cleanBase64, 'base64'),
        cost: 0, // Free 10,000 neurons/day tier
      };
    }

    // Handle direct binary response (e.g. image/jpeg, image/png)
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      cost: 0,
    };
  }

  public static async generateSpeech(
    text: string,
    options?: {
      model?: string;
      voiceId?: string;
    }
  ): Promise<Buffer> {
    const config = await getConfig();
    const accountId = config.cloudflareAccountId;
    const apiToken = config.cloudflareApiToken;

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare Account ID or API Token is not configured. Please check .env.local or Settings.');
    }

    const model = options?.model || config.cloudflareTtsModel || 'elevenlabs/eleven-v3';
    const voiceId = options?.voiceId || config.cloudflareVoiceId || 'JBFqnCBsd6RMkjVDRZzb';

    let endpoint: string;
    let requestBody: Record<string, unknown>;

    if (model.includes('elevenlabs') || model === 'eleven-v3') {
      // Cloudflare ElevenLabs AI Gateway integration
      endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;
      requestBody = {
        model: 'elevenlabs/eleven-v3',
        input: {
          text,
          voice_id: voiceId,
          output_format: 'mp3_44100_128',
        },
      };
    } else {
      // Direct Cloudflare Workers AI TTS models (@cf/deepgram/aura-2-en, @cf/myshell-ai/melotts, etc.)
      const formattedModel = model.startsWith('@cf/') ? model : `@cf/${model}`;
      endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${formattedModel}`;
      requestBody = {
        text,
        prompt: text,
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000), // 60s
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const json = JSON.parse(errText);
        parsedMsg = json.errors?.[0]?.message || errText;
      } catch {}
      throw new Error(`Cloudflare TTS (${model}) error ${res.status}: ${parsedMsg}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      const base64Audio = json.result?.audio || json.audio;
      if (base64Audio) {
        const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, '');
        const rawBuf = Buffer.from(cleanBase64, 'base64');

        // If it's a WAV file (e.g. MeloTTS), convert to MP3 for seamless browser & video player compatibility
        if (rawBuf.length > 4 && rawBuf.slice(0, 4).toString() === 'RIFF') {
          const { spawn } = await import('child_process');
          return new Promise<Buffer>((resolve) => {
            const ff = spawn('ffmpeg', [
              '-y',
              '-i', 'pipe:0',
              '-c:a', 'libmp3lame',
              '-q:a', '2',
              '-f', 'mp3',
              'pipe:1',
            ]);
            const chunks: Buffer[] = [];
            ff.stdout.on('data', (c) => chunks.push(c));
            ff.on('close', (code) => {
              if (code === 0 && chunks.length > 0) {
                resolve(Buffer.concat(chunks));
              } else {
                resolve(rawBuf);
              }
            });
            ff.on('error', () => resolve(rawBuf));
            ff.stdin.write(rawBuf);
            ff.stdin.end();
          });
        }

        return rawBuf;
      }
      throw new Error(`Cloudflare TTS returned unexpected JSON without audio: ${JSON.stringify(json).slice(0, 150)}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
