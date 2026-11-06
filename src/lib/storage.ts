import fs from 'fs';
import path from 'path';
import { DocumentaryJob } from './types';
import { getServiceSupabase } from './supabase/server';
import type { Json } from './supabase/database.types';
import { R2Storage } from './storage/r2';

type RawRpcClient = {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>;
};

async function jobRpc(name: string, args: Record<string, unknown>): Promise<DocumentaryJob> {
  const client = getServiceSupabase() as unknown as RawRpcClient;
  const { data, error } = await client.rpc<DocumentaryJob>(name, args);
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Job RPC ${name} did not return a job.`);
  return data;
}

export class StorageManager {
  public static isValidJobId(jobId: string): boolean {
    return typeof jobId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(jobId);
  }

  private static assertValidJobId(jobId: string): void {
    if (!this.isValidJobId(jobId)) {
      throw new Error('Invalid job ID');
    }
  }

  public static getPublicJobDir(jobId: string): string {
    this.assertValidJobId(jobId);
    const dir = path.join(process.cwd(), process.env.DATA_DIR || 'data', 'generated', jobId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getJobImagesDir(jobId: string): string {
    const dir = path.join(this.getPublicJobDir(jobId), 'images');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getJobAudioDir(jobId: string): string {
    const dir = path.join(this.getPublicJobDir(jobId), 'audio');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getLocalMediaUrl(jobId: string, relativePath: string): string {
    this.assertValidJobId(jobId);
    const safeParts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
    if (!safeParts.length || safeParts.some(part => !/^[A-Za-z0-9_.-]+$/.test(part) || part === '..')) {
      throw new Error('Invalid media path');
    }
    return `/api/jobs/${encodeURIComponent(jobId)}/media/${safeParts.map(encodeURIComponent).join('/')}`;
  }

  private static normalizeLocalUrl(jobId: string, value: string | undefined): string | undefined {
    if (!value) return value;
    const prefix = `/generated/${jobId}/`;
    return value.startsWith(prefix) ? this.getLocalMediaUrl(jobId, value.slice(prefix.length)) : value;
  }

  private static normalizeLegacyPath(jobId: string, value: string | undefined): string | undefined {
    if (!value) return value;
    const oldRoot = path.join(process.cwd(), 'public', 'generated', jobId);
    if (!path.resolve(value).startsWith(path.resolve(oldRoot) + path.sep)) return value;
    return path.join(this.getPublicJobDir(jobId), path.relative(oldRoot, value));
  }

  private static normalizeJobMedia(job: DocumentaryJob): DocumentaryJob {
    job.videoUrl = this.normalizeLocalUrl(job.id, job.videoUrl);
    job.thumbnailUrl = this.normalizeLocalUrl(job.id, job.thumbnailUrl);
    if (Array.isArray(job.thumbnailOptions)) {
      job.thumbnailOptions = job.thumbnailOptions.map(u => this.normalizeLocalUrl(job.id, u) || u);
    }
    job.subtitlesUrl = this.normalizeLocalUrl(job.id, job.subtitlesUrl);
    job.musicUrl = this.normalizeLocalUrl(job.id, job.musicUrl);
    job.videoPath = this.normalizeLegacyPath(job.id, job.videoPath);
    job.thumbnailPath = this.normalizeLegacyPath(job.id, job.thumbnailPath);
    job.subtitlesPath = this.normalizeLegacyPath(job.id, job.subtitlesPath);
    job.musicPath = this.normalizeLegacyPath(job.id, job.musicPath);
    for (const scene of job.scenes || []) {
      scene.imagePath = this.normalizeLocalUrl(job.id, scene.imagePath);
      scene.audioPath = this.normalizeLocalUrl(job.id, scene.audioPath);
    }
    return job;
  }

  public static async saveJob(job: DocumentaryJob): Promise<void> {
    this.assertValidJobId(job.id);
    if (!job.userId) throw new Error(`Job ${job.id} has no owner.`);
    job.updatedAt = new Date().toISOString();
    try {
      const stored = await jobRpc('save_documentary_job_v1', {
        p_job_id: job.id,
        p_user_id: job.userId,
        p_status: job.status,
        p_data: job as unknown as Json,
        p_created_at: job.createdAt,
        p_billing_enabled: job.billing?.enabled === true,
      });
      Object.assign(job, stored);
    } catch (rpcErr: unknown) {
      const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        const { error } = await getServiceSupabase().from('documentary_jobs').upsert({
          id: job.id,
          user_id: job.userId,
          status: job.status,
          data: job as unknown as Json,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        });
        if (error) throw new Error(`Failed to save job ${job.id}: ${error.message}`);
      } else {
        throw rpcErr;
      }
    }
  }

  public static async requestCancellation(job: DocumentaryJob): Promise<DocumentaryJob> {
    this.assertValidJobId(job.id);
    try {
      const stored = await jobRpc('cancel_documentary_job_v1', { p_job_id: job.id });
      Object.assign(job, stored);
      return this.normalizeJobMedia(job);
    } catch (rpcErr: unknown) {
      const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        job.status = 'cancelled';
        job.cancelRequestedAt = new Date().toISOString();
        await getServiceSupabase().from('documentary_jobs').update({
          status: 'cancelled',
          data: job as unknown as Json,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id);
        return this.normalizeJobMedia(job);
      }
      throw rpcErr;
    }
  }

  public static async resumeJob(job: DocumentaryJob): Promise<void> {
    this.assertValidJobId(job.id);
    if (!job.userId) throw new Error(`Job ${job.id} has no owner.`);
    job.updatedAt = new Date().toISOString();
    job.cancelRequestedAt = undefined;
    try {
      const stored = await jobRpc('resume_documentary_job_v1', {
        p_job_id: job.id,
        p_user_id: job.userId,
        p_status: job.status,
        p_data: job as unknown as Json,
      });
      Object.assign(job, stored);
    } catch (rpcErr: unknown) {
      const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      if (msg.includes('schema cache') || msg.includes('PGRST202') || msg.includes('not find the function')) {
        await getServiceSupabase().from('documentary_jobs').update({
          status: job.status,
          data: job as unknown as Json,
          updated_at: job.updatedAt,
        }).eq('id', job.id);
      } else {
        throw rpcErr;
      }
    }
  }

  public static async isCancellationRequested(jobId: string): Promise<boolean> {
    const latest = await this.loadJob(jobId);
    return latest?.status === 'cancelled' || Boolean(latest?.cancelRequestedAt);
  }

  public static async loadJob(jobId: string): Promise<DocumentaryJob | null> {
    this.assertValidJobId(jobId);
    const { data, error } = await getServiceSupabase().from('documentary_jobs').select('data').eq('id', jobId).maybeSingle();
    if (error) throw new Error(`Failed to load job ${jobId}: ${error.message}`);
    const job = data?.data as unknown as DocumentaryJob || null;
    if (job?.billing?.enabled) {
      const { DbManager } = await import('./db');
      const billing = await DbManager.getJobBilling(job.id);
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
    }
    return job ? this.normalizeJobMedia(job) : null;
  }

  public static async listJobs(): Promise<DocumentaryJob[]> {
    const { data, error } = await getServiceSupabase().from('documentary_jobs').select('data').order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list jobs: ${error.message}`);
    return (data || []).map(row => this.normalizeJobMedia(row.data as unknown as DocumentaryJob));
  }

  public static async deleteJob(jobId: string): Promise<boolean> {
    this.assertValidJobId(jobId);
    const { error } = await getServiceSupabase().from('documentary_jobs').delete().eq('id', jobId);
    if (error) throw new Error(`Failed to delete job ${jobId}: ${error.message}`);

    const jobDir = path.join(process.cwd(), process.env.DATA_DIR || 'data', 'generated', jobId);
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }

    if (R2Storage.isConfigured()) {
      await R2Storage.deleteJobFiles(jobId).catch(err => {
        console.warn(`[StorageManager] Failed to clean up R2 objects for ${jobId}:`, err);
      });
    }

    return true;
  }

  public static hasSceneImageArtifact(jobId: string, sceneNumber: number): boolean {
    const baseName = `scene_${sceneNumber.toString().padStart(2, '0')}`;
    return ['png', 'jpg', 'webp'].some(extension => {
      const filePath = path.join(this.getJobImagesDir(jobId), `${baseName}.${extension}`);
      return fs.existsSync(filePath) && fs.statSync(filePath).size > 1000;
    });
  }

  public static hasSceneAudioArtifact(jobId: string, sceneNumber: number): boolean {
    const filePath = path.join(this.getJobAudioDir(jobId), `scene_${sceneNumber.toString().padStart(2, '0')}.mp3`);
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 1000;
  }

  public static getRenderedSceneNumbers(jobId: string): number[] {
    const tempDir = path.join(this.getPublicJobDir(jobId), 'temp_render');
    if (!fs.existsSync(tempDir)) return [];
    return fs.readdirSync(tempDir).flatMap(filename => {
      const match = /^clip_(\d+)\.mp4$/i.exec(filename);
      if (!match) return [];
      const filePath = path.join(tempDir, filename);
      return fs.statSync(filePath).size > 1000 ? [Number(match[1])] : [];
    });
  }

  public static saveImageFile(jobId: string, sceneNumber: number, buffer: Buffer): string {
    const imagesDir = this.getJobImagesDir(jobId);
    let extension = 'png';
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) extension = 'jpg';
    if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') extension = 'webp';
    const baseName = `scene_${sceneNumber.toString().padStart(2, '0')}`;
    for (const existingExtension of ['png', 'jpg', 'webp']) {
      const existingPath = path.join(imagesDir, `${baseName}.${existingExtension}`);
      if (fs.existsSync(existingPath)) fs.unlinkSync(existingPath);
    }
    const filename = `${baseName}.${extension}`;
    const fullPath = path.join(imagesDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return this.getLocalMediaUrl(jobId, `images/${filename}`);
  }

  public static saveAudioFile(jobId: string, sceneNumber: number, buffer: Buffer): string {
    const audioDir = this.getJobAudioDir(jobId);
    const filename = `scene_${sceneNumber.toString().padStart(2, '0')}.mp3`;
    const fullPath = path.join(audioDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return this.getLocalMediaUrl(jobId, `audio/${filename}`);
  }

  public static saveSubtitlesFile(jobId: string, srtContent: string): { relativeUrl: string; fullPath: string } {
    const jobDir = this.getPublicJobDir(jobId);
    const filename = `subtitles.srt`;
    const fullPath = path.join(jobDir, filename);
    fs.writeFileSync(fullPath, srtContent, 'utf-8');
    return {
      relativeUrl: this.getLocalMediaUrl(jobId, filename),
      fullPath,
    };
  }
}
