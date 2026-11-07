'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Film,
  Images,
  Layers3,
  Loader2,
  Mic2,
  Play,
  Plus,
  Trash2,
  Video,
  WandSparkles,
  Languages,
  Music2,
  Youtube,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { DocumentaryJob, SafeUser } from '@/lib/types';
import { SampleShowcase } from '@/components/SampleShowcase';
import { scenePreviewUrl } from '@/lib/media-url';

interface DashboardProps {
  user?: SafeUser | null;
  jobs: DocumentaryJob[];
  isLoading: boolean;
  onNewJob: (presetTopic?: string) => void;
  onSelectJob: (jobId: string) => void;
  onPreviewVideo: (job: DocumentaryJob) => void;
  onDeleteJob: (jobId: string) => void;
  onOpenPricing: () => void;
}

const TOPICS = [
  'The hidden cities beneath the Sahara',
  'How the Rothschild family built modern finance',
  'How deep-sea creatures survive extreme pressure',
  'The AI revolution nobody saw coming',
  'प्राचीन सिंधु घाटी का अनसुलझा रहस्य',
];

const PIPELINE = [
  { label: 'Viral narrative script', detail: 'High-retention hooks & 10-scene pacing', icon: WandSparkles },
  { label: 'Cinematic visuals', detail: '10 art-directed frames per minute with motion', icon: Images },
  { label: 'Neural voice & captions', detail: 'English & Hindi speech with timed subtitles', icon: Mic2 },
  { label: '1080p master & thumbnails', detail: 'MP4 render + dual 16:9 YouTube covers', icon: Video },
];

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Dashboard({
  user,
  jobs,
  isLoading,
  onNewJob,
  onSelectJob,
  onPreviewVideo,
  onDeleteJob,
  onOpenPricing,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'studio' | 'faceless' | 'features'>('studio');
  const [promptInput, setPromptInput] = useState('');
  const [masterVideo, setMasterVideo] = useState<string>('');
  const [masterPoster, setMasterPoster] = useState<string>('');

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config?.masterOutputVideoUrl) {
          setMasterVideo(data.config.masterOutputVideoUrl);
          setMasterPoster(data.config.masterOutputPosterUrl || '');
        }
      })
      .catch(() => undefined);
  }, []);

  const completedCount = jobs.filter(job => job.status === 'completed').length;
  const inProgressCount = jobs.filter(job => !['completed', 'failed', 'cancelled'].includes(job.status)).length;
  const latestVisualJob = jobs.find(job => job.scenes?.[0]?.imagePath);
  const latestVisual = latestVisualJob
    ? latestVisualJob.thumbnailUrl || scenePreviewUrl(latestVisualJob.id, latestVisualJob.scenes[0].sceneNumber, latestVisualJob.scenes[0].imageUpdatedAt || latestVisualJob.updatedAt)
    : undefined;

  const handlePromptSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onNewJob(promptInput.trim() || undefined);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <section className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
        <div className="surface-card border-t-2 border-t-[var(--app-brand)] p-6 sm:p-9 lg:p-11">
          <div className="max-w-3xl">
            <p className="eyebrow mb-5">KinesisFlow video workspace</p>

            <h1 className="editorial-title max-w-2xl text-4xl leading-[1.02] text-primary sm:text-5xl lg:text-[3.8rem]">
              Turn One Topic Into Documentaries, Kids Videos &amp; Viral YouTube Content.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-secondary sm:text-base">
              Turn any topic or script into high-RPM faceless documentaries, YouTube Shorts, and Kids stories. KinesisFlow automates the entire pipeline: narrative script, cinematic scenes with Ken Burns motion, neural voiceover, timed subtitles, and dual high-CTR 16:9 YouTube thumbnails - ready for YouTube Studio.
            </p>

            <label htmlFor="documentary-topic" className="mt-8 block text-xs font-semibold text-primary">Topic or production brief</label>
            <form onSubmit={handlePromptSubmit} className="surface-raised mt-2 p-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex min-h-12 flex-1 items-center gap-2 px-3">
                  <WandSparkles className="h-5 w-5 shrink-0 brand-text" aria-hidden="true" />
                  <input
                    id="documentary-topic"
                    value={promptInput}
                    onChange={event => setPromptInput(event.target.value)}
                    placeholder="Enter a topic or production brief (e.g. The Secret History of Silicon Valley)"
                    className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-[var(--app-text-muted)]"
                  />
                </div>
                <button type="submit" className="btn-primary whitespace-nowrap px-5">
                  Create project
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {TOPICS.map(topic => (
                <button
                  type="button"
                  key={topic}
                  onClick={() => { setPromptInput(topic); onNewJob(topic); }}
                  className="min-h-9 border-b border-theme px-1 text-left text-[11px] font-semibold text-secondary transition-colors hover:border-[var(--app-brand)] hover:text-[var(--app-text)]"
                >
                  {topic}
                </button>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-theme pt-5 text-xs font-medium text-secondary">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" />1080p Master MP4</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" />Dual 16:9 High-CTR Thumbnails</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" />Faceless YouTube Automation</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" />Neural Voice &amp; Timed Subtitles</span>
              <span className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 text-[var(--app-accent)]" aria-hidden="true" />English, Native Hindi &amp; Multilingual</span>
            </div>
          </div>
        </div>

        <aside className="surface-raised overflow-hidden p-5 sm:p-6" aria-label="Production pipeline preview">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-primary">Four production stages</h2>
          </div>

          <div className="mt-5 border-y border-theme">
            {PIPELINE.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <div key={stage.label} className="flex items-center gap-3 border-b border-theme py-3.5 last:border-b-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center brand-text">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-primary">{stage.label}</span>
                    <span className="block truncate text-[11px] text-secondary">{stage.detail}</span>
                  </span>
                  <span className="text-[10px] font-bold text-secondary">0{index + 1}</span>
                </div>
              );
            })}
          </div>

          <div className="relative mt-5 aspect-[16/8] overflow-hidden rounded-md bg-[#171821]">
            {user && latestVisual ? (
              <Image src={latestVisual} alt="Latest documentary scene" fill sizes="(min-width: 1024px) 32vw, 100vw" unoptimized className="object-cover opacity-85" />
            ) : masterVideo ? (
              <video
                src={masterVideo}
                poster={masterPoster || undefined}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover opacity-90"
              />
            ) : latestVisual ? (
              <Image src={latestVisual} alt="Latest documentary scene" fill sizes="(min-width: 1024px) 32vw, 100vw" unoptimized className="object-cover opacity-85" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,#ed5b3255,transparent_28%),linear-gradient(145deg,#20222d,#0d0e13)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
            <div className="contrast-on-color absolute bottom-0 left-0 right-0 flex items-end justify-between p-4 pointer-events-none">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Master output</p>
                <p className="mt-1 text-sm font-bold truncate max-w-[200px]">
                  {user && latestVisualJob ? latestVisualJob.topic : 'Cinematic 1080p delivery'}
                </p>
              </div>
              <span className="border border-white/20 px-2 py-1 text-[10px] font-bold shrink-0 ml-2">30 FPS</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="surface-card grid grid-cols-2 lg:grid-cols-4" aria-label="Studio summary">
        {[
          { label: 'Total productions', value: jobs.length, icon: Film },
          { label: 'Completed films', value: completedCount, icon: CheckCircle2 },
          { label: 'In production', value: inProgressCount, icon: Clock3 },
          { label: 'Languages listed', value: '6', icon: Languages },
        ].map(metric => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="border-b border-r border-theme p-4 last:border-r-0 sm:p-5 [&:nth-child(2)]:border-r-0 [&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-secondary">{metric.label}</span>
                <Icon className="h-4 w-4 brand-text" aria-hidden="true" />
              </div>
              <p className="mt-3 font-mono text-2xl font-semibold tracking-[-0.04em] text-primary">{metric.value}</p>
            </div>
          );
        })}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 border-b border-theme sm:flex-row sm:items-end">
          <div className="flex max-w-full items-center gap-6 overflow-x-auto">
            {[
              { id: 'studio' as const, label: `Projects ${jobs.length}`, icon: Film },
              { id: 'faceless' as const, label: 'Faceless YouTube Engine', icon: Youtube },
              { id: 'features' as const, label: 'Production toolkit', icon: Layers3 },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-0 text-xs font-bold transition-colors ${active ? 'border-[var(--app-brand)] text-primary' : 'border-transparent text-secondary hover:text-[var(--app-text)]'}`}
                  aria-pressed={active}
                >
                  <Icon className={`h-3.5 w-3.5 ${tab.id === 'faceless' ? 'text-red-500' : ''}`} aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onNewJob()} className="btn-secondary self-start !text-xs sm:self-auto">
            <Plus className="h-4 w-4 brand-text" aria-hidden="true" />
            New documentary
          </button>
        </div>

        {activeTab === 'studio' && (
          <div>
            {isLoading ? (
              <div className="surface-card p-16 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin brand-text" aria-hidden="true" />
                <p className="mt-3 text-sm text-secondary">Loading your productions...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="surface-card px-6 py-16 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md brand-soft">
                  <Film className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-primary">Your production slate is empty</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Start with a topic and KinesisFlow will prepare scenes, narration, subtitle options, and a final render.</p>
                <button type="button" onClick={() => onNewJob()} className="btn-primary mt-6">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Create your first film
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map(job => {
                  const completed = job.status === 'completed';
                  const failed = job.status === 'failed' || job.status === 'cancelled';
                  const image = job.thumbnailUrl || (job.scenes?.[0]?.imagePath
                    ? scenePreviewUrl(job.id, job.scenes[0].sceneNumber, job.scenes[0].imageUpdatedAt || job.updatedAt)
                    : undefined);
                  const openJob = () => completed ? onPreviewVideo(job) : onSelectJob(job.id);
                  return (
                    <article key={job.id} className="surface-card group overflow-hidden transition-[border-color,box-shadow] duration-200 hover:border-[var(--app-brand)] hover:shadow-[var(--app-shadow-md)]">
                      <button type="button" onClick={openJob} className="relative block aspect-video w-full overflow-hidden bg-[#15161d] text-left" aria-label={`Open ${job.topic}`}>
                        {image ? (
                          <Image src={image} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 768px) 48vw, 100vw" unoptimized className="object-cover transition-opacity duration-200 group-hover:opacity-90" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center"><Camera className="h-8 w-8 text-white/25" aria-hidden="true" /></span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" />
                        {completed && (
                          <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-950 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
                          </span>
                        )}
                        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide backdrop-blur ${completed ? 'bg-emerald-500/90 text-white' : failed ? 'bg-red-500/90 text-white' : 'bg-white/90 text-zinc-900'}`}>
                          {completed ? 'Ready' : job.status === 'cancelled' ? 'Stopped' : failed ? 'Needs attention' : `${job.progress.percent}% in production`}
                        </span>
                        <span className="absolute bottom-3 right-3 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                          {completed ? formatDuration(job.finalDurationSeconds) : `${job.durationMinutes} min`}
                        </span>
                      </button>

                      <div className="p-4">
                        <button type="button" onClick={openJob} className="line-clamp-2 text-left text-sm font-extrabold leading-5 text-primary transition-colors hover:text-[var(--app-brand)]">
                          {job.topic}
                        </button>
                        <p className="mt-2 text-[11px] font-medium text-secondary">
                          {job.scenes?.length || job.durationMinutes * 10} scenes · {job.aspectRatio || '16:9'} · {job.contentStyle === 'kids' ? `Kids ${job.kidsFormat || 'story'}` : 'Documentary'} · {job.language} · {new Date(job.createdAt).toLocaleDateString()}
                        </p>

                        <div className="mt-4 flex items-center gap-2 border-t border-theme pt-3">
                          <button type="button" onClick={openJob} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--app-surface-soft)] px-3 text-xs font-bold text-primary transition-colors hover:bg-[var(--app-brand-soft)]">
                            {completed ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {completed ? 'Watch film' : 'View pipeline'}
                            {!completed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                          </button>
                          {job.videoUrl && (
                            <a href={job.videoUrl} download={`kinesisflow_${job.topic.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}_1080p.mp4`} className="icon-button !h-10 !w-10" aria-label={`Download ${job.topic}`} title="Download MP4">
                              <Download className="h-4 w-4" aria-hidden="true" />
                            </a>
                          )}
                          <button type="button" onClick={() => onDeleteJob(job.id)} className="icon-button !h-10 !w-10 hover:!border-red-400 hover:!text-red-500" aria-label={`Delete ${job.topic}`} title="Delete project">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'faceless' && (
          <div className="space-y-8">
            <div className="surface-card border-l-2 border-l-[var(--app-brand)] p-6 sm:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="eyebrow mb-2">YouTube Automation Pipeline</p>
                  <h3 className="editorial-title text-2xl text-primary sm:text-3xl">High-RPM Faceless Niches</h3>
                  <p className="mt-1 text-sm text-secondary">Launch automated channels in proven YouTube niches with one-click production templates.</p>
                </div>
                <button type="button" onClick={() => onNewJob()} className="btn-primary self-start md:self-auto shrink-0">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Start Faceless Video
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: 'Wealth & Finance',
                    rpm: '$15 - $35 RPM',
                    topic: 'How the Rothschild family built modern finance',
                    detail: 'Market panics, monetary systems, billionaire histories, and economic crises structured for maximum watch time.',
                  },
                  {
                    title: 'Ancient Mysteries & History',
                    rpm: '$8 - $18 RPM',
                    topic: 'The hidden cities beneath the Sahara Desert',
                    detail: 'Forgotten civilizations, unsolved archaeology, and geopolitical history rendered with rich atmosphere.',
                  },
                  {
                    title: 'Deep Science & Universe',
                    rpm: '$10 - $22 RPM',
                    topic: 'How deep-sea creatures survive extreme pressure',
                    detail: 'Extreme physics, abyssal exploration, and cosmological scale with cinematic visual immersion.',
                  },
                  {
                    title: 'Tech & AI Revolutions',
                    rpm: '$12 - $28 RPM',
                    topic: 'The AI revolution nobody saw coming',
                    detail: 'Semiconductor breakthroughs, robotics frontiers, and algorithmic futures explained with clarity.',
                  },
                  {
                    title: 'Indian History & Lore (Hindi)',
                    rpm: '₹250 - ₹600 CPM',
                    topic: 'प्राचीन सिंधु घाटी का अनसुलझा रहस्य',
                    detail: 'Authentic Sarvam AI conversational Hindi voiceover with Sanskritized cadence and dramatic pacing.',
                  },
                  {
                    title: 'Kids & Family Storybooks',
                    rpm: 'High Volume Evergreen',
                    topic: 'The Little Bear Who Wanted to Touch the Moon',
                    detail: 'Bedtime adventures, moral fables, and animated rhymes with warm vibrant colors and child-safe storytelling.',
                  },
                ].map(niche => (
                  <div key={niche.title} className="surface-raised flex flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-primary">{niche.title}</span>
                        <span className="rounded bg-[var(--app-brand-soft)] px-2 py-0.5 text-[10px] font-extrabold brand-text">{niche.rpm}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-secondary">{niche.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPromptInput(niche.topic); onNewJob(niche.topic); }}
                      className="mt-4 flex items-center justify-between border-t border-theme pt-3 text-left text-xs font-bold brand-text hover:underline"
                    >
                      <span className="truncate pr-2">Try: {niche.topic}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="surface-card p-6">
                <Images className="h-5 w-5 brand-text" aria-hidden="true" />
                <h4 className="mt-4 text-base font-bold text-primary">Dual 16:9 YouTube Thumbnails</h4>
                <p className="mt-2 text-xs leading-5 text-secondary">
                  Every video automatically generates 2 contrasting YouTube-native thumbnails: Hook Hero (focal protagonist) and Climax Peak (dramatic high-tension reveal). Perfect for YouTube Studio A/B test experiments.
                </p>
              </div>

              <div className="surface-card p-6">
                <Camera className="h-5 w-5 brand-text" aria-hidden="true" />
                <h4 className="mt-4 text-base font-bold text-primary">55%+ Audience Retention Motion</h4>
                <p className="mt-2 text-xs leading-5 text-secondary">
                  10 visual frames per minute paired with gentle Ken Burns motion (cinematic slow zoom, subtle pan, and soft crossfades) keeps YouTube viewers engaged past the critical 30-second retention cliff.
                </p>
              </div>

              <div className="surface-card p-6">
                <Mic2 className="h-5 w-5 brand-text" aria-hidden="true" />
                <h4 className="mt-4 text-base font-bold text-primary">Authentic Neural Narration &amp; Subtitles</h4>
                <p className="mt-2 text-xs leading-5 text-secondary">
                  Human-sounding narration in English and conversational Hindi with auto-timed burned-in subtitles. Background music ducks under speech so every word cuts through clearly on mobile speakers.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="grid border-y border-theme md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Camera, title: 'Motion direction', text: 'Every still becomes a composed shot with controlled pan, zoom, pacing, and scene transitions.' },
              { icon: Mic2, title: 'Narrative voice', text: 'Match a documentary voice to the script and produce scene-level audio with timed subtitles.' },
              { icon: Layers3, title: 'Timeline control', text: 'Replace visuals, refine narration, reorder scenes, and render a new master without rebuilding the project.' },
              { icon: Music2, title: 'Animated kids rhymes', text: 'Create Hindi or English rhyme videos with singable lyrics, generated music, and rhythm-driven character motion.' },
            ].map(feature => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="border-b border-theme p-6 md:border-r lg:border-b-0 last:border-r-0 sm:p-7">
                  <Icon className="h-5 w-5 brand-text" aria-hidden="true" />
                  <h3 className="mt-5 text-base font-bold text-primary">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-secondary">{feature.text}</p>
                </article>
              );
            })}
          </div>
        )}

      </section>

      {/* Dedicated Faceless YouTube Features Section */}
      <section className="surface-card border-t-2 border-t-[var(--app-brand)] p-6 sm:p-9 lg:p-11" aria-label="Faceless YouTube creator features">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">Built for Faceless YouTube Creators</p>
            <h2 className="editorial-title text-2xl text-primary sm:text-3xl lg:text-4xl">
              Everything your channel needs to publish, rank, and monetize.
            </h2>
            <p className="mt-3 text-sm leading-6 text-secondary">
              Stop juggling 5 different tools for scriptwriting, image generation, voiceover, captioning, and video editing. KinesisFlow unites the entire YouTube automation stack into one unified production workspace.
            </p>
          </div>
          <button type="button" onClick={() => onNewJob()} className="btn-primary shrink-0 self-start md:self-auto">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Create Your First Video
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: TrendingUp,
              title: 'High-RPM Niche Scripts',
              detail: 'Researched 10-scene narrative scripts tailored for Finance, True Crime, History, Science, and Tech channels. High-hook intros designed to maximize view duration.',
            },
            {
              icon: Images,
              title: 'Dual 16:9 High-CTR Thumbnails',
              detail: 'Two contrasting YouTube-native thumbnails (Hook Hero vs Climax Peak) formatted at 16:9 with saturated lighting and high-contrast subjects ready for YouTube Studio A/B testing.',
            },
            {
              icon: Camera,
              title: 'Cinematic Ken Burns Motion',
              detail: 'Every image is enriched with smooth pan, zoom, and crossfade movement. Ten visual frames per minute prevent viewer drop-off and push average retention above 55%.',
            },
            {
              icon: Mic2,
              title: 'Neural Speech & Timed Subtitles',
              detail: 'Human-like neural narration in English and conversational Hindi (via Sarvam AI), with burned-in animated subtitles and ducked ambient background music.',
            },
            {
              icon: Layers3,
              title: 'Script Review & Timeline Editor',
              detail: 'Review and edit scripts before rendering starts. Re-generate any scene image, re-record audio, or adjust pacing without re-running the entire project or wasting credits.',
            },
            {
              icon: Video,
              title: '1080p Master MP4 Ready to Upload',
              detail: 'Export pristine 1080p MP4 files formatted for YouTube long-form (16:9) or vertical shorts (9:16). Complete commercial ownership for AdSense and sponsorships.',
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="surface-raised p-5 sm:p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg brand-soft brand-text">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold text-primary">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-secondary">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-card flex flex-col items-start justify-between gap-5 border-l-2 border-l-[var(--app-brand)] p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">Flexible production pricing</span>
            <span className="rounded bg-[var(--app-brand-soft)] px-2 py-0.5 text-[10px] font-extrabold brand-text">USD ($) &amp; INR (₹)</span>
          </div>
          <h2 className="editorial-title mt-2 text-2xl sm:text-3xl text-primary">150 production credits for $5 (₹499).</h2>
          <p className="mt-2 text-xs sm:text-sm text-secondary max-w-xl">
            Choose from Creator ($5), Creator Pro ($19), or Studio ($39). Includes animated videos, real footage, and high-quality voice cloning on Pro &amp; Studio plans. Pay via Cards or UPI in INR or USD.
          </p>
        </div>
        <button type="button" onClick={onOpenPricing} className="btn-primary shrink-0">
          Compare all plans <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>

      <SampleShowcase />
    </div>
  );
}
