'use client';

import { useState } from 'react';
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
  Sparkles,
  Trash2,
  Video,
  WandSparkles,
} from 'lucide-react';
import { DocumentaryJob } from '@/lib/types';
import { SampleShowcase } from '@/components/SampleShowcase';

interface DashboardProps {
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
  'How deep-sea creatures create light',
  'The race to map the early universe',
  'प्राचीन सिंधु घाटी का रहस्य',
];

const PIPELINE = [
  { label: 'Editorial script', detail: 'Narrative structure and scene plan', icon: WandSparkles },
  { label: 'Cinematic visuals', detail: '10 art-directed frames per minute', icon: Images },
  { label: 'Neural narration', detail: 'Voice, timing, and subtitles', icon: Mic2 },
  { label: 'Master render', detail: '1080p delivery with motion', icon: Video },
];

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Dashboard({
  jobs,
  isLoading,
  onNewJob,
  onSelectJob,
  onPreviewVideo,
  onDeleteJob,
  onOpenPricing,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'studio' | 'features'>('studio');
  const [promptInput, setPromptInput] = useState('');

  const completedCount = jobs.filter(job => job.status === 'completed').length;
  const inProgressCount = jobs.filter(job => !['completed', 'failed'].includes(job.status)).length;
  const latestVisual = jobs.find(job => job.scenes?.[0]?.imagePath)?.scenes[0]?.imagePath;

  const handlePromptSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onNewJob(promptInput.trim() || undefined);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
        <div className="surface-card relative overflow-hidden rounded-[2rem] p-6 sm:p-9 lg:p-11">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--app-brand)] opacity-[0.08] blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full brand-soft px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">Audience-aware AI video studio</span>
            </div>

            <h1 className="max-w-2xl text-4xl font-black leading-[1.05] tracking-[-0.055em] text-primary sm:text-5xl lg:text-[3.65rem]">
              From a single idea to a film worth watching.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-secondary sm:text-base">
              Create a cinematic documentary or a colorful Kids & Family story for learning, comedy, adventure, or bedtime, then direct every scene, narration track, subtitle, and 1080p render in one workspace.
            </p>

            <form onSubmit={handlePromptSubmit} className="surface-raised mt-8 rounded-2xl p-2">
              <label htmlFor="documentary-topic" className="sr-only">Documentary topic</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex min-h-12 flex-1 items-center gap-2 px-3">
                  <WandSparkles className="h-5 w-5 shrink-0 brand-text" aria-hidden="true" />
                  <input
                    id="documentary-topic"
                    value={promptInput}
                    onChange={event => setPromptInput(event.target.value)}
                    placeholder="What should your documentary explore?"
                    className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-[var(--app-text-muted)]"
                  />
                </div>
                <button type="submit" className="btn-primary whitespace-nowrap px-5">
                  Start production
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
                  className="min-h-9 rounded-full border border-theme bg-[var(--app-surface-soft)] px-3 text-[11px] font-semibold text-secondary transition-colors hover:border-[var(--app-brand)] hover:text-[var(--app-text)]"
                >
                  {topic}
                </button>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-theme pt-5 text-xs font-semibold text-secondary">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" />1080p master</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" />Timed subtitles</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[var(--app-success)]" aria-hidden="true" />Neural voice</span>
            </div>
          </div>
        </div>

        <aside className="surface-raised overflow-hidden rounded-[2rem] p-5 sm:p-6" aria-label="Production pipeline preview">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Production desk</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-primary">One connected workflow</h2>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>

          <div className="mt-5 space-y-2">
            {PIPELINE.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <div key={stage.label} className="flex items-center gap-3 rounded-xl border border-theme bg-[var(--app-surface-soft)] p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface)] brand-text shadow-sm">
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

          <div className="relative mt-5 aspect-[16/8] overflow-hidden rounded-2xl bg-[#171821]">
            {latestVisual ? (
              <Image src={latestVisual} alt="Latest documentary scene" fill sizes="(min-width: 1024px) 32vw, 100vw" unoptimized className="object-cover opacity-85" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,#ed5b3255,transparent_28%),linear-gradient(145deg,#20222d,#0d0e13)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
            <div className="contrast-on-color absolute bottom-0 left-0 right-0 flex items-end justify-between p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Master output</p>
                <p className="mt-1 text-sm font-bold">Cinematic 1080p delivery</p>
              </div>
              <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold backdrop-blur">30 FPS</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Studio summary">
        {[
          { label: 'Total productions', value: jobs.length, icon: Film },
          { label: 'Completed films', value: completedCount, icon: CheckCircle2 },
          { label: 'In production', value: inProgressCount, icon: Clock3 },
          { label: 'Delivery quality', value: '1080p', icon: Video },
        ].map(metric => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="surface-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-secondary">{metric.label}</span>
                <Icon className="h-4 w-4 brand-text" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-primary">{metric.value}</p>
            </div>
          );
        })}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 border-b border-theme pb-4 sm:flex-row sm:items-center">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl surface-soft p-1">
            {[
              { id: 'studio' as const, label: `Projects ${jobs.length}`, icon: Film },
              { id: 'features' as const, label: 'Production toolkit', icon: Layers3 },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition-colors ${active ? 'bg-[var(--app-surface)] text-primary shadow-sm' : 'text-secondary hover:text-[var(--app-text)]'}`}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
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
              <div className="surface-card rounded-3xl p-16 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin brand-text" aria-hidden="true" />
                <p className="mt-3 text-sm text-secondary">Loading your productions...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="surface-card rounded-3xl px-6 py-16 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl brand-soft">
                  <Film className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-primary">Your production slate is empty</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Start with a topic and CineDoc will build the scenes, narration, subtitles, and final render.</p>
                <button type="button" onClick={() => onNewJob()} className="btn-primary mt-6">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Create your first film
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map(job => {
                  const completed = job.status === 'completed';
                  const failed = job.status === 'failed';
                  const image = job.scenes?.[0]?.imagePath;
                  const openJob = () => completed ? onPreviewVideo(job) : onSelectJob(job.id);
                  return (
                    <article key={job.id} className="surface-card group overflow-hidden rounded-3xl transition-[border-color,box-shadow] duration-200 hover:border-[var(--app-brand)] hover:shadow-[var(--app-shadow-md)]">
                      <button type="button" onClick={openJob} className="relative block aspect-video w-full overflow-hidden bg-[#15161d] text-left" aria-label={`Open ${job.topic}`}>
                        {image ? (
                          <Image src={image} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 768px) 48vw, 100vw" unoptimized className="object-cover transition-opacity duration-200 group-hover:opacity-90" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center"><Camera className="h-8 w-8 text-white/25" aria-hidden="true" /></span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" />
                        {completed && (
                          <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-950 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
                          </span>
                        )}
                        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide backdrop-blur ${completed ? 'bg-emerald-500/90 text-white' : failed ? 'bg-red-500/90 text-white' : 'bg-white/90 text-zinc-900'}`}>
                          {completed ? 'Ready' : failed ? 'Needs attention' : `${job.progress.percent}% in production`}
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
                          <button type="button" onClick={openJob} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--app-surface-soft)] px-3 text-xs font-bold text-primary transition-colors hover:bg-[var(--app-brand-soft)]">
                            {completed ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {completed ? 'Watch film' : 'View pipeline'}
                            {!completed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                          </button>
                          {job.videoUrl && (
                            <a href={job.videoUrl} download className="icon-button !h-10 !w-10" aria-label={`Download ${job.topic}`} title="Download MP4">
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

        {activeTab === 'features' && (
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: Camera, title: 'Motion direction', text: 'Every still becomes a composed shot with controlled pan, zoom, pacing, and scene transitions.' },
              { icon: Mic2, title: 'Narrative voice', text: 'Match a documentary voice to the script and produce scene-level audio with timed subtitles.' },
              { icon: Layers3, title: 'Timeline control', text: 'Replace visuals, refine narration, reorder scenes, and render a new master without rebuilding the project.' },
            ].map(feature => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="surface-card rounded-3xl p-6 sm:p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl brand-soft"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-5 text-base font-extrabold text-primary">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-secondary">{feature.text}</p>
                </article>
              );
            })}
          </div>
        )}

      </section>

      <section className="surface-card flex flex-col items-start justify-between gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="eyebrow">Simple usage pricing</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-primary">Creator starts at $11 with 150 credits.</h2>
          <p className="mt-2 text-sm text-secondary">Choose a straightforward credit pack for documentary and Kids & Family production.</p>
        </div>
        <button type="button" onClick={onOpenPricing} className="btn-primary shrink-0">
          Compare plans <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>

      <SampleShowcase />
    </div>
  );
}
