import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TestimonialFormat, TestimonialVideo } from './types';
import { getServiceSupabase } from './supabase/server';

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'testimonials');

function ensureStorage() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function fromRow(row: Record<string, unknown>): TestimonialVideo {
  return { id: String(row.id), title: String(row.title), description: String(row.description || ''), videoUrl: String(row.video_url), posterUrl: row.poster_url ? String(row.poster_url) : undefined, format: row.format as TestimonialFormat, quote: row.quote ? String(row.quote) : undefined, attribution: row.attribution ? String(row.attribution) : undefined, published: Boolean(row.published), createdAt: String(row.created_at) };
}

function removeLocalAsset(url?: string) {
  if (!url?.startsWith('/testimonials/')) return;
  const filename = path.basename(url);
  const assetPath = path.join(PUBLIC_DIR, filename);
  if (fs.existsSync(assetPath)) fs.unlinkSync(assetPath);
}

export class TestimonialManager {
  public static async list(includeUnpublished = false): Promise<TestimonialVideo[]> {
    let query = getServiceSupabase().from('testimonials').select('*').order('created_at', { ascending: false });
    if (!includeUnpublished) query = query.eq('published', true);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(row => fromRow(row));
  }

  public static async create(input: {
    title: string;
    description: string;
    videoUrl: string;
    posterUrl?: string;
    format: TestimonialFormat;
    quote?: string;
    attribution?: string;
    published?: boolean;
  }): Promise<TestimonialVideo> {
    const item: TestimonialVideo = {
      ...input,
      id: `testimonial_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      published: input.published !== false,
      createdAt: new Date().toISOString(),
    };
    const { data, error } = await getServiceSupabase().from('testimonials').insert({ id: item.id, title: item.title, description: item.description, video_url: item.videoUrl, poster_url: item.posterUrl, format: item.format, quote: item.quote, attribution: item.attribution, published: item.published, created_at: item.createdAt }).select('*').single();
    if (error) throw new Error(error.message);
    return fromRow(data);
  }

  public static async delete(id: string): Promise<boolean> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return false;
    const { data, error } = await getServiceSupabase().from('testimonials').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    const item = data ? fromRow(data) : null;
    if (!item) return false;
    removeLocalAsset(item.videoUrl);
    removeLocalAsset(item.posterUrl);
    const { error: deleteError } = await getServiceSupabase().from('testimonials').delete().eq('id', id);
    if (deleteError) throw new Error(deleteError.message);
    return true;
  }

  public static saveAsset(file: File, prefix: 'video' | 'poster', buffer: Buffer): string {
    ensureStorage();
    const extensions: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const extension = extensions[file.type] || (prefix === 'video' ? '.mp4' : '.webp');
    const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${extension}`;
    fs.writeFileSync(path.join(PUBLIC_DIR, filename), buffer);
    return `/testimonials/${filename}`;
  }
}
