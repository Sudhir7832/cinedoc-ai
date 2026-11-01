import fs from 'fs';
import path from 'path';
import { DocumentaryJob } from './types';
import { getServiceSupabase } from './supabase/server';
import type { Json } from './supabase/database.types';

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
    const dir = path.join(process.cwd(), 'public', 'generated', jobId);
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

  public static async saveJob(job: DocumentaryJob): Promise<void> {
    this.assertValidJobId(job.id);
    job.updatedAt = new Date().toISOString();
    const { error } = await getServiceSupabase().from('documentary_jobs').upsert({
      id: job.id,
      user_id: job.userId,
      status: job.status,
      data: job as unknown as Json,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    });
    if (error) throw new Error(`Failed to persist job ${job.id}: ${error.message}`);
  }

  public static async loadJob(jobId: string): Promise<DocumentaryJob | null> {
    this.assertValidJobId(jobId);
    const { data, error } = await getServiceSupabase().from('documentary_jobs').select('data').eq('id', jobId).maybeSingle();
    if (error) throw new Error(`Failed to load job ${jobId}: ${error.message}`);
    return data?.data as unknown as DocumentaryJob || null;
  }

  public static async listJobs(): Promise<DocumentaryJob[]> {
    const { data, error } = await getServiceSupabase().from('documentary_jobs').select('data').order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list jobs: ${error.message}`);
    return (data || []).map(row => row.data as unknown as DocumentaryJob);
  }

  public static async deleteJob(jobId: string): Promise<boolean> {
    this.assertValidJobId(jobId);
    const { error } = await getServiceSupabase().from('documentary_jobs').delete().eq('id', jobId);
    if (error) throw new Error(`Failed to delete job ${jobId}: ${error.message}`);

    const publicDir = path.join(process.cwd(), 'public', 'generated', jobId);
    if (fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true });
    }

    return true;
  }

  public static saveImageFile(jobId: string, sceneNumber: number, buffer: Buffer): string {
    const imagesDir = this.getJobImagesDir(jobId);
    const filename = `scene_${sceneNumber.toString().padStart(2, '0')}.png`;
    const fullPath = path.join(imagesDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return `/generated/${jobId}/images/${filename}`;
  }

  public static saveAudioFile(jobId: string, sceneNumber: number, buffer: Buffer): string {
    const audioDir = this.getJobAudioDir(jobId);
    const filename = `scene_${sceneNumber.toString().padStart(2, '0')}.mp3`;
    const fullPath = path.join(audioDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return `/generated/${jobId}/audio/${filename}`;
  }

  public static saveSubtitlesFile(jobId: string, srtContent: string): { relativeUrl: string; fullPath: string } {
    const jobDir = this.getPublicJobDir(jobId);
    const filename = `subtitles.srt`;
    const fullPath = path.join(jobDir, filename);
    fs.writeFileSync(fullPath, srtContent, 'utf-8');
    return {
      relativeUrl: `/generated/${jobId}/${filename}`,
      fullPath,
    };
  }
}
