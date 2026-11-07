import path from 'path';
import fs from 'fs';
import { runFfmpeg } from '../security/process';
import { DocumentaryJob } from '../types';
import { StorageManager } from '../storage';
import { R2Storage } from '../storage/r2';

/**
 * YouTube Thumbnail Generator
 * Generates two high-CTR, YouTube-optimized 16:9 thumbnails (1280x720):
 * - Option 1: Catchy Hook (Opening Hero) - High saturation, vivid color pop, sharp edge clarity, subtle vignette.
 * - Option 2: Climax & Mystery (Peak Drama) - High dynamic range contrast, deep chiaroscuro, intense curiosity gap.
 */
export class YouTubeThumbnailGenerator {
  private static findSceneImageFile(imagesDir: string, sceneNumber: number): string | null {
    const baseName = `scene_${sceneNumber.toString().padStart(2, '0')}`;
    const candidates = [`${baseName}.jpg`, `${baseName}.png`, `${baseName}.webp`, `${baseName}.jpeg`];
    for (const cand of candidates) {
      const fullPath = path.join(imagesDir, cand);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 1000) {
        return fullPath;
      }
    }
    return null;
  }

  public static async generateThumbnails(
    job: DocumentaryJob,
    options?: {
      cleanVideoPath?: string;
      finalMp4Path?: string;
      durationSeconds?: number;
    }
  ): Promise<{
    thumbnailPath: string;
    thumbnailUrl: string;
    thumbnailOptions: string[];
  }> {
    const jobDir = StorageManager.getPublicJobDir(job.id);
    const imagesDir = StorageManager.getJobImagesDir(job.id);

    const thumbnailPath = path.join(jobDir, 'thumbnail.jpg');
    const thumbnailPath1 = path.join(jobDir, 'thumbnail_1.jpg');
    const thumbnailPath2 = path.join(jobDir, 'thumbnail_2.jpg');

    const isVertical = job.aspectRatio === '9:16';
    const totalScenes = job.scenes?.length || 1;

    // Option 1 Source: Scene 1 (Hook / Opening Hero)
    const scene1Image = this.findSceneImageFile(imagesDir, 1);

    // Option 2 Source: Midpoint / Climax Scene (Dramatic Story Peak)
    const climaxSceneNum = Math.min(totalScenes, Math.max(2, Math.round(totalScenes * 0.55)));
    let scene2Image = this.findSceneImageFile(imagesDir, climaxSceneNum);
    if (!scene2Image && totalScenes > 1) {
      scene2Image = this.findSceneImageFile(imagesDir, 2) || this.findSceneImageFile(imagesDir, totalScenes);
    }

    // Video fallbacks (prefer un-subtitled video if available)
    const videoSource = (options?.cleanVideoPath && fs.existsSync(options.cleanVideoPath))
      ? options.cleanVideoPath
      : (options?.finalMp4Path && fs.existsSync(options.finalMp4Path))
        ? options.finalMp4Path
        : (job.videoPath && fs.existsSync(job.videoPath))
          ? job.videoPath
          : path.join(jobDir, 'documentary.mp4');

    const duration = Math.max(4, options?.durationSeconds || job.finalDurationSeconds || totalScenes * 6 || 10);
    const seek1 = Math.max(0.5, Math.min(2.5, duration * 0.12));
    const seek2 = Math.max(seek1 + 2.0, Math.min(duration - 0.8, duration * 0.55));

    // YouTube 16:9 framing:
    // If source is vertical (9:16), focus on upper-center (y = 28%) where faces & focal action reside.
    // If source is horizontal (16:9), scale and center crop cleanly to 1280x720.
    const cropClause = isVertical
      ? 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720:(in_w-1280)/2:(in_h-720)*0.28'
      : 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720';

    // Catchy YouTube Color Science Filter Chains
    // Option 1 (Catchy Hook): Boosted vibrancy, high contrast pop, crisp sharpness, soft vignette
    const filterOption1 = `${cropClause},eq=contrast=1.18:brightness=0.02:saturation=1.28,unsharp=5:5:1.20:5:5:0.0,vignette=PI/4.5`;

    // Option 2 (Climax & Mystery): Ultra-dramatic HDR contrast, deep blacks, high saturation, sharp edge clarity, deep chiaroscuro vignette
    const filterOption2 = `${cropClause},eq=contrast=1.25:brightness=0.01:saturation=1.38,unsharp=5:5:1.40:5:5:0.0,vignette=PI/3.8`;

    let generatedThumb1 = false;
    let generatedThumb2 = false;

    // --- Render Option 1 (Catchy Hook) ---
    try {
      if (scene1Image && fs.existsSync(scene1Image)) {
        await runFfmpeg([
          '-y', '-i', scene1Image,
          '-frames:v', '1', '-update', '1',
          '-vf', filterOption1,
          '-q:v', '2',
          thumbnailPath1,
        ]);
        generatedThumb1 = true;
      } else if (fs.existsSync(videoSource)) {
        await runFfmpeg([
          '-y', '-ss', seek1.toFixed(2), '-i', videoSource,
          '-frames:v', '1', '-update', '1',
          '-vf', filterOption1,
          '-q:v', '2',
          thumbnailPath1,
        ]);
        generatedThumb1 = true;
      }
    } catch (err1) {
      console.warn('[YouTubeThumbnail] Option 1 generation failed, falling back:', err1);
    }

    // --- Render Option 2 (Climax & Mystery) ---
    try {
      if (scene2Image && fs.existsSync(scene2Image)) {
        await runFfmpeg([
          '-y', '-i', scene2Image,
          '-frames:v', '1', '-update', '1',
          '-vf', filterOption2,
          '-q:v', '2',
          thumbnailPath2,
        ]);
        generatedThumb2 = true;
      } else if (fs.existsSync(videoSource)) {
        await runFfmpeg([
          '-y', '-ss', seek2.toFixed(2), '-i', videoSource,
          '-frames:v', '1', '-update', '1',
          '-vf', filterOption2,
          '-q:v', '2',
          thumbnailPath2,
        ]);
        generatedThumb2 = true;
      }
    } catch (err2) {
      console.warn('[YouTubeThumbnail] Option 2 generation failed, falling back:', err2);
    }

    // If one succeeded and the other failed, clone to ensure both exist
    if (generatedThumb1 && !generatedThumb2 && fs.existsSync(thumbnailPath1)) {
      try {
        fs.copyFileSync(thumbnailPath1, thumbnailPath2);
        generatedThumb2 = true;
      } catch {}
    } else if (generatedThumb2 && !generatedThumb1 && fs.existsSync(thumbnailPath2)) {
      try {
        fs.copyFileSync(thumbnailPath2, thumbnailPath1);
        generatedThumb1 = true;
      } catch {}
    }

    // Fallback: If both failed, try scene images directly or copy video frame
    if (!generatedThumb1 && !generatedThumb2) {
      try {
        const fallbackSrc = scene1Image || (job.scenes && job.scenes[0]?.imagePath);
        if (fallbackSrc && fs.existsSync(fallbackSrc)) {
          fs.copyFileSync(fallbackSrc, thumbnailPath1);
          fs.copyFileSync(fallbackSrc, thumbnailPath2);
        }
      } catch {}
    }

    // Set default active thumbnail (Option 1)
    if (fs.existsSync(thumbnailPath1)) {
      try {
        fs.copyFileSync(thumbnailPath1, thumbnailPath);
        job.thumbnailPath = thumbnailPath;
      } catch {}
    }

    const localThumb1 = StorageManager.getLocalMediaUrl(job.id, 'thumbnail_1.jpg');
    const localThumb2 = StorageManager.getLocalMediaUrl(job.id, 'thumbnail_2.jpg');
    let thumbnailOptions = [localThumb1, localThumb2];
    let thumbnailUrl = localThumb1;

    // If Cloudflare R2 is configured, upload both YouTube thumbnails to R2
    if (R2Storage.isConfigured()) {
      try {
        const prefix = job.mediaToken ? `jobs/${job.id}/${job.mediaToken}` : `jobs/${job.id}`;
        const uploadedOptions: string[] = [];

        if (fs.existsSync(thumbnailPath)) {
          const res = await R2Storage.uploadFile(thumbnailPath, `${prefix}/thumbnail.jpg`, 'image/jpeg');
          thumbnailUrl = res.url;
        }
        if (fs.existsSync(thumbnailPath1)) {
          const res1 = await R2Storage.uploadFile(thumbnailPath1, `${prefix}/thumbnail_1.jpg`, 'image/jpeg');
          uploadedOptions.push(res1.url);
        }
        if (fs.existsSync(thumbnailPath2)) {
          const res2 = await R2Storage.uploadFile(thumbnailPath2, `${prefix}/thumbnail_2.jpg`, 'image/jpeg');
          uploadedOptions.push(res2.url);
        }

        if (uploadedOptions.length > 0) {
          thumbnailOptions = uploadedOptions;
        }
      } catch (r2Err) {
        console.warn('[YouTubeThumbnail] R2 thumbnail upload failed, keeping local media URLs:', r2Err);
      }
    }

    job.thumbnailPath = thumbnailPath;
    job.thumbnailUrl = thumbnailUrl;
    job.thumbnailOptions = thumbnailOptions;

    return {
      thumbnailPath,
      thumbnailUrl,
      thumbnailOptions,
    };
  }
}

