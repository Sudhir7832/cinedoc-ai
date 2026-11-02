import path from 'path';
import fs from 'fs';
import { DocumentaryJob, SceneItem } from '../types';
import { StorageManager } from '../storage';
import { OpenRouterClient } from './client';

const KIDS_IMAGE_DIRECTION = {
  educational: 'colorful children\'s educational storybook illustration, clear visual concepts, friendly guides, rounded shapes, bright balanced colors',
  entertainment: 'high-energy children\'s animated story illustration, funny expressive characters, playful action, bold candy colors, whimsical joyful composition',
  adventure: 'vibrant children\'s fantasy adventure illustration, brave friendly heroes, imaginative landscapes, exciting but safe action, colorful cinematic lighting',
  bedtime: 'gentle children\'s bedtime storybook illustration, cozy characters, soft pastel colors, warm moonlight, dreamy calm composition',
} as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown image generation error';
}

async function puterImageToBuffer(raw: unknown): Promise<Buffer | null> {
  if (typeof raw === 'string' && raw.startsWith('http')) {
    const response = await fetch(raw);
    return Buffer.from(await response.arrayBuffer());
  }
  if (!raw || typeof raw !== 'object') return null;

  const result = raw as { arrayBuffer?: () => Promise<ArrayBuffer>; src?: string };
  if (typeof result.arrayBuffer === 'function') {
    return Buffer.from(await result.arrayBuffer());
  }
  if (typeof result.src === 'string' && result.src.startsWith('data:image')) {
    return Buffer.from(result.src.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  }
  if (typeof result.src === 'string' && result.src.startsWith('http')) {
    const response = await fetch(result.src);
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

export class ImageGenerator {
  public static async generateImagesForJob(
    job: DocumentaryJob,
    onProgressUpdate?: (job: DocumentaryJob) => void | Promise<void>
  ): Promise<DocumentaryJob> {
    const totalScenes = job.scenes.length;
    const imagesDir = StorageManager.getJobImagesDir(job.id);
    const { getConfig } = await import('../config');
    const cfg = await getConfig();

    for (let i = 0; i < totalScenes; i++) {
      const scene = job.scenes[i];
      const composition = job.aspectRatio === '9:16' ? 'vertical 9:16 portrait composition, mobile-first framing' : 'widescreen 16:9 composition';
      const styledPrompt = job.contentStyle === 'kids'
        ? `${scene.imagePrompt}, ${KIDS_IMAGE_DIRECTION[job.kidsFormat || 'entertainment']}, ${composition}, age-appropriate and non-frightening, no text, no watermark`
        : `${scene.imagePrompt}, cinematic documentary realism, natural detail, ${composition}, no text, no watermark`;
      const filename = `scene_${scene.sceneNumber.toString().padStart(2, '0')}.png`;
      const baseName = `scene_${scene.sceneNumber.toString().padStart(2, '0')}`;
      const existingFilename = ['png', 'jpg', 'webp']
        .map(extension => `${baseName}.${extension}`)
        .find(candidate => {
          const candidatePath = path.join(imagesDir, candidate);
          return fs.existsSync(candidatePath) && fs.statSync(candidatePath).size > 1000;
        });

      // Check if image already exists from a previous or partial run
      if (existingFilename) {
        const existingFilePath = path.join(imagesDir, existingFilename);
        scene.imagePath = `/generated/${job.id}/images/${existingFilename}`;
        scene.imageUpdatedAt = fs.statSync(existingFilePath).mtime.toISOString();
        scene.imageStatus = 'completed';
        scene.error = undefined;
        job.progress.imagesCompleted = job.scenes.filter(s => s.imageStatus === 'completed').length;
        if (onProgressUpdate) await onProgressUpdate(job);
        continue;
      }

      scene.imageStatus = 'generating';
      job.progress.stepLabel = `Generating AI image ${i + 1} of ${totalScenes}...`;
      if (onProgressUpdate) await onProgressUpdate(job);

      // Attempt generation with up to 3 retries
      let success = false;
      let lastErrMessage = '';

      const useCloudflareFirst = (cfg.imageProvider === 'cloudflare' || !cfg.imageProvider) && Boolean(cfg.cloudflareAccountId && cfg.cloudflareApiToken);
      const usePuterFirst = cfg.imageProvider === 'puter' && Boolean(cfg.puterAuthToken);

      // Priority 1: Cloudflare Workers AI (10,000 neurons/day free tier)
      if (useCloudflareFirst) {
        try {
          const { CloudflareClient } = await import('../cloudflare/client');
          const { buffer } = await CloudflareClient.generateImage(styledPrompt, cfg.cloudflareImageModel);
          if (buffer && buffer.length > 1000) {
            scene.imagePath = StorageManager.saveImageFile(job.id, scene.sceneNumber, buffer);
            scene.imageUpdatedAt = new Date().toISOString();
            scene.imageStatus = 'completed';
            scene.error = undefined;
            job.progress.imagesCompleted = job.scenes.filter(s => s.imageStatus === 'completed').length;
            job.progress.percent = Math.round(15 + (job.progress.imagesCompleted / totalScenes) * 35);
            await StorageManager.saveJob(job);
            if (onProgressUpdate) await onProgressUpdate(job);
            continue;
          }
        } catch (cfErr: unknown) {
          console.warn(`[ImageGenerator] Cloudflare Workers AI failed for scene ${scene.sceneNumber}:`, errorMessage(cfErr));
        }
      }

      // Priority 2: Puter.js AI image generation
      if (usePuterFirst && cfg.puterAuthToken) {
        try {
          const { init } = await import('@heyputer/puter.js/src/init.cjs');
          const puter = init(cfg.puterAuthToken);
          const raw: unknown = await puter.ai.txt2img(styledPrompt);
          const buf = await puterImageToBuffer(raw);
          if (buf && buf.length > 1000) {
            scene.imagePath = StorageManager.saveImageFile(job.id, scene.sceneNumber, buf);
            scene.imageUpdatedAt = new Date().toISOString();
            scene.imageStatus = 'completed';
            scene.error = undefined;
            job.progress.imagesCompleted = job.scenes.filter(s => s.imageStatus === 'completed').length;
            job.progress.percent = Math.round(15 + (job.progress.imagesCompleted / totalScenes) * 35);
            await StorageManager.saveJob(job);
            if (onProgressUpdate) await onProgressUpdate(job);
            continue;
          }
        } catch (puterErr: unknown) {
          console.warn(`[ImageGenerator] Puter.js image generation failed for scene ${scene.sceneNumber}:`, errorMessage(puterErr));
        }
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { buffer, cost } = await OpenRouterClient.generateImage(styledPrompt, undefined, job.aspectRatio || '16:9');
          scene.imagePath = StorageManager.saveImageFile(job.id, scene.sceneNumber, buffer);
          scene.imageUpdatedAt = new Date().toISOString();
          scene.imageStatus = 'completed';
          scene.error = undefined;
          success = true;

          if (cost && job.costEstimate) {
            job.costEstimate.estimatedCostUsd += cost;
          }
          break;
        } catch (err: unknown) {
          lastErrMessage = errorMessage(err);
          console.warn(`[ImageGenerator] Attempt ${attempt} failed for scene ${scene.sceneNumber}:`, lastErrMessage);

          // If in testMode or if API does not support images / channel unavailable / insufficient credits
          if (
            cfg.testMode ||
            lastErrMessage.includes('Insufficient Credits') ||
            lastErrMessage.includes('402') ||
            lastErrMessage.includes('404') ||
            lastErrMessage.includes('503') ||
            lastErrMessage.includes('无可用渠道') ||
            lastErrMessage.includes('Invalid URL') ||
            lastErrMessage.includes('Failed to generate image')
          ) {
            // If Puter auth token is available, attempt Puter before falling back to visual cards
            if (cfg.puterAuthToken) {
              try {
                const { init } = await import('@heyputer/puter.js/src/init.cjs');
                const puter = init(cfg.puterAuthToken);
                const raw: unknown = await puter.ai.txt2img(styledPrompt);
                const buf = await puterImageToBuffer(raw);
                if (buf && buf.length > 1000) {
                  scene.imagePath = StorageManager.saveImageFile(job.id, scene.sceneNumber, buf);
                  scene.imageUpdatedAt = new Date().toISOString();
                  scene.imageStatus = 'completed';
                  scene.error = undefined;
                  success = true;
                  break;
                }
              } catch (puterFallbackErr: unknown) {
                console.warn(`[ImageGenerator] Puter fallback also failed:`, errorMessage(puterFallbackErr));
              }
            }

            console.log(`[ImageGenerator] Generating high-res cinematic documentary visual for scene ${scene.sceneNumber}...`);
            await this.generateCinematicSceneImage(job.id, scene, job.topic, job.contentStyle || 'documentary', job.kidsFormat || 'entertainment', job.aspectRatio || '16:9');
            scene.imagePath = `/generated/${job.id}/images/${filename}`;
            scene.imageUpdatedAt = new Date().toISOString();
            scene.imageStatus = 'completed';
            scene.error = undefined;
            success = true;
            break;
          }

          if (lastErrMessage.includes('Authentication Failed')) {
            break;
          }

          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 1200));
          }
        }
      }

      if (!success) {
        scene.imageStatus = 'failed';
        scene.error = lastErrMessage;
        job.status = 'failed';
        job.error = `Image generation failed at scene ${scene.sceneNumber}: ${lastErrMessage}`;
        await StorageManager.saveJob(job);
        throw new Error(job.error);
      }

      job.progress.imagesCompleted = job.scenes.filter(s => s.imageStatus === 'completed').length;
      job.progress.percent = Math.round(15 + (job.progress.imagesCompleted / totalScenes) * 35); // 15% to 50%
      await StorageManager.saveJob(job);
      if (onProgressUpdate) await onProgressUpdate(job);

      // Brief delay between calls to be gentle with rate limits
      await new Promise(r => setTimeout(r, 400));
    }

    return job;
  }

  public static async generateCinematicSceneImage(
    jobId: string,
    scene: SceneItem,
    topic: string,
    contentStyle: 'documentary' | 'kids' = 'documentary',
    kidsFormat: 'educational' | 'entertainment' | 'adventure' | 'bedtime' = 'entertainment',
    aspectRatio: '16:9' | '9:16' = '16:9'
  ): Promise<string> {
    const imagesDir = StorageManager.getJobImagesDir(jobId);
    const filename = `scene_${scene.sceneNumber.toString().padStart(2, '0')}.png`;
    const fullPath = path.join(imagesDir, filename);

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Deep rich cinematic color palettes alternating per scene
    const documentaryPalettes = [
      '#08162b', '#102a45', '#163b5c', '#1b4d73', '#225d8a',
      '#1b3b3a', '#244d4c', '#2c5e5c', '#336e6d', '#1f2e4d',
    ];
    const kidsPalettes = [
      '#2563eb', '#7c3aed', '#db2777', '#0d9488', '#ea580c',
      '#4f46e5', '#0891b2', '#be185d', '#059669', '#9333ea',
    ];
    const bedtimePalettes = ['#4338ca', '#6366f1', '#7c3aed', '#2563eb', '#4f46e5'];
    const palettes = contentStyle === 'kids'
      ? (kidsFormat === 'bedtime' ? bedtimePalettes : kidsPalettes)
      : documentaryPalettes;
    const color = palettes[(scene.sceneNumber - 1) % palettes.length];

    const safeTitle = (scene.title || `Scene ${scene.sceneNumber}`).replace(/['":\\]/g, ' ').slice(0, 35);
    const safeTopic = (topic || 'Documentary').replace(/['":\\]/g, ' ').slice(0, 40).toUpperCase();

    const isHindi = /[\u0900-\u097F]/.test(safeTitle + safeTopic);
    let fontClause = '';
    if (process.platform === 'win32') {
      const fontfile = isHindi ? 'C\\:/Windows/Fonts/Nirmala.ttc' : 'C\\:/Windows/Fonts/arial.ttf';
      fontClause = `:fontfile='${fontfile}'`;
    } else {
      const linuxFonts = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
      ];
      const found = linuxFonts.find(f => fs.existsSync(f));
      if (found) fontClause = `:fontfile='${found}'`;
    }

    const sceneLabel = contentStyle === 'kids' ? `STORY ${scene.sceneNumber}` : `SCENE ${scene.sceneNumber}`;
    const width = aspectRatio === '9:16' ? 1080 : 1920;
    const height = aspectRatio === '9:16' ? 1920 : 1080;
    const topY = aspectRatio === '9:16' ? 180 : 80;
    const barHeight = aspectRatio === '9:16' ? 90 : 60;
    const cmd = `ffmpeg -y -f lavfi -i "color=c=${color}:s=${width}x${height}" -vf "drawtext=text='${safeTopic}'${fontClause}:fontsize=28:fontcolor=white@0.8:x=(w-text_w)/2:y=${topY},drawtext=text='${sceneLabel}\\: ${safeTitle.toUpperCase()}'${fontClause}:fontsize=42:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2,drawbox=x=0:y=0:w=${width}:h=${barHeight}:color=black@0.45:t=fill,drawbox=x=0:y=${height - barHeight}:w=${width}:h=${barHeight}:color=black@0.45:t=fill" -frames:v 1 "${fullPath}"`;

    await execAsync(cmd);
    return `/generated/${jobId}/images/${filename}`;
  }
}
