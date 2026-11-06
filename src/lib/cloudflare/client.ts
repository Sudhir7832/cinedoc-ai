import { getConfig } from '../config';
import { fetchAllowedOutboundUrl } from '../security/outbound-url';

type MiniMaxMusicResponse = {
  state?: string;
  result?: { audio?: string };
  error?: { message?: string } | string;
};

type MiniMaxVideoResponse = {
  task?: {
    id?: string;
    status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    content?: { url?: string };
    error?: { code?: string; message?: string };
    duration?: number;
    ratio?: string;
    resolution?: string;
  };
};

export type GeneratedVideo = {
  buffer: Buffer;
  taskId: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
};

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
      if (res.status === 429) {
        throw new Error(`Cloudflare TTS daily quota is exhausted. Use another provider or upgrade Workers AI. ${parsedMsg}`);
      }
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

  public static async generateMusic(prompt: string, modelOverride?: string): Promise<Buffer> {
    const config = await getConfig();
    if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
      throw new Error('Cloudflare credentials are not configured for music generation.');
    }
    const model = modelOverride || config.cloudflareMusicModel || 'minimax/music-2.6';
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.cloudflareApiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: {
          prompt,
          is_instrumental: true,
          lyrics_optimizer: false,
          format: 'mp3',
          sample_rate: 44100,
        },
      }),
      signal: AbortSignal.timeout(300000),
    });
    if (!response.ok) {
      throw new Error(await this.formatRunError(response, `Cloudflare music generation (${model})`));
    }

    const data = await response.json() as MiniMaxMusicResponse;
    if (data.state && data.state.toLowerCase() !== 'completed') {
      const detail = typeof data.error === 'string' ? data.error : data.error?.message;
      throw new Error(`Cloudflare music generation ended in state "${data.state}"${detail ? `: ${detail}` : '.'}`);
    }
    const audio = data.result?.audio;
    if (!audio) throw new Error(`Cloudflare music generation returned no audio URL: ${JSON.stringify(data).slice(0, 300)}`);
    return this.downloadAsset(audio, 'generated music', 120000);
  }

  public static async generateVideo(
    prompt: string,
    options?: {
      model?: string;
      duration?: number;
      ratio?: '16:9' | '9:16';
      resolution?: '480P' | '768P';
    }
  ): Promise<GeneratedVideo> {
    const config = await getConfig();
    if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
      throw new Error('Cloudflare credentials are not configured for video generation.');
    }

    const model = options?.model || config.cloudflareVideoModel || 'minimax/h3-lite';
    const duration = Math.max(4, Math.min(15, Math.round(options?.duration || 6)));
    const ratio = options?.ratio || '16:9';
    const resolution = options?.resolution || '480P';
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.cloudflareApiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: {
          content: [{ type: 'text', text: prompt }],
          duration,
          ratio,
          resolution,
        },
      }),
      signal: AbortSignal.timeout(600000),
    });
    if (!response.ok) {
      throw new Error(await this.formatRunError(response, `Cloudflare video generation (${model})`));
    }

    const data = await response.json() as MiniMaxVideoResponse;
    const task = data.task;
    if (!task) throw new Error(`Cloudflare video generation returned no task: ${JSON.stringify(data).slice(0, 300)}`);
    if (task.status !== 'succeeded') {
      const detail = task.error?.message;
      throw new Error(`Cloudflare video task ${task.id || 'unknown'} ended in state "${task.status || 'unknown'}"${detail ? `: ${detail}` : '.'}`);
    }
    const videoUrl = task.content?.url;
    if (!videoUrl) throw new Error(`Cloudflare video task ${task.id || 'unknown'} returned no video URL.`);

    return {
      buffer: await this.downloadAsset(videoUrl, 'generated video', 180000),
      taskId: task.id || '',
      duration: task.duration,
      ratio: task.ratio,
      resolution: task.resolution,
    };
  }

  private static async downloadAsset(url: string, label: string, timeoutMs: number): Promise<Buffer> {
    if (url.startsWith('data:')) {
      const separator = url.indexOf(',');
      if (separator < 0 || !url.slice(0, separator).includes(';base64')) {
        throw new Error(`Cloudflare ${label} data URL is invalid.`);
      }
      return Buffer.from(url.slice(separator + 1), 'base64');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Cloudflare ${label} URL is invalid.`);
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Cloudflare ${label} URL uses an unsupported protocol.`);
    }

    const response = await fetchAllowedOutboundUrl(parsedUrl.toString(), ['cloudflare.com', 'aliyuncs.com', 'minimax.io'], {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Cloudflare ${label} download failed (${response.status}).`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error(`Cloudflare ${label} download was empty.`);
    return buffer;
  }

  private static async formatRunError(response: Response, label: string): Promise<string> {
    const raw = await response.text();
    let detail = raw.slice(0, 300);
    try {
      const data = JSON.parse(raw) as { errors?: Array<{ message?: string }> };
      detail = data.errors?.[0]?.message || detail;
    } catch {}
    if (response.status === 402) {
      return `${label} requires Cloudflare AI Gateway credit or BYOK: ${detail}`;
    }
    if (response.status === 429) {
      return `${label} quota is exhausted: ${detail}`;
    }
    return `${label} failed (${response.status}): ${detail}`;
  }
}
