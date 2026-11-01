import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Clapperboard, HelpCircle, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'AI Documentary and Kids Video FAQ',
  description: 'Answers about CineDoc AI video generation, documentary and Kids & Family formats, credits, subtitles, narration providers, rendering, and commercial use.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'CineDoc AI Frequently Asked Questions',
    description: 'Learn how AI scripts, visuals, narration, credits, subtitles, and final video rendering work.',
    type: 'website',
    url: '/faq',
  },
};

const FAQS = [
  { question: 'What does CineDoc AI create?', answer: 'CineDoc AI creates complete videos from a topic or custom script, including scene planning, AI visuals, narration, optional subtitles, timeline editing, and final MP4 rendering.' },
  { question: 'Can I create both documentaries and kids videos?', answer: 'Yes. Documentary mode uses realistic cinematic direction. Kids & Family mode supports educational, entertainment, safe adventure, and bedtime formats with tailored writing and visual styles.' },
  { question: 'Can I choose whether subtitles appear in the video?', answer: 'Yes. During creation you can choose Show subtitles to burn synchronized captions into the video, or Clean video to render without visible subtitles or an SRT track.' },
  { question: 'Can CineDoc AI create vertical 9:16 videos?', answer: 'Yes. One-minute productions can be rendered as 16:9 landscape or 9:16 vertical video for Shorts, Reels, TikTok, and mobile feeds.' },
  { question: 'When are generation credits deducted?', answer: 'Credits are reserved while processing and deducted after the final video passes validation. If generation fails, the reservation is released automatically.' },
  { question: 'Which narration providers are supported?', answer: 'Administrators can configure separate Documentary and Kids narration profiles using Microsoft Neural, Sarvam AI Bulbul, OpenRouter, or Cloudflare voices.' },
  { question: 'Can I edit the generated scenes?', answer: 'Yes. The timeline editor lets you reorder scenes, replace images, adjust durations, edit narration text, and rerender the video.' },
  { question: 'What video formats can appear in the creator showcase?', answer: 'Administrators can publish landscape 16:9 videos and vertical 9:16 videos labeled for Instagram Reels or TikTok.' },
  { question: 'Can generated videos be used commercially?', answer: 'Subject to the Terms and the rights of supplied prompts and assets, generated videos may be published and monetized in creator channels and client campaigns.' },
];

export default function FaqPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <div className="app-shell min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-4xl items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !px-3 text-xs"><ArrowLeft className="h-4 w-4" /> Back to studio</Link>
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-text)] text-[var(--app-surface)]"><Clapperboard className="h-4 w-4" /></span><span className="hidden text-sm font-extrabold text-primary sm:inline">CineDoc AI</span><ThemeToggle /></div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="text-center">
          <span className="brand-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]"><HelpCircle className="h-3.5 w-3.5" /> Help center</span>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.055em] text-primary sm:text-5xl">Frequently asked questions</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-secondary">Clear answers about AI video creation, credits, narration, subtitles, editing, publishing, and supported formats.</p>
        </div>

        <section className="mt-10 space-y-3" aria-label="CineDoc AI questions and answers">
          {FAQS.map((item, index) => (
            <details key={item.question} className="surface-card group rounded-2xl p-5 sm:p-6">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-primary marker:hidden"><span><span className="mr-3 font-mono text-xs brand-text">{String(index + 1).padStart(2, '0')}</span>{item.question}</span><span className="text-xl font-light brand-text transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 border-t border-theme pt-4 text-sm leading-7 text-secondary">{item.answer}</p>
            </details>
          ))}
        </section>

        <section className="surface-raised mt-10 flex flex-col items-center justify-between gap-4 rounded-3xl p-7 text-center sm:flex-row sm:text-left">
          <div><h2 className="text-lg font-black text-primary">Ready to build a video?</h2><p className="mt-1 text-sm text-secondary">Open the studio and start with a topic or script.</p></div>
          <Link href="/" className="btn-primary"><Sparkles className="h-4 w-4" /> Start production</Link>
        </section>
      </main>
    </div>
  );
}
