import { DocumentaryJob } from '../types';
import { StorageManager } from '../storage';

function formatSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);

  const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

export class SubtitleGenerator {
  public static async generateSrt(job: DocumentaryJob): Promise<{ srtContent: string; relativeUrl: string; fullPath: string }> {
    let currentTime = 0;
    const srtBlocks: string[] = [];

    job.scenes.forEach((scene, index) => {
      // Use actual audio duration if available, otherwise approxDurationSeconds (default 6s)
      const duration = scene.audioDurationSeconds && scene.audioDurationSeconds > 0
        ? scene.audioDurationSeconds
        : (scene.approxDurationSeconds || 6);

      const startTime = currentTime;
      const endTime = currentTime + Math.max(duration - 0.2, 1.0); // leave a slight 200ms gap before next scene
      currentTime += duration;

      const text = (scene.subtitleText || scene.narration).trim();
      
      // Wrap lines if subtitle is too long (over 45 characters per line)
      const formattedText = text.length > 50
        ? text.replace(/(.{1,45})(?:\s+|$)/g, '$1\n').trim()
        : text;

      srtBlocks.push(
        `${index + 1}\n${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n${formattedText}\n`
      );
    });

    const srtContent = srtBlocks.join('\n');
    const { relativeUrl, fullPath } = StorageManager.saveSubtitlesFile(job.id, srtContent);

    job.subtitlesUrl = relativeUrl;
    job.subtitlesPath = fullPath;
    job.progress.percent = 75;
    job.progress.stepLabel = 'Subtitles generated successfully.';
    await StorageManager.saveJob(job);

    return { srtContent, relativeUrl, fullPath };
  }
}
