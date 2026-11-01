import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

async function run() {
  const key = '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';
  const model = 'fish-audio/s2.1-pro-free:free';
  const hindiText = 'नमस्ते और स्वागत है। आज हम इतिहास के सबसे बड़े रहस्यों में से एक, बरमूडा त्रिकोण की पड़ताल करेंगे, जहाँ दर्जनों जहाज़ और विमान बिना किसी निशान के गायब हो गए।';

  console.log('--- Generating Hindi TTS using OpenRouter ---');
  console.log('Model:', model);
  console.log('Hindi Text:', hindiText);

  const startTime = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: hindiText,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter returned status ${response.status}: ${errText}`);
  }

  const rawBuffer = Buffer.from(await response.arrayBuffer());
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Received ${rawBuffer.length} raw audio bytes from OpenRouter in ${elapsed}s.`);

  // Transcode PCM to high-quality MP3 using FFmpeg
  const outputMp3 = path.join(process.cwd(), 'public', 'hindi_test_narration.mp3');

  await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-f', 's16le',
      '-ar', '44100',
      '-ac', '1',
      '-i', 'pipe:0',
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      outputMp3,
    ]);

    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    ff.on('error', reject);

    ff.stdin.write(rawBuffer);
    ff.stdin.end();
  });

  const { stdout: probeOut } = await execAsync(`ffprobe -v error -show_entries format=duration,bit_rate -of default=noprint_wrappers=1:nokey=1 "${outputMp3}"`);
  const lines = probeOut.trim().split('\n');
  const duration = parseFloat(lines[0]);
  const stat = fs.statSync(outputMp3);

  console.log('\nSUCCESS! Hindi TTS Audio Generated Successfully:');
  console.log('- Output File:', outputMp3);
  console.log('- Web URL:', 'http://localhost:3000/hindi_test_narration.mp3');
  console.log('- Duration:', duration.toFixed(2), 'seconds');
  console.log('- File Size:', (stat.size / 1024).toFixed(1), 'KB');
  console.log('- Sample Rate: 44,100 Hz (Mono MP3)');
}

run().catch((err) => {
  console.error('Error generating Hindi TTS:', err);
  process.exit(1);
});
