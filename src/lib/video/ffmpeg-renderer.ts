import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DocumentaryJob } from '../types';
import { StorageManager } from '../storage';
import { VideoValidator } from './validator';
import { R2Storage } from '../storage/r2';
import { CloudflareClient } from '../cloudflare/client';

const execAsync = promisify(exec);

export class FFmpegRenderer {
  public static async renderJobVideo(
    job: DocumentaryJob,
    onProgressUpdate?: (job: DocumentaryJob) => void | Promise<void>,
    shouldCancel?: () => boolean
  ): Promise<DocumentaryJob> {
    const sysCheck = await VideoValidator.checkSystemRequirements();
    if (!sysCheck.ffmpegAvailable) {
      throw new Error(`FFmpeg is not available on this server: ${sysCheck.error}`);
    }

    const jobDir = StorageManager.getPublicJobDir(job.id);
    const tempDir = path.join(jobDir, 'temp_render');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const generatedClipsDir = path.join(jobDir, 'generated_clips');
    if (!fs.existsSync(generatedClipsDir)) fs.mkdirSync(generatedClipsDir, { recursive: true });

    const totalScenes = job.scenes.length;
    const clipPaths: string[] = [];
    const isVertical = job.aspectRatio === '9:16';
    const outputWidth = isVertical ? 1080 : 1920;
    const outputHeight = isVertical ? 1920 : 1080;
    const renderWidth = outputWidth * 2;
    const renderHeight = outputHeight * 2;
    const isRhymeVideo = job.contentStyle === 'kids' && job.kidsFormat === 'rhyme';
    let h3Available = isRhymeVideo;

    // Step A: Render animated Ken Burns video clips for each scene
    for (let i = 0; i < totalScenes; i++) {
      if (shouldCancel?.()) throw new Error('PIPELINE_CANCELLED');
      const scene = job.scenes[i];
      const sceneNum = scene.sceneNumber;
      const expectedBaseName = `scene_${sceneNum.toString().padStart(2, '0')}`;
      const requestedFilename = path.basename((scene.imagePath || '').split('?')[0]);
      const allowedRequestedFile = new RegExp(`^${expectedBaseName}\\.(png|jpg|webp)$`, 'i').test(requestedFilename)
        ? requestedFilename
        : '';
      const fallbackFilename = ['png', 'jpg', 'webp'].map(extension => `${expectedBaseName}.${extension}`)
        .find(filename => fs.existsSync(path.join(jobDir, 'images', filename)));
      const imageFilename = allowedRequestedFile || fallbackFilename || `${expectedBaseName}.png`;
      const fullImagePath = path.join(jobDir, 'images', imageFilename);

      if (!fs.existsSync(fullImagePath)) {
        throw new Error(`Scene ${sceneNum} image is missing at ${fullImagePath}`);
      }

      const duration = Math.max(scene.audioDurationSeconds || scene.approxDurationSeconds || 6, 2.5);
      const fps = 30;
      const totalFrames = Math.round(duration * fps);
      const clipOutput = path.join(tempDir, `clip_${sceneNum.toString().padStart(2, '0')}.mp4`);

      job.progress.stepLabel = isRhymeVideo
        ? `Animating rhyme character dance scene ${i + 1} of ${totalScenes}...`
        : `Rendering cinematic scene animation ${i + 1} of ${totalScenes}...`;
      job.progress.percent = Math.round(75 + (i / totalScenes) * 15); // 75% to 90%
      if (onProgressUpdate) await onProgressUpdate(job);

      // Rhyme videos use rhythmic bounce/sway/pulse motion instead of documentary Ken Burns.
      let zoomFilter = '';
      const effectIndex = i % 3;
      if (isRhymeVideo && effectIndex === 0) {
        zoomFilter = `zoompan=z='1.08+0.045*sin(on*0.34)':x='iw/2-(iw/zoom/2)+18*sin(on*0.22)':y='ih/2-(ih/zoom/2)-28*abs(sin(on*0.30))':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`;
      } else if (isRhymeVideo && effectIndex === 1) {
        zoomFilter = `zoompan=z='1.10+0.025*sin(on*0.28)':x='iw/2-(iw/zoom/2)+42*sin(on*0.18)':y='ih/2-(ih/zoom/2)+12*sin(on*0.36)':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`;
      } else if (isRhymeVideo) {
        zoomFilter = `zoompan=z='1.06+0.06*abs(sin(on*0.24))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+22*sin(on*0.26)':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`;
      } else if (effectIndex === 0) {
        // Subtle Zoom in
        zoomFilter = `zoompan=z='min(zoom+0.0012,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`;
      } else if (effectIndex === 1) {
        // Subtle Zoom out
        zoomFilter = `zoompan=z='if(lte(zoom,1.0),1.18,max(1.0,zoom-0.0012))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`;
      } else {
        // Subtle Pan Left to Right
        zoomFilter = isVertical
          ? `zoompan=z='1.12':x='iw/2-(iw/zoom/2)':y='if(lte(on,1),(ih-ih/zoom)*0.2,y+(ih-ih/zoom)*0.6/${totalFrames})':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`
          : `zoompan=z='1.12':x='if(lte(on,1),(iw-iw/zoom)*0.2,x+(iw-iw/zoom)*0.6/${totalFrames})':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`;
      }

      // Smooth crossfade transitions with in/out fades
      const fadeDuration = Math.min(0.35, duration * 0.15);
      const fadeOutStart = Math.max(duration - fadeDuration, 0.1);
      const colorFilter = isRhymeVideo ? ',eq=saturation=1.18:contrast=1.04' : '';
      const videoFilter = `scale=${renderWidth}:${renderHeight}:force_original_aspect_ratio=increase,crop=${renderWidth}:${renderHeight},${zoomFilter}${colorFilter},fade=t=in:st=0:d=${fadeDuration.toFixed(2)},fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration.toFixed(2)}`;

      const renderClipCmd = `ffmpeg -y -loop 1 -i "${fullImagePath}" -t ${duration.toFixed(2)} -vf "${videoFilter}" -c:v libx264 -preset fast -pix_fmt yuv420p -r ${fps} "${clipOutput}"`;

      const sourcePath = path.join(generatedClipsDir, `h3_source_${sceneNum.toString().padStart(2, '0')}.mp4`);
      const hasReusableH3Clip = fs.existsSync(sourcePath) && fs.statSync(sourcePath).size > 1000;
      if (isRhymeVideo && (hasReusableH3Clip || h3Available)) {
        try {
          if (!hasReusableH3Clip) {
            job.progress.stepLabel = `Generating AI dance scene ${i + 1} of ${totalScenes} with MiniMax H3...`;
            if (onProgressUpdate) await onProgressUpdate(job);
            const generated = await CloudflareClient.generateVideo(
              `${scene.imagePrompt}. ${scene.title}. Cheerful child-friendly animated nursery rhyme scene, expressive character dancing in rhythm, smooth playful movement, vibrant colors, one continuous shot, no text, no captions, no watermark.`,
              {
                duration,
                ratio: job.aspectRatio,
                resolution: '480P',
              }
            );
            fs.writeFileSync(sourcePath, generated.buffer);
          }
          const generatedFilter = `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight},eq=saturation=1.12:contrast=1.03,fade=t=in:st=0:d=${fadeDuration.toFixed(2)},fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration.toFixed(2)}`;
          await execAsync(`ffmpeg -y -stream_loop -1 -i "${sourcePath}" -t ${duration.toFixed(2)} -vf "${generatedFilter}" -an -c:v libx264 -preset fast -pix_fmt yuv420p -r ${fps} "${clipOutput}"`);
          clipPaths.push(clipOutput);
          continue;
        } catch (error) {
          h3Available = false;
          console.warn('[FFmpegRenderer] MiniMax H3 unavailable; using image animation fallback:', error instanceof Error ? error.message : error);
        }
      }

      try {
        await execAsync(renderClipCmd);
        clipPaths.push(clipOutput);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown FFmpeg error';
        throw new Error(`Failed to render scene ${sceneNum} video clip: ${message}`);
      }
    }

    // Step B: Concat all video clips together
    if (shouldCancel?.()) throw new Error('PIPELINE_CANCELLED');
    job.progress.stepLabel = 'Merging scene clips and audio tracks...';
    job.progress.percent = 92;
    if (onProgressUpdate) await onProgressUpdate(job);

    const concatListPath = path.join(tempDir, 'clips_concat.txt');
    const concatEntries = clipPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(concatListPath, concatEntries, 'utf-8');

    const mergedVideoNoAudio = path.join(tempDir, 'merged_video.mp4');
    const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${mergedVideoNoAudio}"`;
    await execAsync(concatCmd);

    // Step C: Audio mixing
    // Narration master: private generated storage under [jobId]/audio/narration_master.mp3
    // Ambient Music: public/music/ambient_documentary.mp3 (if exists)
    const masterNarrationPath = path.join(jobDir, 'audio', 'narration_master.mp3');
    const bgMusicPath = job.musicPath && fs.existsSync(job.musicPath)
      ? job.musicPath
      : path.join(process.cwd(), 'public', 'music', 'ambient_documentary.mp3');
    const hasBgMusic = fs.existsSync(bgMusicPath);

    const finalMp4Path = path.join(jobDir, 'documentary.mp4');
    const subtitlesPath = path.join(jobDir, 'subtitles.srt');
    const hasSubtitles = fs.existsSync(subtitlesPath);

    // Subtitle filter formatting for Windows
    // Escape backslashes for FFmpeg filter argument
    let subtitleArg = '';

    if (hasSubtitles) {
      // Escape path for ffmpeg subtitles filter: replace \ with / and escape :
      const escapedSubPath = subtitlesPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const isHindi = job.language === 'Hindi';
      const fontName = isHindi ? 'Nirmala UI' : 'Arial';
      subtitleArg = `subtitles='${escapedSubPath}':force_style='FontName=${fontName},FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=1,MarginV=42,Alignment=2'`;
    }

    job.progress.stepLabel = `Assembling final ${outputWidth}x${outputHeight} MP4 with soundscape${hasSubtitles ? ' and subtitles' : ''}...`;
    job.progress.percent = 95;
    if (onProgressUpdate) await onProgressUpdate(job);

    let finalRenderCmd = '';
    if (hasBgMusic && fs.existsSync(masterNarrationPath)) {
      // Mix narration with background music (ducked down to 0.12 volume, looped)
      // Input 0: video, Input 1: narration, Input 2: bg music
      const vfClause = subtitleArg ? `-vf "${subtitleArg}"` : '';
      finalRenderCmd = `ffmpeg -y -i "${mergedVideoNoAudio}" -i "${masterNarrationPath}" -stream_loop -1 -i "${bgMusicPath}" ${vfClause} -filter_complex "[1:a]volume=1.0[anar]; [2:a]volume=0.12[abg]; [anar][abg]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
    } else if (fs.existsSync(masterNarrationPath)) {
      const vfClause = subtitleArg ? `-vf "${subtitleArg}"` : '';
      finalRenderCmd = `ffmpeg -y -i "${mergedVideoNoAudio}" -i "${masterNarrationPath}" ${vfClause} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
    } else {
      const vfClause = subtitleArg ? `-vf "${subtitleArg}"` : '';
      finalRenderCmd = `ffmpeg -y -i "${mergedVideoNoAudio}" ${vfClause} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "${finalMp4Path}"`;
    }

    try {
      await execAsync(finalRenderCmd);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown FFmpeg error';
      console.warn('Final render with subtitles filter encountered issue, attempting fallback without burned subtitles:', message);
      // Fallback without subtitle filter, keeping soft subtitles and separate SRT
      if (hasBgMusic && fs.existsSync(masterNarrationPath)) {
        const fallbackCmd = `ffmpeg -y -i "${mergedVideoNoAudio}" -i "${masterNarrationPath}" -stream_loop -1 -i "${bgMusicPath}" -filter_complex "[1:a]volume=1.0[anar]; [2:a]volume=0.12[abg]; [anar][abg]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
        await execAsync(fallbackCmd);
      } else if (fs.existsSync(masterNarrationPath)) {
        const fallbackCmd = `ffmpeg -y -i "${mergedVideoNoAudio}" -i "${masterNarrationPath}" -c:v copy -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
        await execAsync(fallbackCmd);
      } else {
        const fallbackCmd = `ffmpeg -y -i "${mergedVideoNoAudio}" -c:v copy "${finalMp4Path}"`;
        await execAsync(fallbackCmd);
      }
    }

    // Step D: Validate output
    const validation = await VideoValidator.validateRenderedVideo(finalMp4Path, { width: outputWidth, height: outputHeight });
    if (!validation.valid) {
      throw new Error(`Video rendering finished, but validation failed: ${validation.error}`);
    }

    const thumbnailPath = path.join(jobDir, 'thumbnail.jpg');
    const thumbnailPath1 = path.join(jobDir, 'thumbnail_1.jpg');
    const thumbnailPath2 = path.join(jobDir, 'thumbnail_2.jpg');
    const thumbnailSize = isVertical ? '720:1280' : '1280:720';

    try {
      const dur = Math.max(3, validation.durationSeconds || 10);
      const seek1 = Math.max(0.5, Math.min(2.5, dur * 0.15));
      const seek2 = Math.max(seek1 + 2.0, Math.min(dur - 0.8, dur * 0.55));

      // Option 1: Opening hook frame (16:9 YouTube format)
      await execAsync(`ffmpeg -y -ss ${seek1.toFixed(2)} -i "${finalMp4Path}" -frames:v 1 -update 1 -vf "scale=${thumbnailSize}:force_original_aspect_ratio=increase,crop=${thumbnailSize}" -q:v 2 "${thumbnailPath1}"`);
      // Option 2: Midpoint/climax frame (16:9 YouTube format)
      await execAsync(`ffmpeg -y -ss ${seek2.toFixed(2)} -i "${finalMp4Path}" -frames:v 1 -update 1 -vf "scale=${thumbnailSize}:force_original_aspect_ratio=increase,crop=${thumbnailSize}" -q:v 2 "${thumbnailPath2}"`);

      // Set default active thumbnail
      fs.copyFileSync(thumbnailPath1, thumbnailPath);
      job.thumbnailPath = thumbnailPath;

      const localThumb1 = StorageManager.getLocalMediaUrl(job.id, 'thumbnail_1.jpg');
      const localThumb2 = StorageManager.getLocalMediaUrl(job.id, 'thumbnail_2.jpg');
      job.thumbnailOptions = [localThumb1, localThumb2];
      job.thumbnailUrl = localThumb1;
    } catch (thumbnailError) {
      console.warn('[Thumbnail] YouTube thumbnails generation failed, falling back:', thumbnailError);
      try {
        if (job.scenes && job.scenes.length > 0) {
          const scene1Img = job.scenes[0].imagePath;
          const scene2Idx = Math.min(job.scenes.length - 1, Math.max(1, Math.floor(job.scenes.length / 2)));
          const scene2Img = job.scenes[scene2Idx].imagePath;
          if (scene1Img && scene2Img) {
            job.thumbnailOptions = [scene1Img, scene2Img];
            job.thumbnailUrl = scene1Img;
          }
        }
      } catch {}
    }

    // Clean up temporary render folder
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn('Temporary render cleanup warning:', cleanupErr);
    }

    if (R2Storage.isConfigured()) {
      try {
        job.progress.stepLabel = 'Uploading video and YouTube thumbnails to Cloudflare R2 storage...';
        if (onProgressUpdate) await onProgressUpdate(job);
        const { videoUrl, srtUrl, thumbnailUrl, thumbnailOptions } = await R2Storage.uploadJobVideo(job.id, finalMp4Path, job.thumbnailPath, job.mediaToken);
        job.videoUrl = videoUrl;
        if (srtUrl) job.subtitlesUrl = srtUrl;
        if (thumbnailUrl) job.thumbnailUrl = thumbnailUrl;
        if (thumbnailOptions && thumbnailOptions.length > 0) job.thumbnailOptions = thumbnailOptions;
      } catch (r2Err) {
        console.error('[R2Storage] Upload error, falling back to local URL:', r2Err);
        job.videoUrl = StorageManager.getLocalMediaUrl(job.id, 'documentary.mp4');
      }
    } else {
      job.videoUrl = StorageManager.getLocalMediaUrl(job.id, 'documentary.mp4');
    }
    job.videoPath = finalMp4Path;
    job.finalDurationSeconds = Math.round(validation.durationSeconds || 0);
    job.fileSizeBytes = validation.sizeBytes;
    job.progress.percent = 98;
    job.progress.stepLabel = 'Render validated. Finalizing production and credits...';
    await StorageManager.saveJob(job);
    if (onProgressUpdate) await onProgressUpdate(job);

    return job;
  }
}
