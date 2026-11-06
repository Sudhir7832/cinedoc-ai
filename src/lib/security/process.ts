import { spawn } from 'node:child_process';

interface ProcessOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export function runFfmpeg(args: readonly string[], options: ProcessOptions = {}): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;

  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let outputBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('FFmpeg execution timed out.'));
    }, timeoutMs);
    timer.unref();

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };

    child.stderr.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        child.kill();
        finish(new Error('FFmpeg produced excessive output.'));
      }
    });
    child.once('error', () => finish(new Error('FFmpeg could not be started.')));
    child.once('close', code => finish(code === 0 ? undefined : new Error('FFmpeg execution failed.')));
  });
}
