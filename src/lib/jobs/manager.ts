import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DocumentaryJob, CreateJobInput } from '../types';
import { StorageManager } from '../storage';
import { ScriptGenerator } from '../openrouter/script-generator';
import { ImageGenerator } from '../openrouter/image-generator';
import { AudioGenerator } from '../openrouter/audio-generator';
import { SubtitleGenerator } from '../subtitles/srt-generator';
import { FFmpegRenderer } from '../video/ffmpeg-renderer';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export class JobManager {
  private static activeRuns = new Set<string>();

  public static async createJob(input: CreateJobInput): Promise<DocumentaryJob> {
    const topic = input.topic.trim();
    if (!topic) {
      throw new Error('Topic is required');
    }
    const durationMinutes = input.durationMinutes || 1;
    const contentStyle = input.contentStyle || 'documentary';
    const kidsFormat = contentStyle === 'kids' ? (input.kidsFormat || 'entertainment') : undefined;
    const aspectRatio = durationMinutes === 1 ? (input.aspectRatio || '16:9') : '16:9';
    if (![1, 3, 5].includes(durationMinutes)) {
      throw new Error('Duration must be 1, 3, or 5 minutes');
    }

    // Check for an identical running job from the same owner to prevent accidental duplicates
    const recent = await StorageManager.listJobs();
    const existingRunning = recent.find(
      j => j.userId === input.userId &&
           j.topic.toLowerCase() === topic.toLowerCase() &&
           j.durationMinutes === durationMinutes &&
           (j.contentStyle || 'documentary') === contentStyle &&
           j.kidsFormat === kidsFormat &&
           (j.includeSubtitles !== false) === (input.includeSubtitles !== false) &&
           (j.aspectRatio || '16:9') === aspectRatio &&
           !['completed', 'failed'].includes(j.status)
    );
    if (existingRunning) {
      return existingRunning;
    }

    const { detectLanguage } = await import('../openrouter/script-generator');
    const autoLang = input.language && input.language !== 'Auto-Detect' 
      ? input.language 
      : detectLanguage(`${input.customScript || ''} ${topic}`);

    if (!input.userId) {
      throw new Error('Authentication required. Please sign in.');
    }

    const { DbManager } = await import('../db');
    const reservation = await DbManager.assertCreditsCanBeReserved(input.userId, durationMinutes);

    const id = `doc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const totalScenes = durationMinutes * 10;

    const job: DocumentaryJob = {
      id,
      topic,
      customScript: input.customScript?.trim(),
      durationMinutes,
      contentStyle,
      kidsFormat,
      includeSubtitles: input.includeSubtitles !== false,
      aspectRatio,
      language: autoLang,
      voice: input.voice || 'alloy',
      userId: input.userId,
      creditCost: reservation.cost,
      creditStatus: reservation.cost > 0 ? 'reserved' : 'not_required',
      status: 'queued',
      progress: {
        stage: 'queued',
        currentStep: 0,
        totalSteps: 6,
        stepLabel: 'Job queued...',
        imagesCompleted: 0,
        totalImages: totalScenes,
        audioCompleted: 0,
        totalAudio: totalScenes,
        percent: 0,
      },
      scenes: [],
      costEstimate: {
        estimatedCostUsd: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await StorageManager.saveJob(job);
    } catch (error) {
      await DbManager.releaseReservedCredits(input.userId, reservation.cost);
      throw error;
    }

    // Asynchronously trigger execution
    setTimeout(() => {
      this.executeJob(id).catch(err => {
        console.error(`Error executing job ${id}:`, err);
      });
    }, 100);

    return job;
  }

  public static async retryJob(id: string): Promise<DocumentaryJob> {
    const job = await StorageManager.loadJob(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }

    if (this.activeRuns.has(id)) {
      return job;
    }

    if (job.userId && job.creditStatus !== 'reserved' && job.creditStatus !== 'charged' && job.creditStatus !== 'not_required') {
      const { DbManager } = await import('../db');
      const reservation = await DbManager.assertCreditsCanBeReserved(job.userId, job.durationMinutes);
      job.creditCost = reservation.cost;
      job.creditStatus = reservation.cost > 0 ? 'reserved' : 'not_required';
      job.creditsReleasedAt = undefined;
    }

    job.error = undefined;
    job.status = 'queued';
    job.progress.stepLabel = 'Retrying job...';
    await StorageManager.saveJob(job);

    setTimeout(() => {
      this.executeJob(id).catch(err => {
        console.error(`Error retrying job ${id}:`, err);
      });
    }, 100);

    return job;
  }

  public static async executeJob(id: string): Promise<DocumentaryJob> {
    const job = await StorageManager.loadJob(id);
    if (!job) throw new Error(`Job ${id} not found`);

    if (this.activeRuns.has(id)) {
      return job;
    }

    this.activeRuns.add(id);

    try {
      // Step 1: Script Generation
      if (!job.scenes || job.scenes.length === 0) {
        job.status = 'writing_script';
        job.progress.stage = 'writing_script';
        job.progress.currentStep = 1;
        job.progress.percent = 5;
        job.progress.stepLabel = `Generating ${job.contentStyle === 'kids' ? 'kids story' : 'documentary'} script for "${job.topic}" (${job.durationMinutes} min, ${job.durationMinutes * 10} scenes)...`;
        await StorageManager.saveJob(job);

        const { summary, scenes, detectedLanguage } = await ScriptGenerator.generateDocumentaryScript({
          topic: job.topic,
          customScript: job.customScript,
          durationMinutes: job.durationMinutes,
          language: job.language,
          contentStyle: job.contentStyle || 'documentary',
          kidsFormat: job.kidsFormat || 'entertainment',
          aspectRatio: job.aspectRatio || '16:9',
        });

        if (detectedLanguage && (!job.language || job.language === 'Auto-Detect')) {
          job.language = detectedLanguage;
        }

        job.scriptSummary = summary;
        job.scenes = scenes;
        job.progress.percent = 15;
        job.progress.stepLabel = `Script generated with ${scenes.length} scenes.`;
        await StorageManager.saveJob(job);
      }

      // Step 2: Image Generation
      const pendingImages = job.scenes.some(s => s.imageStatus !== 'completed');
      if (pendingImages) {
        job.status = 'generating_images';
        job.progress.stage = 'generating_images';
        job.progress.currentStep = 2;
        await StorageManager.saveJob(job);

        await ImageGenerator.generateImagesForJob(job, async updated => {
          await StorageManager.saveJob(updated);
        });
      }

      // Step 3: Narration Generation
      const pendingAudio = job.scenes.some(s => s.audioStatus !== 'completed');
      if (pendingAudio) {
        job.status = 'generating_narration';
        job.progress.stage = 'generating_narration';
        job.progress.currentStep = 3;
        await StorageManager.saveJob(job);

        await AudioGenerator.generateNarrationForJob(job, async updated => {
          await StorageManager.saveJob(updated);
        });
      }

      // Step 4: Subtitles
      if (job.includeSubtitles !== false && !job.subtitlesUrl) {
        job.status = 'creating_subtitles';
        job.progress.stage = 'creating_subtitles';
        job.progress.currentStep = 4;
        job.progress.stepLabel = 'Creating synchronized SRT subtitles...';
        await StorageManager.saveJob(job);

        await SubtitleGenerator.generateSrt(job);
      } else if (job.includeSubtitles === false) {
        const subtitlePath = path.join(StorageManager.getPublicJobDir(job.id), 'subtitles.srt');
        if (fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);
        job.subtitlesPath = undefined;
        job.subtitlesUrl = undefined;
        job.progress.currentStep = 4;
        job.progress.percent = Math.max(job.progress.percent, 75);
        job.progress.stepLabel = 'Subtitle burn-in disabled. Preparing clean video master...';
        await StorageManager.saveJob(job);
      }

      // Step 5: Video Rendering
      if (!job.videoUrl || job.status !== 'completed') {
        job.status = 'rendering_video';
        job.progress.stage = 'rendering_video';
        job.progress.currentStep = 5;
        job.progress.stepLabel = 'Rendering Ken Burns 1080p video with FFmpeg...';
        await StorageManager.saveJob(job);

        await FFmpegRenderer.renderJobVideo(job, async updated => {
          await StorageManager.saveJob(updated);
        });
      }

      if (job.userId && job.creditStatus === 'reserved') {
        const { DbManager } = await import('../db');
        await DbManager.chargeCreditsForCompletedJob(job.userId, job.creditCost || 0, job.id, job.topic);
        job.creditStatus = 'charged';
        job.creditsChargedAt = new Date().toISOString();
      }

      job.status = 'completed';
      job.progress.stage = 'completed';
      job.progress.percent = 100;
      job.progress.stepLabel = job.creditStatus === 'charged'
        ? `Documentary completed. ${job.creditCost} credits charged.`
        : 'Documentary completed successfully!';
      await StorageManager.saveJob(job);

      return job;
    } catch (err: unknown) {
      console.error(`[JobManager] Job ${id} failed:`, err);
      job.status = 'failed';
      job.error = errorMessage(err, 'An unknown error occurred during documentary generation.');
      job.progress.stepLabel = `Generation failed: ${job.error}`;
      await StorageManager.saveJob(job);

      if (job.creditStatus === 'reserved') {
        if (job.userId) {
          const { DbManager } = await import('../db');
          await DbManager.releaseReservedCredits(job.userId, job.creditCost || 0);
        }
        job.creditStatus = 'released';
        job.creditsReleasedAt = new Date().toISOString();
        job.progress.stepLabel = `Generation failed. Reserved credits were released: ${job.error}`;
        await StorageManager.saveJob(job);
      }

      return job;
    } finally {
      this.activeRuns.delete(id);
    }
  }

  public static async reRenderVideo(id: string): Promise<DocumentaryJob> {
    const job = await StorageManager.loadJob(id);
    if (!job) throw new Error(`Job ${id} not found`);

    if (this.activeRuns.has(id)) {
      throw new Error(`Job ${id} is currently busy processing`);
    }

    if (job.userId && (job.creditStatus === 'released' || job.creditStatus === 'charge_failed')) {
      const { DbManager } = await import('../db');
      const reservation = await DbManager.assertCreditsCanBeReserved(job.userId, job.durationMinutes);
      job.creditCost = reservation.cost;
      job.creditStatus = reservation.cost > 0 ? 'reserved' : 'not_required';
      job.creditsReleasedAt = undefined;
    }

    this.activeRuns.add(id);

    try {
      job.status = 'rendering_video';
      job.progress.stage = 'rendering_video';
      job.progress.currentStep = 5;
      job.progress.stepLabel = 'Re-rendering video with updated timeline & images...';
      job.error = undefined;
      await StorageManager.saveJob(job);

      // 1. Re-concatenate narration audios to match current scene sequence
      await AudioGenerator.concatenateSceneAudios(job);

      // 2. Re-generate SRT subtitles with updated timings & narration text
      if (job.includeSubtitles !== false) {
        await SubtitleGenerator.generateSrt(job);
      } else {
        const subtitlePath = path.join(StorageManager.getPublicJobDir(job.id), 'subtitles.srt');
        if (fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);
        job.subtitlesPath = undefined;
        job.subtitlesUrl = undefined;
      }

      // 3. Re-render Ken Burns 1080p video with custom/uploaded images and durations
      await FFmpegRenderer.renderJobVideo(job, async updated => {
        await StorageManager.saveJob(updated);
      });

      if (job.userId && job.creditStatus === 'reserved') {
        const { DbManager } = await import('../db');
        await DbManager.chargeCreditsForCompletedJob(job.userId, job.creditCost || 0, job.id, job.topic);
        job.creditStatus = 'charged';
        job.creditsChargedAt = new Date().toISOString();
      }

      job.status = 'completed';
      job.progress.stage = 'completed';
      job.progress.percent = 100;
      job.progress.stepLabel = 'Video re-rendered successfully!';
      await StorageManager.saveJob(job);
      return job;
    } catch (err: unknown) {
      console.error(`[JobManager] Re-render error for ${id}:`, err);
      job.status = 'failed';
      job.error = errorMessage(err, 'Re-rendering video failed');
      job.progress.stepLabel = `Re-render failed: ${job.error}`;
      if (job.creditStatus === 'reserved') {
        if (job.userId) {
          const { DbManager } = await import('../db');
          await DbManager.releaseReservedCredits(job.userId, job.creditCost || 0);
        }
        job.creditStatus = 'released';
        job.creditsReleasedAt = new Date().toISOString();
        job.progress.stepLabel = `Re-render failed. Reserved credits were released: ${job.error}`;
      }
      await StorageManager.saveJob(job);
      throw err;
    } finally {
      this.activeRuns.delete(id);
    }
  }
}
