'use client';

import { useEffect, useState } from 'react';
import { Film, Quote, RectangleHorizontal, Smartphone, Sparkles } from 'lucide-react';
import { TestimonialVideo } from '@/lib/types';

const FALLBACK_TESTIMONIALS: TestimonialVideo[] = [
  {
    id: 'fallback-moon-to-mars',
    title: 'Moon to Mars: India’s Space Journey',
    description: 'A cinematic account of Chandrayaan and Mangalyaan.',
    videoUrl: '/samples/isro-moon-to-mars.mp4',
    posterUrl: '/samples/isro-moon-to-mars.webp',
    format: 'landscape',
    quote: 'The pilot gave us a complete first cut with clear narrative direction and synchronized production.',
    attribution: 'Creator pilot review',
    published: true,
    createdAt: '2026-10-29T16:00:00.000Z',
  },
];

export function SampleShowcase() {
  const [items, setItems] = useState<TestimonialVideo[]>(FALLBACK_TESTIMONIALS);

  useEffect(() => {
    fetch('/api/testimonials')
      .then(response => response.json())
      .then(data => {
        if (data.success && Array.isArray(data.testimonials) && data.testimonials.length > 0) setItems(data.testimonials);
      })
      .catch(() => undefined);
  }, []);

  return (
    <section className="space-y-5" aria-labelledby="sample-films-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Creator showcase</p>
          <h2 id="sample-films-title" className="mt-2 text-2xl font-black tracking-[-0.045em] text-primary sm:text-3xl">Creator stories in every screen format.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Watch managed showcase videos from documentary masters, vertical Reels, and TikTok-ready productions.</p>
        </div>
        <span className="brand-soft flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]"><Sparkles className="h-3.5 w-3.5" /> Creator results</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map(item => {
          const vertical = item.format === 'reels' || item.format === 'tiktok';
          const FormatIcon = vertical ? Smartphone : RectangleHorizontal;
          return (
            <article key={item.id} className="surface-card overflow-hidden rounded-3xl">
              <div className={`${vertical ? 'mx-auto aspect-[9/16] max-h-[560px] max-w-[315px]' : 'aspect-video'} bg-black`}>
                <video controls playsInline preload="metadata" poster={item.posterUrl} className="h-full w-full object-cover" aria-label={`Watch ${item.title}`}>
                  <source src={item.videoUrl} />Your browser does not support embedded video.
                </video>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold text-primary">{item.title}</h3><p className="mt-1 text-xs leading-5 text-secondary">{item.description}</p></div><span className="brand-soft flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase"><FormatIcon className="h-3 w-3" />{item.format}</span></div>
                {item.quote && <blockquote className="mt-4 border-t border-theme pt-4 text-xs font-semibold leading-5 text-primary"><Quote className="mb-2 h-4 w-4 brand-text" />“{item.quote}”{item.attribution && <cite className="mt-2 block text-[10px] font-medium not-italic text-secondary">{item.attribution}</cite>}</blockquote>}
                <div className="mt-4 flex items-center gap-2 border-t border-theme pt-3 text-[10px] font-semibold text-secondary"><Film className="h-3.5 w-3.5 brand-text" /> Published creator showcase</div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
