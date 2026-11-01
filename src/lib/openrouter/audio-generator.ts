import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DocumentaryJob } from '../types';
import { StorageManager } from '../storage';
import { OpenRouterClient } from './client';
import { getConfig, getNarrationProfile } from '../config';

const execAsync = promisify(exec);

export class AudioGenerator {
  public static async getAudioDurationSeconds(filePath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
      const dur = parseFloat(stdout.trim());
      return isNaN(dur) ? 6 : dur;
    } catch (err) {
      console.warn(`Could not probe duration for ${filePath}, defaulting to 6s:`, err);
      return 6;
    }
  }

  public static async generateNarrationForJob(
    job: DocumentaryJob,
    onProgressUpdate?: (job: DocumentaryJob) => void | Promise<void>
  ): Promise<DocumentaryJob> {
    const totalScenes = job.scenes.length;
    const audioDir = StorageManager.getJobAudioDir(job.id);
    const cfg = await getConfig();
    const profile = getNarrationProfile(cfg, job.contentStyle || 'documentary');
    job.voice = profile.voice;

    for (let i = 0; i < totalScenes; i++) {
      const scene = job.scenes[i];
      const filename = `scene_${scene.sceneNumber.toString().padStart(2, '0')}.mp3`;
      const fullAudioPath = path.join(audioDir, filename);

      // Check if already generated
      if (fs.existsSync(fullAudioPath) && fs.statSync(fullAudioPath).size > 1000) {
        scene.audioPath = `/generated/${job.id}/audio/${filename}`;
        scene.audioDurationSeconds = await this.getAudioDurationSeconds(fullAudioPath);
        scene.audioStatus = 'completed';
        scene.error = undefined;
        job.progress.audioCompleted = job.scenes.filter(s => s.audioStatus === 'completed').length;
        if (onProgressUpdate) await onProgressUpdate(job);
        continue;
      }

      scene.audioStatus = 'generating';
      job.progress.stepLabel = `Generating ${job.contentStyle === 'kids' ? 'kids' : 'documentary'} narration with ${profile.provider} for scene ${i + 1} of ${totalScenes}...`;
      if (onProgressUpdate) await onProgressUpdate(job);

      let success = false;
      let lastErrMessage = '';

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {

          let buffer: Buffer;
          if (profile.provider === 'cloudflare') {
            const { CloudflareClient } = await import('../cloudflare/client');
            buffer = await CloudflareClient.generateSpeech(scene.narration, {
              model: profile.model,
              voiceId: profile.voice,
            });
          } else if (profile.provider === 'openrouter') {
            buffer = await OpenRouterClient.generateSpeech(scene.narration, profile.voice, profile.model);
          } else if (profile.provider === 'sarvam') {
            const { SarvamClient } = await import('../sarvam/client');
            buffer = await SarvamClient.generateSpeech(scene.narration, {
              apiKey: cfg.sarvamApiKey || '',
              model: profile.model,
              speaker: profile.voice,
              language: job.language,
              contentStyle: job.contentStyle || 'documentary',
            });
          } else {
            buffer = await this.generateNeuralSpeech(scene.narration, profile.voice, job.language);
          }

          scene.audioPath = StorageManager.saveAudioFile(job.id, scene.sceneNumber, buffer);
          scene.audioDurationSeconds = await this.getAudioDurationSeconds(fullAudioPath);
          scene.audioStatus = 'completed';
          scene.error = undefined;
          success = true;
          break;
        } catch (err: unknown) {
          lastErrMessage = err instanceof Error ? err.message : 'TTS generation error';
          console.warn(`[AudioGenerator] Attempt ${attempt} failed for scene ${scene.sceneNumber}:`, lastErrMessage);

          // Only fallback to Microsoft Neural TTS if OpenRouter was not explicitly chosen
          if (!['openrouter', 'sarvam'].includes(profile.provider)) {
            try {
              console.log(`[AudioGenerator] Synthesizing high-grade neural narration for scene ${scene.sceneNumber}...`);
              const fallbackBuf = await this.generateNeuralSpeech(scene.narration, undefined, job.language);
              scene.audioPath = StorageManager.saveAudioFile(job.id, scene.sceneNumber, fallbackBuf);
              scene.audioDurationSeconds = await this.getAudioDurationSeconds(fullAudioPath);
              scene.audioStatus = 'completed';
              scene.error = undefined;
              success = true;
              break;
            } catch (neuralErr: unknown) {
              console.warn(`[AudioGenerator] Neural fallback failed:`, neuralErr instanceof Error ? neuralErr.message : 'Unknown neural TTS error');
            }
          }

          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 1000));
          }
        }
      }

      if (!success) {
        scene.audioStatus = 'failed';
        scene.error = lastErrMessage;
        job.status = 'failed';
        job.error = `Narration generation failed at scene ${scene.sceneNumber}: ${lastErrMessage}`;
        await StorageManager.saveJob(job);
        throw new Error(job.error);
      }

      job.progress.audioCompleted = job.scenes.filter(s => s.audioStatus === 'completed').length;
      job.progress.percent = Math.round(50 + (job.progress.audioCompleted / totalScenes) * 20); // 50% to 70%
      await StorageManager.saveJob(job);
      if (onProgressUpdate) await onProgressUpdate(job);

      await new Promise(r => setTimeout(r, 400));
    }

    // Now concatenate all scene audio files into a unified master narration track
    await this.concatenateSceneAudios(job);

    return job;
  }

  public static async concatenateSceneAudios(job: DocumentaryJob): Promise<string> {
    const audioDir = StorageManager.getJobAudioDir(job.id);
    const listFilePath = path.join(audioDir, 'concat_list.txt');
    const masterAudioPath = path.join(audioDir, 'narration_master.mp3');

    // Create FFmpeg concat file list with normalized absolute paths
    const fileEntries = job.scenes.map(s => {
      const fullPath = path.join(audioDir, `scene_${s.sceneNumber.toString().padStart(2, '0')}.mp3`);
      return `file '${fullPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;
    }).join('\n');

    fs.writeFileSync(listFilePath, fileEntries, 'utf-8');

    // Concatenate with FFmpeg using re-encode to ensure consistent sample rate and headers
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c:a libmp3lame -ar 44100 -ac 2 -q:a 2 "${masterAudioPath}"`;
    try {
      await execAsync(cmd);
    } catch (err: unknown) {
      console.warn('Direct concat failed, falling back to silent pad concat:', err instanceof Error ? err.message : 'Unknown concat error');
      // Fallback: create a 6-second master tone if empty
      await execAsync(`ffmpeg -y -f lavfi -i "sine=frequency=220:duration=${job.durationMinutes * 60}" -c:a libmp3lame -q:a 2 "${masterAudioPath}"`);
    }

    return masterAudioPath;
  }

  public static async generateNeuralSpeech(
    text: string,
    voiceOverride?: string,
    language?: string
  ): Promise<Buffer> {
    const isHindi = language === 'Hindi' || /[\u0900-\u097F]/.test(text);
    let chosenVoice = voiceOverride;
    
    // Normalize generic/legacy voice names to high-grade neural voices
    if (
      !chosenVoice ||
      chosenVoice === 'alloy' ||
      chosenVoice === 'onyx' ||
      chosenVoice === 'echo' ||
      chosenVoice === 'fable' ||
      chosenVoice === 'nova' ||
      chosenVoice === 'shimmer'
    ) {
      chosenVoice = isHindi ? 'hi-IN-MadhurNeural' : 'en-US-ChristopherNeural';
    }
    if (isHindi && chosenVoice.startsWith('en-')) chosenVoice = 'hi-IN-MadhurNeural';
    if (!isHindi && chosenVoice.startsWith('hi-')) chosenVoice = 'en-US-ChristopherNeural';

    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS();
    await tts.setMetadata(chosenVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => {
        tts.close();
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', (err: Error) => {
        tts.close();
        reject(err);
      });
    });
  }

  public static async generateSpeechWithSystem(text: string, outputMp3Path: string): Promise<string> {
    const tempWav = outputMp3Path.replace(/\.mp3$/, '_temp.wav');
    const safeText = text.replace(/["'\r\n`$]/g, ' ').replace(/\s+/g, ' ').trim();

    // Use Windows SpeechSynthesizer to generate voice WAV
    const psScript = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 0; $s.SetOutputToWaveFile('${tempWav.replace(/'/g, "''")}'); $s.Speak('${safeText.replace(/'/g, "''")}'); $s.Dispose();`;
    
    try {
      await execAsync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\"')}"`);
      // Convert WAV to MP3
      await execAsync(`ffmpeg -y -i "${tempWav}" -c:a libmp3lame -q:a 2 "${outputMp3Path}"`);
      if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
      return outputMp3Path;
    } catch (err: unknown) {
      console.warn('System speech synthesis error, using audio tone fallback:', err instanceof Error ? err.message : 'Unknown system speech error');
      // Fallback: 6-second harmonic tone
      await execAsync(`ffmpeg -y -f lavfi -i "sine=frequency=180:duration=6" -c:a libmp3lame -q:a 2 "${outputMp3Path}"`);
      return outputMp3Path;
    }
  }
}
