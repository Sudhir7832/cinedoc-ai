import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DocumentaryJob, CreateJobInput, JobBillingSnapshot } from '../types';
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
  private static cancelRequests = new Set<string>();

  private static applyBilling(job: DocumentaryJob, billing: JobBillingSnapshot): void {
    job.billing = billing;
    job.creditCost = billing.totalCredits;
    job.creditsConsumed = billing.consumedCredits;
    job.creditsReserved = billing.reservedCredits;
    job.creditStatus = billing.totalCredits === 0
      ? 'not_required'
      : billing.status === 'settled'
        ? 'charged'
        : billing.status === 'released'
          ? 'released'
          : billing.consumedCredits > 0
            ? 'partially_charged'
            : 'reserved';
    job.creditsChargedAt = billing.settledAt;
    job.creditsReleasedAt = billing.releasedAt;
  }

  private static async throwIfCancelled(id: string): Promise<void> {
    if (this.cancelRequests.has(id) || await StorageManager.isCancellationRequested(id)) {
      this.cancelRequests.add(id);
      throw new Error('PIPELINE_CANCELLED');
    }
  }

  private static async syncDurableCredits(job: DocumentaryJob): Promise<void> {
    if (!job.billing?.enabled) return;
    if (job.billing.status === 'settled') return;
    const { DbManager } = await import('../db');
    let billing = job.billing;

    if (job.scenes.length > 0) {
      billing = await DbManager.updateJobBillingSceneCount(job.id, job.scenes.length);
      billing = await DbManager.consumeJobStage(job.id, 'script');
    }
    for (const scene of job.scenes) {
      if (scene.imageStatus === 'completed' && StorageManager.hasSceneImageArtifact(job.id, scene.sceneNumber)) {
        billing = await DbManager.consumeJobStage(job.id, 'images', scene.sceneNumber);
      }
      if (scene.audioStatus === 'completed' && StorageManager.hasSceneAudioArtifact(job.id, scene.sceneNumber)) {
        billing = await DbManager.consumeJobStage(job.id, 'narration', scene.sceneNumber);
      }
    }
    for (const sceneNumber of StorageManager.getRenderedSceneNumbers(job.id)) {
      billing = await DbManager.consumeJobStage(job.id, 'video', sceneNumber);
    }
    this.applyBilling(job, billing);
  }

  private static async persistProgress(job: DocumentaryJob): Promise<void> {
    await this.throwIfCancelled(job.id);
    await this.syncDurableCredits(job);
    await StorageManager.saveJob(job);
  }

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
           !['completed', 'failed', 'cancelled'].includes(j.status)
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

    const id = `doc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const totalScenes = durationMinutes * 10;
    const { DbManager } = await import('../db');
    const billing = await DbManager.reserveCreditsForJob({
      userId: input.userId,
      jobId: id,
      durationMinutes,
      sceneCount: totalScenes,
    });

    const job: DocumentaryJob = {
      id,
      mediaToken: crypto.randomBytes(16).toString('hex'),
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
      creditCost: billing.totalCredits,
      creditStatus: billing.totalCredits > 0 ? 'reserved' : 'not_required',
      creditsConsumed: billing.consumedCredits,
      creditsReserved: billing.reservedCredits,
      billing,
      status: 'queued',
      progress: {
        stage: 'queued',
        currentStep: 0,
        totalSteps: 7,
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
      await DbManager.releaseJobCredits(id);
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

    const { DbManager } = await import('../db');
    if (!job.billing?.enabled) {
      if (!job.userId) throw new Error('Authentication required. Please sign in.');
      this.applyBilling(job, await DbManager.reserveCreditsForJob({
        userId: job.userId,
        jobId: job.id,
        durationMinutes: job.durationMinutes,
        sceneCount: job.scenes.length || job.durationMinutes * 10,
      }));
    } else if (job.billing.status === 'released') {
      this.applyBilling(job, await DbManager.resumeJobCredits(job.id));
    }

    job.error = undefined;
    job.status = 'queued';
    job.progress.stage = 'queued';
    job.progress.stepLabel = 'Retrying job...';
    await StorageManager.resumeJob(job);

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
    if (job.status === 'cancelled') return job;

    if (this.activeRuns.has(id)) {
      return job;
    }

    const { DbManager } = await import('../db');
    const leaseId = crypto.randomUUID();
    if (!await DbManager.claimJobLease(id, leaseId)) return job;
    this.activeRuns.add(id);

    try {
      if (!job.billing?.enabled) {
        if (!job.userId) throw new Error('Authentication required. Please sign in.');
        const { DbManager } = await import('../db');
        this.applyBilling(job, await DbManager.reserveCreditsForJob({
          userId: job.userId,
          jobId: job.id,
          durationMinutes: job.durationMinutes,
          sceneCount: job.scenes.length || job.durationMinutes * 10,
        }));
        await StorageManager.saveJob(job);
      }
      await this.syncDurableCredits(job);

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
        job.status = 'reviewing_script';
        job.progress.stage = 'reviewing_script';
        job.progress.currentStep = 2;
        job.progress.stepLabel = `Script ready with ${scenes.length} scenes. Review and approve it to continue.`;
        await StorageManager.saveJob(job);
        await this.syncDurableCredits(job);
        await StorageManager.saveJob(job);
        await this.throwIfCancelled(id);
        return job;
      }

      if (!job.scriptApprovedAt) {
        job.status = 'reviewing_script';
        job.progress.stage = 'reviewing_script';
        job.progress.currentStep = 2;
        job.progress.stepLabel = 'Review and approve the script to continue production.';
        await StorageManager.saveJob(job);
        return job;
      }

      await this.throwIfCancelled(id);

      // Step 2: Image Generation
      const pendingImages = job.scenes.some(s => s.imageStatus !== 'completed');
      if (pendingImages) {
        job.status = 'generating_images';
        job.progress.stage = 'generating_images';
        job.progress.currentStep = 3;
        await StorageManager.saveJob(job);

        await ImageGenerator.generateImagesForJob(job, async updated => {
          await this.persistProgress(updated);
        }, () => this.cancelRequests.has(id));
      }

      await this.throwIfCancelled(id);

      // Step 3: Narration Generation
      const pendingAudio = job.scenes.some(s => s.audioStatus !== 'completed');
      if (pendingAudio) {
        job.status = 'generating_narration';
        job.progress.stage = 'generating_narration';
        job.progress.currentStep = 4;
        await StorageManager.saveJob(job);

        await AudioGenerator.generateNarrationForJob(job, async updated => {
          await this.persistProgress(updated);
        }, () => this.cancelRequests.has(id));
      }

      await this.throwIfCancelled(id);

      // Step 4: Subtitles
      if (job.includeSubtitles !== false && !job.subtitlesUrl) {
        job.status = 'creating_subtitles';
        job.progress.stage = 'creating_subtitles';
        job.progress.currentStep = 5;
        job.progress.stepLabel = 'Creating synchronized SRT subtitles...';
        await StorageManager.saveJob(job);

        await SubtitleGenerator.generateSrt(job);
      } else if (job.includeSubtitles === false) {
        const subtitlePath = path.join(StorageManager.getPublicJobDir(job.id), 'subtitles.srt');
        if (fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);
        job.subtitlesPath = undefined;
        job.subtitlesUrl = undefined;
        job.progress.currentStep = 5;
        job.progress.percent = Math.max(job.progress.percent, 75);
        job.progress.stepLabel = 'Subtitle burn-in disabled. Preparing clean video master...';
        await StorageManager.saveJob(job);
      }

      // Step 5: Video Rendering
      if (!job.videoUrl || (job.status !== 'completed' && job.billing?.status !== 'settled')) {
        job.status = 'rendering_video';
        job.progress.stage = 'rendering_video';
        job.progress.currentStep = 6;
        job.progress.stepLabel = 'Rendering Ken Burns 1080p video with FFmpeg...';
        await StorageManager.saveJob(job);

        await FFmpegRenderer.renderJobVideo(job, async updated => {
          await this.persistProgress(updated);
        }, () => this.cancelRequests.has(id));
      }

      await this.syncDurableCredits(job);
      if (job.billing?.enabled) {
        const { DbManager } = await import('../db');
        this.applyBilling(job, await DbManager.settleJobCredits(job.id, false));
      }

      job.status = 'completed';
      job.progress.stage = 'completed';
      job.progress.percent = 100;
      job.progress.stepLabel = job.billing?.enabled && job.billing.totalCredits > 0
        ? `Documentary completed. ${job.billing.consumedCredits} credits used across completed production stages.`
        : 'Documentary completed successfully!';
      await StorageManager.saveJob(job);

      return job;
    } catch (err: unknown) {
      console.error(`[JobManager] Job ${id} failed:`, err);
      const cancelled = errorMessage(err, '') === 'PIPELINE_CANCELLED';
      job.status = cancelled ? 'cancelled' : 'failed';
      job.error = cancelled ? undefined : errorMessage(err, 'An unknown error occurred during documentary generation.');
      job.progress.stage = job.status;
      job.progress.stepLabel = cancelled ? 'Production stopped by user.' : `Generation failed: ${job.error}`;
      await StorageManager.saveJob(job);

      if (job.billing?.enabled) {
        const { DbManager } = await import('../db');
        try {
          await this.syncDurableCredits(job);
        } catch (syncError) {
          console.warn(`[JobManager] Could not reconcile final durable artifacts for ${id}:`, syncError);
        }
        this.applyBilling(job, await DbManager.releaseJobCredits(job.id));
        const usage = job.billing.consumedCredits > 0 ? ` ${job.billing.consumedCredits} credits were used for completed work.` : '';
        job.progress.stepLabel = cancelled
          ? `Production stopped. Unused reserved credits were released.${usage}`
          : `Generation failed. Unused reserved credits were released.${usage}`;
        await StorageManager.saveJob(job);
      }

      return job;
    } finally {
      this.activeRuns.delete(id);
      this.cancelRequests.delete(id);
      await DbManager.releaseJobLease(id, leaseId).catch(error => console.warn(`[JobManager] Could not release worker lease for ${id}:`, error));
    }
  }

  public static async approveScript(id: string): Promise<DocumentaryJob> {
    const job = await StorageManager.loadJob(id);
    if (!job) throw new Error(`Job ${id} not found`);
    if (job.status !== 'reviewing_script') throw new Error('This script is not awaiting review.');
    if (job.billing?.enabled) {
      const { DbManager } = await import('../db');
      this.applyBilling(job, await DbManager.updateJobBillingSceneCount(job.id, job.scenes.length));
    }
    job.scriptApprovedAt = new Date().toISOString();
    job.status = 'queued';
    job.progress.stage = 'queued';
    job.progress.stepLabel = 'Script approved. Continuing production...';
    await StorageManager.saveJob(job);
    setTimeout(() => void this.executeJob(id), 100);
    return job;
  }

  public static async cancelJob(id: string): Promise<DocumentaryJob> {
    const job = await StorageManager.loadJob(id);
    if (!job) throw new Error(`Job ${id} not found`);
    if (job.status === 'completed') return job;
    const providerWorkMayBeInFlight = ['writing_script', 'generating_images', 'generating_narration', 'creating_subtitles', 'rendering_video'].includes(job.status);
    this.cancelRequests.add(id);
    if (!['failed', 'cancelled'].includes(job.status)) {
      const cancellation = await StorageManager.requestCancellation(job);
      if (cancellation.status === 'completed') {
        this.cancelRequests.delete(id);
        return cancellation;
      }
    }
    if (providerWorkMayBeInFlight) {
      job.progress.stepLabel = 'Stopping production. Completed work will be charged before unused credits are released.';
      await StorageManager.saveJob(job);
      return job;
    }
    if (job.billing?.enabled && job.billing.status !== 'settled') {
      const { DbManager } = await import('../db');
      this.applyBilling(job, await DbManager.releaseJobCredits(job.id));
    }
    if (job.status !== 'failed') {
      job.status = 'cancelled';
      job.progress.stage = 'cancelled';
    }
    const usage = job.billing?.consumedCredits ? ` ${job.billing.consumedCredits} credits were used for completed work.` : '';
    job.progress.stepLabel = `Production stopped. Unused reserved credits were released.${usage}`;
    await StorageManager.saveJob(job);
    if (!this.activeRuns.has(id)) this.cancelRequests.delete(id);
    return job;
  }

  public static async reRenderVideo(id: string): Promise<DocumentaryJob> {
    const job = await StorageManager.loadJob(id);
    if (!job) throw new Error(`Job ${id} not found`);

    if (this.activeRuns.has(id)) {
      throw new Error(`Job ${id} is currently busy processing`);
    }
    const { DbManager } = await import('../db');
    const leaseId = crypto.randomUUID();
    if (!await DbManager.claimJobLease(id, leaseId)) throw new Error(`Job ${id} is currently busy processing`);
    this.activeRuns.add(id);

    try {
      if (job.billing?.enabled && job.billing.status === 'released') {
        const { DbManager } = await import('../db');
        this.applyBilling(job, await DbManager.resumeJobCredits(job.id));
      }
      job.status = 'rendering_video';
      job.progress.stage = 'rendering_video';
      job.progress.currentStep = 6;
      job.progress.stepLabel = 'Re-rendering video with updated timeline & images...';
      job.error = undefined;
      await StorageManager.resumeJob(job);
      await this.syncDurableCredits(job);

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
        await this.persistProgress(updated);
      }, () => this.cancelRequests.has(id));

      await this.syncDurableCredits(job);
      if (job.billing?.enabled) {
        const { DbManager } = await import('../db');
        this.applyBilling(job, await DbManager.settleJobCredits(job.id, true));
      }

      job.status = 'completed';
      job.progress.stage = 'completed';
      job.progress.percent = 100;
      job.progress.stepLabel = 'Video re-rendered successfully!';
      await StorageManager.saveJob(job);
      return job;
    } catch (err: unknown) {
      console.error(`[JobManager] Re-render error for ${id}:`, err);
      const cancelled = errorMessage(err, '') === 'PIPELINE_CANCELLED';
      job.status = cancelled ? 'cancelled' : 'failed';
      job.progress.stage = job.status;
      job.error = cancelled ? undefined : errorMessage(err, 'Re-rendering video failed');
      if (job.billing?.enabled && job.billing.status !== 'settled') {
        const { DbManager } = await import('../db');
        try {
          await this.syncDurableCredits(job);
        } catch (syncError) {
          console.warn(`[JobManager] Could not reconcile re-render artifacts for ${id}:`, syncError);
        }
        this.applyBilling(job, await DbManager.releaseJobCredits(job.id));
      }
      const usage = job.billing?.consumedCredits ? ` ${job.billing.consumedCredits} credits were used for completed work.` : '';
      job.progress.stepLabel = cancelled
        ? `Re-render stopped. Unused reserved credits were released.${usage}`
        : `Re-render failed. Unused reserved credits were released.${usage}`;
      await StorageManager.saveJob(job);
      throw err;
    } finally {
      this.activeRuns.delete(id);
      await DbManager.releaseJobLease(id, leaseId).catch(error => console.warn(`[JobManager] Could not release re-render lease for ${id}:`, error));
    }
  }
}
