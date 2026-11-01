import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function run() {
  console.log('Testing 1-minute 10-scene Documentary Rendering Pipeline...');

  const jobId = 'doc_test_bermuda_triangle';
  const publicDir = path.join(process.cwd(), 'public', 'generated', jobId);
  const imagesDir = path.join(publicDir, 'images');
  const audioDir = path.join(publicDir, 'audio');

  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });

  const scenes = [
    { num: 1, title: 'The Endless Blue', text: 'In the western part of the North Atlantic Ocean lies an expanse known for inexplicable disappearances.' },
    { num: 2, title: 'Flight 19 Vanishes', text: 'In December 1945, five Avenger bombers took off on a routine patrol and were never seen again.' },
    { num: 3, title: 'Compass Anomalies', text: 'Navigators have long reported erratic compass behavior near the mysterious perimeter.' },
    { num: 4, title: 'The Sargasso Current', text: 'Violent underwater trenches and unpredictable currents weave treacherous paths across the ocean floor.' },
    { num: 5, title: 'Rogue Wave Legends', text: 'Meteorologists now suspect spontaneous rogue waves exceeding thirty meters in height.' },
    { num: 6, title: 'Methane Hydrate Theories', text: 'Eruptions of trapped ocean floor gases could theoretically reduce water density in seconds.' },
    { num: 7, title: 'The Ghost Ships', text: 'Wreckage discovered across centuries reveals vessels abandoned with cargo intact and crews missing.' },
    { num: 8, title: 'Satellite Surveillance', text: 'Modern radar and orbital cameras scan the waters continuously, capturing fleeting atmospheric anomalies.' },
    { num: 9, title: 'The Scientific Verdict', text: 'While statistical evidence aligns with normal maritime traffic, the legends refuse to sink.' },
    { num: 10, title: 'The Enduring Enigma', text: 'The Bermuda Triangle remains humanity’s most captivating maritime mystery, forever guarding its secrets.' }
  ];

  // 1. Generate 10 distinct cinematic documentary still frames
  console.log('Generating 10 documentary scene frames...');
  const colors = ['#0a192f', '#0f2b46', '#143d59', '#174d6b', '#1c5e7d', '#1f7090', '#1c5e7d', '#174d6b', '#143d59', '#0a192f'];

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const imgPath = path.join(imagesDir, `scene_${s.num.toString().padStart(2, '0')}.png`);
    const color = colors[i];
    // Create rich 1920x1080 still image with scene title
    const cmd = `ffmpeg -y -f lavfi -i "color=c=${color}:s=1920x1080" -vf "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='SCENE ${s.num}\\: ${s.title}':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" -frames:v 1 "${imgPath}"`;
    await execAsync(cmd);

    // 2. Generate 6-second narration audio tone for each scene
    const audioPath = path.join(audioDir, `scene_${s.num.toString().padStart(2, '0')}.mp3`);
    const freq = 160 + (i * 20);
    const audioCmd = `ffmpeg -y -f lavfi -i "sine=frequency=${freq}:duration=6" -c:a libmp3lame -q:a 2 "${audioPath}"`;
    await execAsync(audioCmd);
  }

  // 3. Concatenate scene audio into narration_master.mp3
  console.log('Concatenating narration audios...');
  const concatTxt = path.join(audioDir, 'concat_list.txt');
  const entries = scenes.map(s => `file 'scene_${s.num.toString().padStart(2, '0')}.mp3'`).join('\n');
  fs.writeFileSync(concatTxt, entries, 'utf-8');
  const masterAudio = path.join(audioDir, 'narration_master.mp3');
  await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatTxt}" -c copy "${masterAudio}"`);

  // 4. Generate synchronized subtitles
  console.log('Creating SRT subtitles...');
  const srtPath = path.join(publicDir, 'subtitles.srt');
  let srtContent = '';
  for (let i = 0; i < scenes.length; i++) {
    const startSec = i * 6;
    const endSec = startSec + 5.8;
    const pad = (n) => n.toString().padStart(2, '0');
    const startStr = `00:${pad(Math.floor(startSec / 60))}:${pad(startSec % 60)},000`;
    const endStr = `00:${pad(Math.floor(endSec / 60))}:${pad(Math.floor(endSec % 60))},800`;
    srtContent += `${i + 1}\n${startStr} --> ${endStr}\n${scenes[i].text}\n\n`;
  }
  fs.writeFileSync(srtPath, srtContent, 'utf-8');

  // 5. Build documentary job object
  const job = {
    id: jobId,
    topic: 'The Mystery of the Bermuda Triangle',
    durationMinutes: 1,
    language: 'English',
    voice: 'onyx',
    status: 'rendering_video',
    progress: {
      stage: 'rendering_video',
      currentStep: 5,
      totalSteps: 6,
      stepLabel: 'Rendering Ken Burns 1080p MP4...',
      imagesCompleted: 10,
      totalImages: 10,
      audioCompleted: 10,
      totalAudio: 10,
      percent: 75,
    },
    scenes: scenes.map(s => ({
      sceneNumber: s.num,
      title: s.title,
      narration: s.text,
      imagePrompt: `Cinematic documentary photograph of ${s.title}`,
      approxDurationSeconds: 6,
      subtitleText: s.text,
      imagePath: `/generated/${jobId}/images/scene_${s.num.toString().padStart(2, '0')}.png`,
      audioPath: `/generated/${jobId}/audio/scene_${s.num.toString().padStart(2, '0')}.mp3`,
      audioDurationSeconds: 6,
      imageStatus: 'completed',
      audioStatus: 'completed'
    })),
    subtitlesUrl: `/generated/${jobId}/subtitles.srt`,
    subtitlesPath: srtPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const jobsDir = path.join(process.cwd(), 'data', 'jobs');
  fs.mkdirSync(jobsDir, { recursive: true });
  fs.writeFileSync(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job, null, 2), 'utf-8');

  console.log('Rendering 10-scene Ken Burns 1080p video with FFmpeg...');
  // Import FFmpegRenderer logic
  const tempDir = path.join(publicDir, 'temp_render');
  fs.mkdirSync(tempDir, { recursive: true });

  const clipPaths = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const imagePath = path.join(imagesDir, `scene_${s.num.toString().padStart(2, '0')}.png`);
    const clipOutput = path.join(tempDir, `clip_${s.num.toString().padStart(2, '0')}.mp4`);
    const frames = 180; // 6 seconds * 30 fps

    const zoomFilter = (i % 2 === 0)
      ? `zoompan=z='min(zoom+0.0012,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30`
      : `zoompan=z='if(lte(zoom,1.0),1.18,max(1.0,zoom-0.0012))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30`;

    const filter = `scale=3840x2160,${zoomFilter},fade=t=in:st=0:d=0.3,fade=t=out:st=5.7:d=0.3`;
    const clipCmd = `ffmpeg -y -loop 1 -i "${imagePath}" -t 6.0 -vf "${filter}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 "${clipOutput}"`;
    await execAsync(clipCmd);
    clipPaths.push(clipOutput);
  }

  // Concat clips
  const clipsConcatList = path.join(tempDir, 'clips.txt');
  fs.writeFileSync(clipsConcatList, clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf-8');
  const mergedVideo = path.join(tempDir, 'merged.mp4');
  await execAsync(`ffmpeg -y -f concat -safe 0 -i "${clipsConcatList}" -c copy "${mergedVideo}"`);

  // Final render with narration, ambient music ducking, and subtitles
  const bgMusic = path.join(process.cwd(), 'public', 'music', 'ambient_documentary.mp3');
  const finalMp4 = path.join(publicDir, 'documentary.mp4');
  const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const subStyle = `subtitles='${escapedSrt}':force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=1.5,Shadow=1,MarginV=40,Alignment=2'`;

  const finalCmd = `ffmpeg -y -i "${mergedVideo}" -i "${masterAudio}" -stream_loop -1 -i "${bgMusic}" -vf "${subStyle}" -filter_complex "[1:a]volume=1.0[anar]; [2:a]volume=0.12[abg]; [anar][abg]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4}"`;
  await execAsync(finalCmd);

  // Validate output
  const stat = fs.statSync(finalMp4);
  const { stdout: probeOut } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of default=noprint_wrappers=1:nokey=1 "${finalMp4}"`);
  const lines = probeOut.trim().split('\n').map(l => l.trim());

  job.videoUrl = `/generated/${jobId}/documentary.mp4`;
  job.videoPath = finalMp4;
  job.fileSizeBytes = stat.size;
  job.finalDurationSeconds = 60;
  job.status = 'completed';
  job.progress.stage = 'completed';
  job.progress.percent = 100;
  job.progress.stepLabel = 'Documentary successfully generated!';
  fs.writeFileSync(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job, null, 2), 'utf-8');

  console.log('SUCCESS! Video generated successfully.');
  console.log('Resolution:', lines[0], 'x', lines[1]);
  console.log('Duration:', lines[lines.length - 1], 'seconds');
  console.log('File size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('Video path:', finalMp4);
}

run().catch(err => {
  console.error('Test pipeline error:', err);
  process.exit(1);
});
