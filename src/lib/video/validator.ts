import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export interface SystemCheckResult {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  version?: string;
  error?: string;
}

export class VideoValidator {
  public static async checkSystemRequirements(): Promise<SystemCheckResult> {
    try {
      const { stdout: ffmpegOut } = await execAsync('ffmpeg -version');
      await execAsync('ffprobe -version');
      const firstLine = ffmpegOut.split('\n')[0];

      return {
        ffmpegAvailable: true,
        ffprobeAvailable: true,
        version: firstLine,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown FFmpeg error';
      return {
        ffmpegAvailable: false,
        ffprobeAvailable: false,
        error: `FFmpeg is missing or not reachable on the server PATH: ${message}`,
      };
    }
  }

  public static async validateRenderedVideo(
    filePath: string,
    expected?: { width: number; height: number }
  ): Promise<{ valid: boolean; durationSeconds?: number; sizeBytes?: number; width?: number; height?: number; error?: string }> {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: `Output video file does not exist at ${filePath}` };
    }

    const stat = fs.statSync(filePath);
    if (stat.size < 10000) {
      return { valid: false, error: `Output video file is suspiciously small (${stat.size} bytes).` };
    }

    try {
      const { stdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of json "${filePath}"`);
      const probe = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
      const width = Number(probe.streams?.[0]?.width || 0);
      const height = Number(probe.streams?.[0]?.height || 0);
      const durationSeconds = Number(probe.format?.duration || 0);

      if (isNaN(durationSeconds) || durationSeconds <= 0) {
        return { valid: false, error: 'Could not detect valid video stream duration.' };
      }
      if (expected && (width !== expected.width || height !== expected.height)) {
        return { valid: false, error: `Expected ${expected.width}x${expected.height}, received ${width}x${height}.` };
      }

      return {
        valid: true,
        durationSeconds,
        sizeBytes: stat.size,
        width,
        height,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown validation error';
      return {
        valid: false,
        error: `Validation probe failed: ${message}`,
      };
    }
  }
}
