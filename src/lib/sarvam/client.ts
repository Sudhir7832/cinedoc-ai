import { ContentStyle } from '../types';

type SarvamLanguageCode = 'bn-IN' | 'en-IN' | 'gu-IN' | 'hi-IN' | 'kn-IN' | 'ml-IN' | 'mr-IN' | 'od-IN' | 'pa-IN' | 'ta-IN' | 'te-IN';

interface SarvamSpeechOptions {
  apiKey: string;
  model: string;
  speaker: string;
  language?: string;
  contentStyle?: ContentStyle;
  pace?: number;
}

interface SarvamSpeechResponse {
  audios?: string[];
  error?: { message?: string };
  message?: string;
}

const LANGUAGE_CODES: Record<string, SarvamLanguageCode> = {
  Bengali: 'bn-IN',
  English: 'en-IN',
  Gujarati: 'gu-IN',
  Hindi: 'hi-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
  Marathi: 'mr-IN',
  Odia: 'od-IN',
  Punjabi: 'pa-IN',
  Tamil: 'ta-IN',
  Telugu: 'te-IN',
};

function resolveLanguageCode(language: string | undefined, text: string): SarvamLanguageCode {
  if (language && LANGUAGE_CODES[language]) return LANGUAGE_CODES[language];
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  return 'en-IN';
}

function resolveSpeaker(speaker: string, languageCode: SarvamLanguageCode, contentStyle: ContentStyle): string {
  const isHindi = languageCode === 'hi-IN';
  const isEnglish = languageCode === 'en-IN';
  if (isHindi && speaker.includes('_en_')) {
    return contentStyle === 'kids' ? 'chhavi_hi_kids' : 'anand_hi_documentary';
  }
  if (isEnglish && speaker.includes('_hi_')) {
    return contentStyle === 'kids' ? 'nupur_en_kids' : 'girish_en_documentary';
  }
  return speaker;
}

export class SarvamClient {
  public static async generateSpeech(text: string, options: SarvamSpeechOptions): Promise<Buffer> {
    if (!options.apiKey) throw new Error('Sarvam API key is not configured.');
    if (!text.trim()) throw new Error('Sarvam TTS requires narration text.');
    if (text.length > 2500) throw new Error('Sarvam TTS text must be 2500 characters or fewer.');

    const contentStyle = options.contentStyle || 'documentary';
    const languageCode = resolveLanguageCode(options.language, text);
    const speaker = resolveSpeaker(options.speaker, languageCode, contentStyle);
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': options.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        model: options.model || 'bulbul:v4-flash',
        language_code: languageCode,
        speaker,
        pace: options.pace ?? (contentStyle === 'kids' ? 1.03 : 0.94),
        speech_sample_rate: 24000,
        output_audio_codec: 'mp3',
      }),
    });

    const data = await response.json() as SarvamSpeechResponse;
    if (!response.ok) {
      throw new Error(data.error?.message || data.message || `Sarvam TTS failed with status ${response.status}.`);
    }
    if (!Array.isArray(data.audios) || data.audios.length === 0) {
      throw new Error('Sarvam TTS returned no audio data.');
    }

    const audio = Buffer.from(data.audios.join(''), 'base64');
    if (audio.length === 0) throw new Error('Sarvam TTS returned empty decoded audio.');
    return audio;
  }
}
