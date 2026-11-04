import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

let s3ClientInstance: S3Client | null = null;

export class R2Storage {
  public static isConfigured(): boolean {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    return Boolean(accessKeyId && secretAccessKey && bucket);
  }

  public static getClient(): S3Client {
    if (!s3ClientInstance) {
      const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined);

      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

      if (!accessKeyId || !secretAccessKey || !endpoint) {
        throw new Error('Cloudflare R2 is not fully configured in environment variables.');
      }

      s3ClientInstance = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
    return s3ClientInstance;
  }

  public static getBucketName(): string {
    return process.env.R2_BUCKET_NAME || 'cinedoc-videos';
  }

  public static getPublicUrl(key: string): string {
    return `/api/media/${key.replace(/^\/+/, '')}`;
  }

  public static async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<{ key: string; url: string }> {
    const client = this.getClient();
    await client.send(new PutObjectCommand({ Bucket: this.getBucketName(), Key: key, Body: buffer, ContentType: contentType }));
    return { key, url: this.getPublicUrl(key) };
  }

  public static async uploadFile(
    localFilePath: string,
    key: string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ key: string; url: string }> {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found for R2 upload: ${localFilePath}`);
    }

    const client = this.getClient();
    const bucket = this.getBucketName();
    const fileBuffer = fs.readFileSync(localFilePath);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );

    const url = this.getPublicUrl(key);
    return { key, url };
  }

  public static async uploadJobVideo(
    jobId: string,
    localMp4Path: string,
    thumbnailPath?: string,
    mediaToken?: string
  ): Promise<{ videoUrl: string; srtUrl?: string; thumbnailUrl?: string }> {
    if (!this.isConfigured()) {
      throw new Error('Cloudflare R2 is not configured.');
    }

    const prefix = mediaToken ? `jobs/${jobId}/${mediaToken}` : `jobs/${jobId}`;
    const videoKey = `${prefix}/documentary.mp4`;
    const { url: videoUrl } = await this.uploadFile(localMp4Path, videoKey, 'video/mp4');

    let srtUrl: string | undefined;
    const localSrtPath = path.join(path.dirname(localMp4Path), 'subtitles.srt');
    if (fs.existsSync(localSrtPath)) {
      const srtKey = `${prefix}/subtitles.srt`;
      const res = await this.uploadFile(localSrtPath, srtKey, 'text/plain; charset=utf-8');
      srtUrl = res.url;
    }

    let thumbnailUrl: string | undefined;
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      const result = await this.uploadFile(thumbnailPath, `${prefix}/thumbnail.jpg`, 'image/jpeg');
      thumbnailUrl = result.url;
    }

    return { videoUrl, srtUrl, thumbnailUrl };
  }

  public static async deleteJobFiles(jobId: string): Promise<void> {
    if (!this.isConfigured()) return;
    await this.deletePrefix(`jobs/${jobId}/`);
  }

  public static async deletePrefix(prefix: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const client = this.getClient();
      const bucket = this.getBucketName();
      const listRes = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
        })
      );

      if (listRes.Contents && listRes.Contents.length > 0) {
        for (const item of listRes.Contents) {
          if (item.Key) {
            await client.send(
              new DeleteObjectCommand({
                Bucket: bucket,
                Key: item.Key,
              })
            );
          }
        }
      }
    } catch (err) {
      console.warn(`[R2Storage] Cleanup failed for prefix ${prefix}:`, err);
    }
  }

  public static async getFileStream(key: string, range?: string) {
    const client = this.getClient();
    const bucket = this.getBucketName();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: range,
    });
    return await client.send(command);
  }
}
