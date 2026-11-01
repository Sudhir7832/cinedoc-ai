import { getConfig } from '../config';

export interface OpenRouterErrorDetails {
  status: number;
  message: string;
  code?: string;
  raw?: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown provider error';
}

export class OpenRouterClient {
  private static async getHeaders(customApiKey?: string): Promise<Record<string, string>> {
    const config = await getConfig();
    const apiKey = customApiKey || config.openRouterApiKey;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured. Please configure it in .env.local or Settings.');
    }
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Documentary Creator',
    };
  }

  private static async getAgentRouterHeaders(customApiKey?: string): Promise<Record<string, string>> {
    const config = await getConfig();
    const apiKey = customApiKey || config.agentRouterApiKey || config.openRouterApiKey;
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'cline/3.0.0',
    };
  }

  public static async testConnection(apiKey?: string, provider = 'agentrouter'): Promise<{ success: boolean; message: string; modelsCount?: number }> {
    try {
      const config = await getConfig();
      if (provider === 'agentrouter' || (config.agentRouterApiKey && !apiKey)) {
        const testKey = apiKey || config.agentRouterApiKey;
        if (!testKey) {
          return { success: false, message: 'AGENTROUTER_API_KEY is not configured yet.' };
        }
        const baseUrl = (config.agentRouterBaseUrl || 'https://agentrouter.org/v1').replace(/\/+$/, '');
        // Test with a quick 1-token test prompt on /v1/responses
        const res = await fetch(`${baseUrl}/responses`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'cline/3.0.0',
          },
          body: JSON.stringify({
            model: 'gpt-5.6-sol',
            input: 'ping',
            max_output_tokens: 5,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, message: `Agent Router returned status ${res.status}: ${errText.slice(0, 200)}` };
        }

        return {
          success: true,
          message: 'Connected to Agent Router (gpt-5.6-sol) successfully! $125 balance available.',
        };
      }

      const headers = await this.getHeaders(apiKey);
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          message: `OpenRouter returned status ${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        message: 'Connected to OpenRouter successfully!',
        modelsCount: data?.data?.length || 0,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: errorMessage(err),
      };
    }
  }

  public static async fetchModels(apiKey?: string): Promise<Array<Record<string, unknown>>> {
    const headers = await this.getHeaders(apiKey);
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to list OpenRouter models (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  public static async generateChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
    temperature?: number;
    responseFormat?: { type: 'json_object' };
  }): Promise<{ content: string; usage?: unknown }> {
    const config = await getConfig();
    const model = params.model || config.textModel || 'gpt-5.6-sol';
    const isAgentRouter = Boolean(config.agentRouterApiKey);

    // Primary path for Agent Router (using /v1/responses which gpt-5.6-sol and gpt-6.1-sol require)
    if (isAgentRouter) {
      const baseUrl = (config.agentRouterBaseUrl || 'https://agentrouter.org/v1').replace(/\/+$/, '');
      const responsesEndpoint = `${baseUrl}/responses`;
      const combinedInput = params.messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');

      try {
        const res = await fetch(responsesEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.agentRouterApiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'cline/3.0.0',
          },
          body: JSON.stringify({
            model,
            input: combinedInput,
          }),
          signal: AbortSignal.timeout(120000), // 2 min
        });

        if (res.ok) {
          const json = await res.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>; usage?: unknown };
          const msg = json.output?.find(output => output.type === 'message');
          const content = msg?.content?.find(item => item.type === 'output_text')?.text || json.output?.[0]?.content?.[0]?.text;
          if (content) {
            return { content, usage: json.usage };
          }
        } else {
          const errText = await res.text();
          console.warn('[AgentRouter] /v1/responses failed, will attempt /v1/chat/completions:', errText.slice(0, 150));
        }
      } catch (err: unknown) {
        console.warn('[AgentRouter] /v1/responses network exception:', errorMessage(err));
      }
    }

    // Standard chat completions path
    const endpoint = isAgentRouter
      ? `${(config.agentRouterBaseUrl || 'https://agentrouter.org/v1').replace(/\/+$/, '')}/chat/completions`
      : 'https://openrouter.ai/api/v1/chat/completions';

    const headers = isAgentRouter
      ? await this.getAgentRouterHeaders()
      : await this.getHeaders();

    const body: Record<string, unknown> = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
    };

    if (params.responseFormat) {
      body.response_format = params.responseFormat;
    }

    let response: Response;
    const providerName = isAgentRouter ? 'Agent Router' : 'OpenRouter';
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000), // 2 min timeout
      });
    } catch (err: unknown) {
      throw new Error(`${providerName} network error during text generation: ${errorMessage(err)}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      let parsedMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedMsg = parsed.error?.message || errText;
      } catch {}

      if (response.status === 401) {
        throw new Error(`${providerName} Authentication Failed (401). Please check your API key: ${parsedMsg}`);
      } else if (response.status === 402) {
        throw new Error(`${providerName} Insufficient Credits (402): ${parsedMsg}`);
      } else if (response.status === 429) {
        throw new Error(`${providerName} Rate Limit Exceeded (429): ${parsedMsg}`);
      } else {
        throw new Error(`${providerName} Text Generation Error (${response.status}) with model ${model}: ${parsedMsg}`);
      }
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`Model ${model} returned empty response content.`);
    }

    return { content, usage: json.usage };
  }

  public static async generateImage(prompt: string, modelOverride?: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<{ buffer: Buffer; cost?: number }> {
    const config = await getConfig();
    const model = modelOverride || config.imageModel || 'bytedance-seed/seedream-5-0-flash';

    // Image generation is routed to OpenRouter
    const endpoints = [
      'https://openrouter.ai/api/v1/images',
      'https://openrouter.ai/api/v1/images/generations',
    ];

    const headers = await this.getHeaders(config.openRouterApiKey);

    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      try {
        const isStandardImagesEndpoint = endpoint.endsWith('/images');
        const bodyPayload = isStandardImagesEndpoint
          ? {
              model,
              prompt,
              aspect_ratio: aspectRatio,
            }
          : {
              model,
              prompt,
              size: aspectRatio === '9:16' ? '1024x1792' : '1792x1024',
              n: 1,
              response_format: 'b64_json',
            };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
          signal: AbortSignal.timeout(90000), // 90s timeout per image
        });

        if (!response.ok) {
          const errText = await response.text();
          let parsedMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch {}

          if (response.status === 404 && endpoint === endpoints[0]) {
            // try next endpoint
            continue;
          }

          if (response.status === 402) {
            throw new Error(`OpenRouter Insufficient Credits (402): ${parsedMsg}`);
          }
          if (response.status === 429) {
            throw new Error(`OpenRouter Rate Limit Exceeded (429): ${parsedMsg}`);
          }
          throw new Error(`Image model (${model}) error (${response.status}): ${parsedMsg}`);
        }

        const data = await response.json() as { data?: Array<{ b64_json?: string; url?: string }>; usage?: { cost?: number } };
        const item = data.data?.[0];
        if (!item) {
          throw new Error(`No image data returned from model ${model}`);
        }

        if (item.b64_json) {
          const cleanB64 = item.b64_json.replace(/^data:image\/\w+;base64,/, '');
          return {
            buffer: Buffer.from(cleanB64, 'base64'),
            cost: data.usage?.cost,
          };
        } else if (item.url) {
          // Download URL
          const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(30000) });
          if (!imgRes.ok) throw new Error(`Failed to download generated image from URL: ${item.url}`);
          const arrBuf = await imgRes.arrayBuffer();
          return {
            buffer: Buffer.from(arrBuf),
            cost: data.usage?.cost,
          };
        } else {
          throw new Error(`Model ${model} returned unexpected image response shape: ${JSON.stringify(item).slice(0, 150)}`);
        }
      } catch (err: unknown) {
        lastError = err;
        const message = errorMessage(err);
        if (message.includes('Insufficient Credits') || message.includes('Authentication Failed')) {
          throw err;
        }
      }
    }

    throw lastError || new Error(`Failed to generate image using model ${model}`);
  }

  public static async generateSpeech(text: string, voice = 'alloy', modelOverride?: string): Promise<Buffer> {
    const config = await getConfig();
    const model = modelOverride || config.ttsModel;
    const headers = await this.getHeaders();

    try {
      const requestBody: Record<string, unknown> = {
        model,
        input: text,
        response_format: 'mp3',
      };

      // Lock consistent narrator voice persona across all documentary scenes
      let chosenVoice = voice;
      if (model.includes('fish-audio')) {
        const isValidHex = chosenVoice && /^[a-f0-9]{32}$/i.test(chosenVoice);
        if (!isValidHex) {
          const cfgVoice = config.ttsVoice;
          if (cfgVoice && /^[a-f0-9]{32}$/i.test(cfgVoice)) {
            chosenVoice = cfgVoice;
          } else {
            // Verified authoritative documentary narrator voice ID
            chosenVoice = 'ca3007f96ae7499ab87d27ea3599956a';
          }
        }
        requestBody.voice = chosenVoice;
      } else {
        if (chosenVoice) requestBody.voice = chosenVoice;
      }

      const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000), // 60s
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedMsg = errText;
        try {
          const parsed = JSON.parse(errText);
          parsedMsg = parsed.error?.message || errText;
        } catch {}

        if (response.status === 402) {
          throw new Error(`OpenRouter Insufficient Credits (402) for TTS: ${parsedMsg}`);
        }
        if (response.status === 404) {
          throw new Error(`OpenRouter TTS model "${model}" or speech endpoint was not found (404). Verify OPENROUTER_TTS_MODEL: ${parsedMsg}`);
        }
        throw new Error(`TTS model (${model}) error (${response.status}): ${parsedMsg}`);
      }

      const arrBuf = await response.arrayBuffer();
      const rawBuffer = Buffer.from(arrBuf);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      // If response is already an MP3 (audio/mpeg, audio/mp3, or starts with MP3/ID3 header sync bytes)
      const isMp3 = 
        contentType.includes('audio/mpeg') || 
        contentType.includes('audio/mp3') ||
        (rawBuffer.length > 4 && (
          (rawBuffer[0] === 0xff && (rawBuffer[1] & 0xe0) === 0xe0) || // MP3 frame sync word 0xFFE0
          (rawBuffer[0] === 0x49 && rawBuffer[1] === 0x44 && rawBuffer[2] === 0x33) // "ID3" tag
        ));

      if (isMp3) {
        return rawBuffer;
      }

      // If and ONLY IF the stream is genuinely raw PCM audio:
      if (contentType.includes('pcm') || contentType.includes('raw')) {
        const { spawn } = await import('child_process');
        return new Promise<Buffer>((resolve) => {
          const ff = spawn('ffmpeg', [
            '-y',
            '-f', 's16le',
            '-ar', '44100',
            '-ac', '1',
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
              resolve(rawBuffer);
            }
          });
          ff.on('error', (err) => {
            console.warn('PCM conversion warning, returning raw buffer:', err);
            resolve(rawBuffer);
          });

          ff.stdin.write(rawBuffer);
          ff.stdin.end();
        });
      }

      return rawBuffer;
    } catch (err: unknown) {
      throw new Error(`Speech generation failed with model ${model}: ${errorMessage(err)}`);
    }
  }
}
