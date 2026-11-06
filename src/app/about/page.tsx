import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clapperboard } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const description = 'Learn how KinesisFlow combines scene planning, generated visuals, narration, optional subtitles, timeline editing, and MP4 rendering for documentary-style and Kids & Family videos.';

export const metadata: Metadata = {
  title: 'About the Video Creation Workflow',
  description,
  alternates: { canonical: '/about' },
  openGraph: { type: 'website', url: '/about', title: 'About KinesisFlow', description, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: 'About KinesisFlow', description, images: ['/opengraph-image'] },
};

export default function AboutPage() {
  return (
    <div className="app-shell min-h-screen">
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !px-3 text-xs"><ArrowLeft className="h-4 w-4" /> Back to studio</Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-text)] text-[var(--app-surface)]"><Clapperboard className="h-4 w-4" /></span>
            <span className="text-sm font-extrabold text-primary">KinesisFlow</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-4 py-10 sm:px-6 sm:py-16">
        <section className="grid border-y border-theme py-9 md:grid-cols-[1.35fr_0.65fr] md:gap-12 md:py-14">
          <div>
            <p className="eyebrow">About KinesisFlow</p>
            <h1 className="editorial-title mt-4 max-w-3xl text-4xl leading-[1.04] text-primary sm:text-5xl">One workspace for documentary and Kids &amp; Family video production.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-secondary">Start with a topic or your own script. KinesisFlow prepares the scene plan, visuals, narration, subtitles, and final MP4 while keeping the script and timeline available for review.</p>
          </div>
          <dl className="mt-8 divide-y divide-[var(--app-border)] border-t border-theme text-sm md:mt-0">
            <div className="py-4"><dt className="text-xs font-semibold uppercase tracking-wider text-secondary">Inputs</dt><dd className="mt-1 font-semibold text-primary">Topic or custom script</dd></div>
            <div className="py-4"><dt className="text-xs font-semibold uppercase tracking-wider text-secondary">Modes</dt><dd className="mt-1 font-semibold text-primary">Documentary · Kids &amp; Family</dd></div>
            <div className="py-4"><dt className="text-xs font-semibold uppercase tracking-wider text-secondary">Output</dt><dd className="mt-1 font-semibold text-primary">1080p landscape or short vertical MP4</dd></div>
          </dl>
        </section>

        <section aria-labelledby="workflow-title">
          <p className="eyebrow">What the workspace handles</p>
          <h2 id="workflow-title" className="editorial-title mt-2 text-3xl text-primary">A reviewable production workflow</h2>
          <div className="mt-7 border-t border-theme">
            {[
              ['01', 'Plan the story', 'Generate a scene-by-scene script from a topic, or begin with your own text.'],
              ['02', 'Build the media', 'Create scene visuals and timed narration for the selected audience and format.'],
              ['03', 'Review the timeline', 'Edit narration, replace images, adjust subtitles, and check the sequence before rendering.'],
              ['04', 'Render the master', 'Export the approved timeline as a downloadable MP4 with optional subtitles and music.'],
            ].map(([number, title, text]) => (
              <article key={number} className="grid gap-2 border-b border-theme py-5 sm:grid-cols-[4rem_12rem_1fr] sm:items-baseline">
                <span className="font-mono text-xs brand-text">{number}</span>
                <h3 className="font-bold text-primary">{title}</h3>
                <p className="text-sm leading-6 text-secondary">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-l-2 border-l-[var(--app-brand)] pl-6 sm:pl-8">
          <p className="eyebrow">Creator review is required</p>
          <h2 className="editorial-title mt-2 text-3xl text-primary">Generated media can contain mistakes.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">Check factual claims, third-party rights, audience fit, pronunciation, scene continuity, and the final render before publishing. If a job stops, completed generation work remains charged and unused reserved credits are released.</p>
        </section>

        <section className="flex flex-col items-start justify-between gap-5 border-y border-theme py-7 sm:flex-row sm:items-center">
          <div><h2 className="text-xl font-bold text-primary">Create a new video project</h2><p className="mt-1 text-sm text-secondary">Choose documentary or Kids &amp; Family direction before generation begins.</p></div>
          <Link href="/" className="btn-primary">Open the studio <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>
    </div>
  );
}
