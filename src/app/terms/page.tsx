import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

const description = 'Terms governing use of KinesisFlow, AI-assisted video generation, user responsibilities, credits, providers, and service limitations.';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description,
  alternates: { canonical: '/terms' },
  openGraph: { type: 'website', url: '/terms', title: 'KinesisFlow Terms and Conditions', description, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: 'KinesisFlow Terms and Conditions', description, images: ['/opengraph-image'] },
};

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body: 'By accessing or using the KinesisFlow product, software, APIs, and rendering infrastructure (collectively, the “Service”), you agree to these Terms and Conditions. If you do not agree, you may not use the Service.',
  },
  {
    title: 'AI Generation and Output Rights',
    body: 'Rights in generated output can depend on applicable law and third-party provider terms. KinesisFlow does not guarantee that output is unique, protectable, accurate, or free of third-party rights.',
    bullets: [
      'You may distribute, monetize, and publish generated media across creator platforms, broadcasts, and client campaigns.',
      'You are responsible for ensuring prompts and supplied assets do not violate copyright, trademark, privacy, or publicity rights.',
    ],
  },
  {
    title: 'Credit System and Billing',
    body: 'Generation cost is based on duration and scene count. Credits are reserved when a job starts and deducted progressively as scripts, images, narration, premium video scenes, and the final render are completed and stored.',
    bullets: [
      'Purchased credit balances remain available until redeemed.',
      'If you stop a job or generation fails, credits already used for completed work remain charged and only the unused reservation is released.',
    ],
  },
  {
    title: 'Acceptable Use and Prohibited Content',
    body: 'You agree to use KinesisFlow responsibly and lawfully and to review generated output before publication.',
    bullets: [
      'Do not create defamatory, fraudulent, malicious, or non-consensual deepfake media.',
      'Do not create content promoting hate, unlawful violence, exploitation, or illegal activity.',
      'Do not reverse engineer, disrupt, or intentionally overload system rendering workers.',
    ],
  },
  {
    title: 'Service Availability and Providers',
    body: 'Rendering depends on deployment infrastructure and third-party AI providers. KinesisFlow operates on a best-effort basis and cannot guarantee uninterrupted availability during upstream outages, rate limits, or maintenance.',
  },
];

export default function TermsPage() {
  return (
    <div className="app-shell min-h-screen">
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !px-3 text-xs"><ArrowLeft className="h-4 w-4" /> Back to studio</Link>
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5" aria-label="KinesisFlow home">
              <Logo size={32} />
              <span className="hidden text-sm font-extrabold text-primary sm:inline">KinesisFlow</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <span className="brand-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]"><FileText className="h-3.5 w-3.5" /> Legal agreement</span>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-primary sm:text-4xl">Terms and Conditions</h1>
          <p className="mt-2 text-sm text-secondary">Last updated October 29, 2026 · Effective immediately</p>
        </div>


        <div className="space-y-4">
          {SECTIONS.map((section, index) => (
            <section key={section.title} className="surface-card rounded-3xl p-6 sm:p-8">
              <h2 className="flex items-center gap-3 text-lg font-extrabold text-primary"><span className="font-mono text-sm brand-text">{String(index + 1).padStart(2, '0')}.</span>{section.title}</h2>
              <p className="mt-4 text-sm leading-7 text-secondary">{section.body}</p>
              {section.bullets && (
                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-secondary">
                  {section.bullets.map(item => <li key={item} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-brand)]" />{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-theme bg-[var(--app-surface)] px-4 py-6 text-center text-xs text-secondary">
        © 2026 KinesisFlow product · <Link href="/privacy" className="font-semibold brand-text hover:underline">Privacy Policy</Link> · <Link href="/about" className="font-semibold brand-text hover:underline">About</Link>
      </footer>
    </div>
  );
}
