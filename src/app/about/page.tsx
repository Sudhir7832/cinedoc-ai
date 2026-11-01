'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clapperboard, Film, Layers3, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AboutPage() {
  return (
    <div className="app-shell min-h-screen">
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !px-3 text-xs"><ArrowLeft className="h-4 w-4" /> Back to studio</Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-text)] text-[var(--app-surface)]"><Clapperboard className="h-4 w-4" /></span>
            <span className="text-sm font-extrabold text-primary">CineDoc AI</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 sm:py-16">
        <section className="surface-card relative overflow-hidden rounded-[2rem] p-7 sm:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--app-brand)] opacity-[0.08] blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="eyebrow">About CineDoc AI</p>
            <h1 className="mt-4 text-4xl font-black leading-[1.06] tracking-[-0.055em] text-primary sm:text-5xl">A focused production studio for stories worth watching.</h1>
            <p className="mt-5 text-sm leading-7 text-secondary sm:text-base">CineDoc AI brings scripting, visual direction, narration, subtitles, timeline editing, and final rendering into one practical workspace. It supports cinematic documentaries and Kids & Family formats without forcing creators to manage a collection of disconnected tools.</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Film, title: 'Complete production', text: 'Move from a topic or custom script to a finished, downloadable video.' },
            { icon: Layers3, title: 'Creative control', text: 'Review scenes, replace visuals, edit narration, and rerender the timeline.' },
            { icon: Users, title: 'Audience-aware', text: 'Direct factual documentaries or kids education, entertainment, adventure, and bedtime stories.' },
          ].map(item => {
            const Icon = item.icon;
            return <article key={item.title} className="surface-card rounded-3xl p-6"><span className="brand-soft flex h-10 w-10 items-center justify-center rounded-xl"><Icon className="h-5 w-5" /></span><h2 className="mt-4 text-base font-extrabold text-primary">{item.title}</h2><p className="mt-2 text-sm leading-6 text-secondary">{item.text}</p></article>;
          })}
        </section>

        <section className="surface-card grid gap-7 rounded-3xl p-7 sm:p-9 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div><p className="eyebrow">How we build</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-primary">Useful automation, visible controls.</h2></div>
          <div className="space-y-3">
            <p className="flex gap-3 text-sm leading-6 text-secondary"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--app-success)]" /> Failed renders release their reserved credits automatically.</p>
            <p className="flex gap-3 text-sm leading-6 text-secondary"><Sparkles className="mt-1 h-4 w-4 shrink-0 brand-text" /> Audience and visual direction remain explicit choices, not hidden assumptions.</p>
            <p className="flex gap-3 text-sm leading-6 text-secondary"><Layers3 className="mt-1 h-4 w-4 shrink-0 text-[var(--app-accent)]" /> Generated work stays editable through the scene and timeline tools.</p>
          </div>
        </section>

        <section className="surface-raised flex flex-col items-start justify-between gap-5 rounded-3xl p-7 sm:flex-row sm:items-center sm:p-9">
          <div><h2 className="text-xl font-black text-primary">Start with one clear idea.</h2><p className="mt-1 text-sm text-secondary">Build the script, visuals, narration, and final master in one production flow.</p></div>
          <Link href="/" className="btn-primary">Open the studio <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>
    </div>
  );
}
