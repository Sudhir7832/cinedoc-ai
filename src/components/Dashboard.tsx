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
  FileText,
  Film,
  Images,
  Languages,
  Layers3,
  Loader2,
  Mic2,
  Music2,
  Play,
  Plus,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  Video,
  Volume2,
  WandSparkles,
  X,
  Youtube,
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
  const [pipelineStage, setPipelineStage] = useState<'script' | 'thumbnails' | 'audio' | 'timeline' | 'master'>('script');
  const [isJetPreviewOpen, setIsJetPreviewOpen] = useState(false);

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

          <div className="relative mt-5 aspect-[16/8] overflow-hidden rounded-md bg-[#171821] group">
            {!user ? (
              <video
                src="/jet-480.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
              />
            ) : latestVisual ? (
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
            ) : (
              <video
                src="/jet-480.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover opacity-90"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />

            {!user && (
              <button
                type="button"
                onClick={() => setIsJetPreviewOpen(true)}
                className="contrast-on-color absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white shadow-md backdrop-blur-sm transition-all hover:bg-black hover:scale-105"
                title="Watch preview with sound"
              >
                <Play className="h-3 w-3 fill-white" /> Preview
              </button>
            )}

            <div className="contrast-on-color absolute bottom-0 left-0 right-0 flex items-end justify-between p-4 pointer-events-none">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Master output</p>
                <p className="mt-1 text-sm font-bold truncate max-w-[200px]">
                  {user && latestVisualJob ? latestVisualJob.topic : 'Supersonic Jet: Cinematic 1080p delivery'}
                </p>
              </div>
              <span className="border border-white/20 px-2 py-1 text-[10px] font-bold shrink-0 ml-2">30 FPS</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="surface-card grid grid-cols-2 lg:grid-cols-4" aria-label="Studio summary">
        {[
          { label: 'Total productions', value: user ? jobs.length : '1000+', icon: Film },
          { label: 'Completed films', value: user ? completedCount : '700+', icon: CheckCircle2 },
          { label: 'In production', value: user ? inProgressCount : '70+', icon: Clock3 },
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

      {/* Platform Optimization - Theme-Native Design (No black strip) */}
      <div className="flex justify-center py-2" aria-label="Supported video platforms">
        <div className="surface-card inline-flex flex-wrap items-center justify-center gap-4 sm:gap-6 rounded-full px-6 py-2.5 border border-theme shadow-sm max-w-[94vw]">
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.16em] text-secondary">
            OPTIMIZED FOR
          </span>

          {/* YouTube */}
          <div className="flex items-center gap-1.5 shrink-0">
            <svg viewBox="0 0 28 20" className="h-4 sm:h-5 w-auto" fill="none" aria-hidden="true">
              <rect width="28" height="20" rx="5" fill="#FF0000" />
              <polygon points="11,5 19,10 11,15" fill="#FFFFFF" />
            </svg>
            <span className="text-xs sm:text-sm font-bold tracking-tight text-primary">YouTube</span>
          </div>

          {/* Instagram */}
          <div className="flex items-center gap-1.5 shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 sm:h-5 w-4 sm:w-5" fill="none" aria-hidden="true">
              <defs>
                <radialGradient id="ig-badge-grad" r="150%" cx="30%" cy="107%">
                  <stop stopColor="#fdf497" offset="0" />
                  <stop stopColor="#fdf497" offset="0.05" />
                  <stop stopColor="#fd5949" offset="0.45" />
                  <stop stopColor="#d6249f" offset="0.6" />
                  <stop stopColor="#285AEB" offset="0.9" />
                </radialGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-badge-grad)" />
              <rect x="6.5" y="6.5" width="11" height="11" rx="3" stroke="#FFFFFF" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="2.7" stroke="#FFFFFF" strokeWidth="1.8" />
              <circle cx="15.8" cy="8.2" r="0.85" fill="#FFFFFF" />
            </svg>
            <span className="text-xs sm:text-sm font-bold tracking-tight text-primary">Instagram</span>
          </div>

          {/* TikTok */}
          <div className="flex items-center gap-1.5 shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 sm:h-5 w-4 sm:w-5" fill="none" aria-hidden="true">
              <path
                d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.43c.4-.38.74-.82 1.01-1.31.25-.46.42-.96.48-1.48V8.82a8.16 8.16 0 0 0 4.24 1.25V6.7a4.85 4.85 0 0 1-.0-.01z"
                fill="currentColor"
                className="text-primary drop-shadow-[1px_0_0_#FE2C55] drop-shadow-[-1px_0_0_#25F4EE]"
              />
            </svg>
            <span className="text-xs sm:text-sm font-bold tracking-tight text-primary">TikTok</span>
          </div>
        </div>
      </div>

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

            <div className="surface-soft border border-theme p-5 sm:p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-primary flex items-center gap-2">
                  <Sparkles className="h-4 w-4 brand-text" aria-hidden="true" />
                  Full Studio Pipeline Included With Every Niche Template
                </p>
                <p className="mt-1 text-xs text-secondary max-w-2xl">
                  Every project automatically includes 10-beat retention scriptwriting, dual 16:9 YouTube Studio A/B thumbnails, 10 cuts/min Ken Burns camera motion, Sarvam AI Hindi or English narration, and a 1080p master MP4.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('studio-pipeline-showcase');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-secondary !text-xs shrink-0 self-start md:self-auto"
              >
                Explore Studio Pipeline <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
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

      {/* Bespoke Production Studio Pipeline Showcase - Replaces Generic Bento Cards */}
      <section id="studio-pipeline-showcase" className="surface-card border-t-2 border-t-[var(--app-brand)] p-6 sm:p-9 lg:p-11" aria-label="Faceless YouTube creator studio pipeline">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-[var(--app-brand)] animate-pulse" />
              <p className="eyebrow !mb-0">The Automated Studio Pipeline</p>
            </div>
            <h2 className="editorial-title text-2xl text-primary sm:text-3xl lg:text-4xl">
              One prompt. Five automated production stages.
            </h2>
            <p className="mt-3 text-sm leading-6 text-secondary">
              Stop juggling ChatGPT, Midjourney, ElevenLabs, Premiere, and Photoshop. KinesisFlow unites the entire YouTube production stack into one synchronized, high-retention pipeline.
            </p>
          </div>
          <button type="button" onClick={() => onNewJob()} className="btn-primary shrink-0 self-start md:self-auto">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Create Your First Video
          </button>
        </div>

        {/* Studio Stage Selector Tabs */}
        <div className="mt-8 border-b border-theme/80 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'script' as const, num: '01', title: 'Script & Hooks', desc: 'Retention Pacing' },
              { id: 'thumbnails' as const, num: '02', title: 'Dual Thumbnails', desc: 'A/B CTR Testing' },
              { id: 'audio' as const, num: '03', title: 'Neural Audio & BGM', desc: 'Sarvam AI & Ducking' },
              { id: 'timeline' as const, num: '04', title: 'Cinematic Motion', desc: '10 Cuts/Min & NLE' },
              { id: 'master' as const, num: '05', title: '1080p Master MP4', desc: 'AdSense Clearance' },
            ].map((stage) => {
              const active = pipelineStage === stage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setPipelineStage(stage.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-all ${
                    active
                      ? 'border-[var(--app-brand)] bg-[var(--app-surface-soft)] text-primary shadow-sm'
                      : 'border-theme/60 bg-[var(--app-surface)] text-secondary hover:border-theme hover:bg-[var(--app-surface-soft)]/60 hover:text-primary'
                  }`}
                  aria-pressed={active}
                >
                  <span className={`font-mono text-[11px] font-bold ${active ? 'brand-text' : 'text-secondary/70'}`}>
                    {stage.num}
                  </span>
                  <div>
                    <p className="text-xs font-bold leading-none">{stage.title}</p>
                    <p className="mt-0.5 text-[10px] text-secondary">{stage.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Stage Interactive Workbench */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.18fr] lg:gap-8 items-start">
          {/* Stage 1: Script & Hooks */}
          {pipelineStage === 'script' && (
            <>
              <div>
                <span className="font-mono text-[11px] font-bold tracking-widest text-[var(--app-brand)] uppercase">
                  Stage 01 · Narrative Architecture
                </span>
                <h3 className="editorial-title mt-2 text-2xl sm:text-3xl text-primary">
                  Scripts engineered for the critical first 30 seconds.
                </h3>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-secondary">
                  Most faceless channels fail because standard AI produces flat, lifeless encyclopedic summaries. KinesisFlow structures every documentary into 10 dramatic narrative beats—opening with an irresistible curiosity hook, pacing tension with pattern interrupts, and leading to an earned climax.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">High-RPM Calibration:</strong> Researched storytelling structures for Finance ($15–$35 RPM), True Crime, Deep Tech, and Ancient History.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">10-Beat Story Arc:</strong> Hook &rarr; Inciting Incident &rarr; Tension Escalation &rarr; Evidence &rarr; Climax Resolution.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Full Pre-Flight Review:</strong> Edit dialogue, adjust pacing, and refine scene cues before rendering a single frame.</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => onNewJob()} className="btn-primary !text-xs">
                    Try Script Engine <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setPipelineStage('thumbnails')} className="btn-secondary !text-xs">
                    Next: Dual Thumbnails &rarr;
                  </button>
                </div>
              </div>

              {/* Realistic Screenplay Teleprompter Mockup */}
              <div className="overflow-hidden rounded-xl border border-theme bg-[#121316] text-neutral-100 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#191a1f] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">screenplay_scene_01.fdx</span>
                  </div>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                    Hook Rating: 96 / 100
                  </span>
                </div>

                <div className="p-4 sm:p-5 font-mono text-xs space-y-3 bg-[#111215]">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 border-b border-neutral-800/80 pb-2">
                    <span>SCENE 01 / 10 · TEASER HOOK</span>
                    <span className="text-amber-400 font-bold">TIMECODE: 00:00 - 00:08</span>
                  </div>

                  <p className="text-neutral-400 text-[11px]">
                    <span className="text-neutral-500">SLUG:</span> INT. ANTWERP VAULT - NIGHT [4K CINEMATIC]
                  </p>
                  <p className="text-neutral-400 text-[11px]">
                    <span className="text-neutral-500">CAMERA:</span> SLOW PUSH-IN ON TITANIUM TUMBLER SYSTEM (24 FPS)
                  </p>

                  <div className="rounded-lg border border-neutral-800 bg-[#17181e] p-3 text-neutral-200 leading-relaxed font-sans text-xs">
                    <p className="text-[10px] font-bold text-amber-400 font-mono mb-1">NARRATION (DEEP DOCUMENTARY):</p>
                    &ldquo;On December 24, 1995, three men walked into the world&rsquo;s most impenetrable underground vault. They walked out four hours later with $160 million and didn&rsquo;t trigger a single alarm.&rdquo;
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[10px] text-neutral-400 border-t border-neutral-800/80">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Pattern interrupt at 00:05
                    </span>
                    <span className="font-mono text-neutral-400">Target Retention: 58%+</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Stage 2: Dual Thumbnails */}
          {pipelineStage === 'thumbnails' && (
            <>
              <div>
                <span className="font-mono text-[11px] font-bold tracking-widest text-[var(--app-brand)] uppercase">
                  Stage 02 · Packaging &amp; CTR
                </span>
                <h3 className="editorial-title mt-2 text-2xl sm:text-3xl text-primary">
                  Two native 16:9 thumbnails with every render.
                </h3>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-secondary">
                  A great documentary with zero clicks is a ghost video. Instead of generating a generic screenshot, KinesisFlow renders two contrasting 16:9 thumbnail concepts ready for YouTube Studio&rsquo;s &ldquo;Test &amp; Compare&rdquo; feature. You never launch blind.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Variant A (Hook Hero):</strong> Protagonist-centric focal shot with volumetric rim lighting.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Variant B (Climax Peak):</strong> Mystery reveal with high-contrast text overlay and narrative tension.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">YouTube Studio Native:</strong> Formatted to exact 1920×1080 and 1280×720 YouTube Studio specifications.</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => onNewJob()} className="btn-primary !text-xs">
                    Launch With A/B Covers <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setPipelineStage('audio')} className="btn-secondary !text-xs">
                    Next: Neural Audio &rarr;
                  </button>
                </div>
              </div>

              {/* Realistic YouTube Studio A/B Test Card */}
              <div className="overflow-hidden rounded-xl border border-theme bg-[#121316] text-neutral-100 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#191a1f] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">YouTube Studio · Test &amp; Compare</span>
                  </div>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                    16:9 Packaging Ready
                  </span>
                </div>

                <div className="p-4 sm:p-5 bg-[#111215]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Thumbnail A */}
                    <div className="rounded-lg border border-neutral-800 bg-[#17181e] p-2.5">
                      <div className="relative aspect-video w-full rounded overflow-hidden bg-gradient-to-tr from-stone-900 via-neutral-800 to-amber-950 flex flex-col justify-between p-2.5 border border-neutral-700/60">
                        <span className="self-start rounded bg-black/75 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300 backdrop-blur-sm">
                          Variant A · Hook Hero
                        </span>
                        <div>
                          <p className="font-extrabold text-[12px] text-white drop-shadow-md leading-tight">THE $160M HEIST</p>
                          <span className="inline-block mt-0.5 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-extrabold text-black">
                            58.4% CTR
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-neutral-400 font-mono text-center">Focal character with volumetric lighting</p>
                    </div>

                    {/* Thumbnail B */}
                    <div className="rounded-lg border border-amber-500/40 bg-[#1a1815] p-2.5">
                      <div className="relative aspect-video w-full rounded overflow-hidden bg-gradient-to-tr from-stone-950 via-red-950/80 to-neutral-900 flex flex-col justify-between p-2.5 border border-red-500/40">
                        <span className="self-start rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-black">
                          Variant B · Climax Peak
                        </span>
                        <div>
                          <p className="font-extrabold text-[12px] text-white drop-shadow-md leading-tight">4 HOURS. ZERO ALARMS.</p>
                          <span className="inline-block mt-0.5 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-black">
                            64.2% CTR (Winner)
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-amber-300 font-mono text-center">High-tension infrared climax reveal</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                    <span>Export: 1280×720 &amp; 1920×1080 JPEG</span>
                    <span className="font-mono text-amber-300 font-bold">YouTube Studio A/B Ready</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Stage 3: Neural Speech & Subtitles */}
          {pipelineStage === 'audio' && (
            <>
              <div>
                <span className="font-mono text-[11px] font-bold tracking-widest text-[var(--app-brand)] uppercase">
                  Stage 03 · Neural Speech &amp; Subtitles
                </span>
                <h3 className="editorial-title mt-2 text-2xl sm:text-3xl text-primary">
                  Human cadence in English &amp; Hindi with auto-ducked music.
                </h3>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-secondary">
                  Robotic text-to-speech kills viewer watch time within seconds. KinesisFlow synthesizes human-sounding narration in English and conversational Hindi via Sarvam AI. Timed animated subtitles keep viewers reading, while background music automatically ducks below speech so every word cuts through mobile speakers.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Sarvam AI Hindi:</strong> Natural conversational tone with authentic Indian inflection and dramatic pacing.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Studio English:</strong> Deep documentary pacing with natural human breath pauses and narrative warmth.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Smart Audio Ducking:</strong> Ambient score automatically attenuates to -18.5dB whenever speech is active.</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => onNewJob()} className="btn-primary !text-xs">
                    Try Neural Voiceover <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setPipelineStage('timeline')} className="btn-secondary !text-xs">
                    Next: Cinematic Motion &rarr;
                  </button>
                </div>
              </div>

              {/* Realistic Audio Mastering Deck & Karaoke Frame Mockup */}
              <div className="overflow-hidden rounded-xl border border-theme bg-[#121316] text-neutral-100 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#191a1f] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">Audio Deck · Dual-Track Master</span>
                  </div>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                    Smart Ducking Active (-18.5 dB)
                  </span>
                </div>

                <div className="p-4 sm:p-5 bg-[#111215] space-y-4">
                  {/* Voice selector chips */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-[var(--app-brand)]/80 bg-[var(--app-brand-soft)]/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      Sarvam AI · Hindi (Conversational)
                    </span>
                    <span className="rounded-md border border-neutral-800 bg-[#17181e] px-2.5 py-1 text-[11px] font-medium text-neutral-300">
                      Studio English · Deep Documentary
                    </span>
                  </div>

                  {/* Audio Waveform Meter */}
                  <div className="rounded-lg border border-neutral-800 bg-[#15161c] p-3">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-2">
                      <span className="flex items-center gap-1.5 text-neutral-300">
                        <Volume2 className="h-3 w-3 text-amber-400" /> Speech Frequency Spectrum
                      </span>
                      <span>48 kHz · 24-bit PCM</span>
                    </div>
                    <div className="flex items-end justify-between gap-1 h-10 px-1">
                      {[35, 60, 45, 85, 95, 70, 50, 80, 100, 65, 40, 90, 80, 55, 75, 95, 60, 45, 85, 70, 40, 30, 60, 45].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`w-full rounded-sm transition-all ${
                            h > 75 ? 'bg-amber-400' : h > 50 ? 'bg-orange-500' : 'bg-neutral-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Karaoke Subtitle Player Preview */}
                  <div className="relative aspect-[16/7] w-full rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center p-4">
                    <div className="text-center">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Burnt-In Timed Subtitle</p>
                      <p className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-snug">
                        &ldquo;THEY WALKED OUT WITH <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">$160 MILLION</span> IN CASH&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Mixer track meter */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-neutral-800/80 pt-3">
                    <div className="text-neutral-300">
                      <span className="text-neutral-500">VOICEOVER:</span> 0.0 dB (Mastered)
                    </div>
                    <div className="text-amber-400 text-right">
                      <span className="text-neutral-500">AMBIENT SCORE:</span> -18.5 dB (Ducked)
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Stage 4: Cinematic Motion & Timeline Editor */}
          {pipelineStage === 'timeline' && (
            <>
              <div>
                <span className="font-mono text-[11px] font-bold tracking-widest text-[var(--app-brand)] uppercase">
                  Stage 04 · Cinematography &amp; Timeline
                </span>
                <h3 className="editorial-title mt-2 text-2xl sm:text-3xl text-primary">
                  10 visual cuts per minute. Full pre-flight timeline editing.
                </h3>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-secondary">
                  Static AI slides cause immediate audience drop-off. KinesisFlow enriches every still with cinematic Ken Burns camera motion—slow zooms, horizontal pans, and gentle crossfades. Need to revise a line or replace an image? Tweak individual scenes in the timeline editor without re-running the project or wasting credits.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">10 Visual Cuts per Minute:</strong> Zero stillness ensures continuous visual engagement past the 30-second mark.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Ken Burns Camera Directing:</strong> Pan, zoom, tilt, and crossfade easing applied automatically to every frame.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Zero-Credit Timeline Review:</strong> Re-generate any single scene or audio clip without project restarts.</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => onNewJob()} className="btn-primary !text-xs">
                    Try Timeline Editor <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setPipelineStage('master')} className="btn-secondary !text-xs">
                    Next: 1080p Master &rarr;
                  </button>
                </div>
              </div>

              {/* Realistic NLE Timeline Mockup */}
              <div className="overflow-hidden rounded-xl border border-theme bg-[#121316] text-neutral-100 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#191a1f] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">NLE Timeline · 10 Cuts / Minute</span>
                  </div>
                  <span className="font-mono text-[10px] text-amber-300 font-bold">
                    00:01:24:18 · 24.00 FPS
                  </span>
                </div>

                <div className="p-4 sm:p-5 bg-[#111215] space-y-3 font-mono text-xs">
                  {/* Track V1: Visuals */}
                  <div className="rounded-lg border border-neutral-800 bg-[#16171d] p-2.5">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1.5">
                      <span className="font-bold text-amber-400">V1 · VISUAL SCENES (KEN BURNS)</span>
                      <span>4K Motion Cues</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="rounded bg-neutral-800/80 border border-neutral-700/60 p-1.5 text-center">
                        <p className="text-[9px] font-bold text-white">Scene 01</p>
                        <p className="text-[8px] text-amber-300">Slow Push +15%</p>
                      </div>
                      <div className="rounded bg-neutral-800/80 border border-neutral-700/60 p-1.5 text-center">
                        <p className="text-[9px] font-bold text-white">Scene 02</p>
                        <p className="text-[8px] text-emerald-300">Pan Left 24fps</p>
                      </div>
                      <div className="rounded bg-neutral-800/80 border border-neutral-700/60 p-1.5 text-center">
                        <p className="text-[9px] font-bold text-white">Scene 03</p>
                        <p className="text-[8px] text-amber-300">Macro Zoom</p>
                      </div>
                      <div className="rounded bg-neutral-800/80 border border-neutral-700/60 p-1.5 text-center">
                        <p className="text-[9px] font-bold text-white">Scene 04</p>
                        <p className="text-[8px] text-orange-300">Crossfade Easing</p>
                      </div>
                    </div>
                  </div>

                  {/* Track A1: Voiceover */}
                  <div className="rounded-lg border border-neutral-800 bg-[#16171d] p-2">
                    <div className="flex items-center justify-between text-[10px] text-emerald-400 mb-1">
                      <span className="font-bold">A1 · VOICEOVER MASTER</span>
                      <span className="text-neutral-500">48kHz · Sarvam AI</span>
                    </div>
                    <div className="h-4 rounded bg-emerald-950/60 border border-emerald-800/60 flex items-center px-2">
                      <span className="text-[9px] text-emerald-300 truncate">narration_sync_hi_en_master.wav</span>
                    </div>
                  </div>

                  {/* Track A2: Score */}
                  <div className="rounded-lg border border-neutral-800 bg-[#16171d] p-2">
                    <div className="flex items-center justify-between text-[10px] text-sky-400 mb-1">
                      <span className="font-bold">A2 · AMBIENT SCORE (DUCKED)</span>
                      <span className="text-neutral-500">-18.5 dB Ducking</span>
                    </div>
                    <div className="h-4 rounded bg-sky-950/60 border border-sky-800/60 flex items-center px-2">
                      <span className="text-[9px] text-sky-300 truncate">cinematic_tension_score_ducked.wav</span>
                    </div>
                  </div>

                  {/* Track T1: Subtitles */}
                  <div className="rounded-lg border border-neutral-800 bg-[#16171d] p-2">
                    <div className="flex items-center justify-between text-[10px] text-amber-400 mb-1">
                      <span className="font-bold">T1 · KARAOKE SUBTITLES</span>
                      <span className="text-neutral-500">Burned-In Timed</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="h-3.5 rounded bg-amber-950/60 border border-amber-800/60 flex items-center px-1.5 text-[8px] text-amber-300">
                        [00:00 - 00:04]
                      </div>
                      <div className="h-3.5 rounded bg-amber-950/60 border border-amber-800/60 flex items-center px-1.5 text-[8px] text-amber-300">
                        [00:04 - 00:08]
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                    <span className="text-emerald-400 font-bold">✓ Pre-Flight Scene Review</span>
                    <span>Zero credits lost on scene edits</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Stage 5: 1080p Master & Rights */}
          {pipelineStage === 'master' && (
            <>
              <div>
                <span className="font-mono text-[11px] font-bold tracking-widest text-[var(--app-brand)] uppercase">
                  Stage 05 · Production Master &amp; Rights
                </span>
                <h3 className="editorial-title mt-2 text-2xl sm:text-3xl text-primary">
                  1080p MP4 ready to upload. 100% monetization safe.
                </h3>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-secondary">
                  Export pristine 1080p MP4 files ready for direct YouTube upload or vertical Shorts (9:16). Every production comes with full commercial broadcast rights—cleared for YouTube AdSense monetization, brand sponsorships, and client contracts without copyright claims.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">Dual Master Formats:</strong> 16:9 Long-Form for YouTube channel growth &amp; 9:16 for viral Shorts/Reels.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">High-Profile H.264 MP4:</strong> Universal compatibility with burned-in subtitles and instant YouTube processing.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-secondary">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span><strong className="text-primary font-semibold">100% Monetization Safe:</strong> Cleared for AdSense with zero copyright strikes or royalty claims.</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => onNewJob()} className="btn-primary !text-xs">
                    Start Your First Master <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={onOpenPricing} className="btn-secondary !text-xs">
                    View Pricing Plans &rarr;
                  </button>
                </div>
              </div>

              {/* Realistic Master Render Queue Inspector Mockup */}
              <div className="overflow-hidden rounded-xl border border-theme bg-[#121316] text-neutral-100 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#191a1f] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">Master Export Queue · 1080p60</span>
                  </div>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> AdSense Cleared
                  </span>
                </div>

                <div className="p-4 sm:p-5 bg-[#111215] space-y-3.5">
                  <div className="rounded-lg border border-neutral-800 bg-[#17181e] p-3">
                    <p className="font-mono text-[11px] font-bold text-white truncate">
                      kinesisflow_antwerp_vault_heist_1080p.mp4
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-neutral-400">
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">1920×1080 (16:9)</span>
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">60.00 FPS</span>
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">H.264 High Profile</span>
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">320kbps AAC</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2 text-xs">
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="h-4 w-4" /> Commercial License Clearance
                    </p>
                    <div className="space-y-1 text-[11px] text-neutral-300">
                      <p className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        YouTube Content ID Verified: Zero copyright strikes
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        Burned-in timed karaoke subtitles synchronized
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        Dual 16:9 thumbnails included in download package
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-neutral-400">Master Output: Ready</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400 text-[10px] uppercase">
                      100% Commercial Ownership
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Editorial Architecture Strip (Unslop - No Icon Cards) */}
        <div className="mt-10 border-t border-theme/80 pt-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            <div className="border-l-2 border-l-[var(--app-brand)] pl-4">
              <span className="font-mono text-[10px] font-bold tracking-widest text-secondary uppercase">
                01 · Retention Architecture
              </span>
              <h4 className="mt-1 text-sm font-bold text-primary">10 Visual Cuts Per Minute</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                Curiosity hooks, pattern interrupts, and smooth Ken Burns motion keep audience retention well past the critical 30-second cliff.
              </p>
            </div>

            <div className="border-l-2 border-l-[var(--app-brand)] pl-4">
              <span className="font-mono text-[10px] font-bold tracking-widest text-secondary uppercase">
                02 · YouTube Studio Packaging
              </span>
              <h4 className="mt-1 text-sm font-bold text-primary">Dual 16:9 High-CTR Thumbnails</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                Hook Hero and Climax Peak variations formatted at native 16:9 with saturated lighting—ready for YouTube Studio A/B experiments.
              </p>
            </div>

            <div className="border-l-2 border-l-[var(--app-brand)] pl-4">
              <span className="font-mono text-[10px] font-bold tracking-widest text-secondary uppercase">
                03 · Commercial Rights
              </span>
              <h4 className="mt-1 text-sm font-bold text-primary">1080p MP4 &amp; AdSense Cleared</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                Sarvam AI Hindi &amp; English narration with ducked ambient score. Complete commercial ownership for YouTube monetization and sponsorships.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card flex flex-col items-start justify-between gap-5 border-l-2 border-l-[var(--app-brand)] p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="eyebrow mb-1">Flexible production pricing</p>
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

      {/* Master Video Preview Modal */}
      {isJetPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Master output video preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsJetPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3 sm:px-6">
              <div>
                <h3 className="text-sm font-bold text-primary">Master Output Preview (jet-480)</h3>
                <p className="text-xs text-secondary">Cinematic AI-generated documentary render with Ken Burns motion</p>
              </div>
              <button
                type="button"
                onClick={() => setIsJetPreviewOpen(false)}
                className="rounded-lg p-1.5 text-secondary hover:bg-[var(--app-surface-soft)] hover:text-primary transition-colors"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <video
                src="/jet-480.mp4"
                controls
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 sm:px-6 text-xs text-secondary">
              <span className="font-medium">Ready for YouTube Studio 16:9 &amp; Mobile Feeds</span>
              <button
                type="button"
                onClick={() => setIsJetPreviewOpen(false)}
                className="btn-secondary !py-1 !px-3 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
