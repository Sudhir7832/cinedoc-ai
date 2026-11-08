import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, HelpCircle, Mail } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SupportCopyButton } from './SupportCopyButton';

export const metadata: Metadata = {
  title: 'Creator Support & Help Center | KinesisFlow',
  description: 'Need help with your video productions, credits, voiceovers, or commercial licensing? For any queries, write to support@kinesisflow.com.',
  alternates: { canonical: '/support' },
  openGraph: {
    title: 'KinesisFlow Creator Support',
    description: 'Direct assistance for AI video creation, credit packs, Sarvam AI Hindi narration, and billing. Contact support@kinesisflow.com.',
    type: 'website',
    url: '/support',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KinesisFlow Creator Support',
    description: 'Get help with documentary & kids video productions, credit packs, and technical queries at support@kinesisflow.com.',
    images: ['/opengraph-image'],
  },
};

const SUPPORT_CHANNELS = [
  {
    num: '01',
    category: 'PRODUCTION & MASTER RENDERING',
    title: 'Video Generation & Timeline Rendering',
    desc: 'Assistance with 10-scene narrative scripts, per-scene visual image regenerations, Ken Burns motion pacing, burned-in subtitle timing, and 1080p MP4 master downloads.',
    tags: ['Scene Re-rolls', '1080p Master MP4', 'Timeline Scene Swaps', 'Dual 16:9 YouTube Covers'],
    subject: 'Support Query: Video Production & Rendering',
    buttonLabel: 'Email Production Desk',
  },
  {
    num: '02',
    category: 'NEURAL AUDIO & VOICES',
    title: 'Voice Narration & Audio Ducking',
    desc: 'Guidance on authentic Sarvam AI conversational Hindi, deep documentary English voiceover, automatic -18.5dB background music ducking, and subtitle timing.',
    tags: ['Sarvam AI Hindi', 'Studio English', 'Ducked BGM (-18.5dB)', 'Karaoke Subtitles'],
    subject: 'Support Query: Neural Voices & Narration',
    buttonLabel: 'Email Audio Desk',
  },
  {
    num: '03',
    category: 'BILLING & INVOICES',
    title: 'Credit Packs, Dodo Payments & Invoices',
    desc: 'Inquiries regarding Creator ($5), Creator Pro ($19), and Studio ($39) credit balances, Dodo Payments checkout, card/UPI transactions, and official GST / VAT tax receipts.',
    tags: ['Dodo Payments', 'GST Invoices', 'Credit Balance', 'One-Time Packs'],
    subject: 'Support Query: Billing & Invoice Request',
    buttonLabel: 'Email Billing Desk',
  },
  {
    num: '04',
    category: 'MONETIZATION & RIGHTS',
    title: 'Commercial Ownership & YouTube AdSense Safety',
    desc: 'Guidance on YouTube AdSense monetization compliance, Content ID copyright clearance, dual 16:9 thumbnail A/B testing, and client broadcast licenses.',
    tags: ['100% Commercial Rights', 'YouTube AdSense Safe', 'Zero Copyright Claims', 'Client Deliverables'],
    subject: 'Support Query: Commercial Rights & Monetization',
    buttonLabel: 'Email Rights Desk',
  },
];

const COMMON_ISSUES = [
  {
    q: 'What should I do if a video render is interrupted or fails?',
    a: 'Credits are only deducted once your final 1080p MP4 is successfully generated and verified. If an error occurs, your reserved production credits are automatically released back to your available balance. You can safely retry from your project dashboard.',
  },
  {
    q: 'Can I regenerate a single scene without paying for the whole video again?',
    a: 'Yes! Open your project in the Timeline Editor before or after rendering. You can re-generate any individual scene image, tweak dialogue lines, or adjust durations without burning full video credits.',
  },
  {
    q: 'How do I obtain a tax invoice or business receipt for my purchase?',
    a: 'For any invoice requests, simply write to support@kinesisflow.com with your account email address and transaction ID. Our finance team will email your official GST / VAT receipt within 24 hours.',
  },
  {
    q: 'Where do I find my dual 16:9 YouTube thumbnails?',
    a: 'Every completed production generates two YouTube Studio-ready thumbnails (Hook Hero and Climax Peak). You can preview and download them directly from your project screen or download the complete master package.',
  },
];

export default function SupportPage() {
  return (
    <div className="app-shell min-h-screen">
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !px-3 text-xs">
            <ArrowLeft className="h-4 w-4" /> Back to studio
          </Link>
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5" aria-label="KinesisFlow home">
              <Logo size={32} />
              <span className="hidden text-sm font-extrabold text-primary sm:inline">KinesisFlow</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16 space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="brand-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]">
            <HelpCircle className="h-3.5 w-3.5" /> Creator Support &amp; Care
          </span>
          <h1 className="editorial-title mt-4 text-3xl sm:text-4xl lg:text-5xl text-primary font-normal leading-[1.08]">
            We&rsquo;re here to keep your productions moving.
          </h1>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-secondary">
            Need technical help, custom niche pipelines, billing receipts, or voice configuration? For any queries write <span className="font-bold text-primary">support@kinesisflow.com</span> and our team will assist you.
          </p>
        </div>

        {/* Primary Contact Action Card */}
        <section className="surface-card rounded-2xl sm:rounded-3xl border-2 border-[var(--app-brand)]/40 p-6 sm:p-9 shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-secondary">
                  Official Support Desk · support@kinesisflow.com
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
                For any queries write support@kinesisflow.com
              </h2>
              <p className="text-xs sm:text-sm text-secondary leading-relaxed pt-1">
                Whether you need help with video rendering, credit balance, Sarvam AI Hindi voiceovers, or official GST / business invoices, our team responds directly to your email. Include your registered account email and project ID if you have an active production in progress.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-secondary">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Support Active
                </span>
                <span>·</span>
                <span>Average reply: &lt; 24 hours</span>
                <span>·</span>
                <span>Monday – Saturday</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
              <a
                href="mailto:support@kinesisflow.com?subject=KinesisFlow%20Query%20Support"
                className="btn-primary !px-5 justify-center"
              >
                <Mail className="h-4 w-4" />
                Write to support@kinesisflow.com
              </a>
              <SupportCopyButton email="support@kinesisflow.com" />
            </div>
          </div>
        </section>

        {/* Support Channels Ledger - Unslop Editorial Broadsheet (Replaces AI-looking cards) */}
        <section aria-labelledby="support-topics-title">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
            <div>
              <p className="eyebrow mb-1">Direct Assistance Directory</p>
              <h2 id="support-topics-title" className="editorial-title text-2xl sm:text-3xl text-primary">
                Specialized support desks
              </h2>
            </div>
            <p className="text-xs text-secondary font-mono">
              All inquiries forward to: <strong className="text-primary font-semibold">support@kinesisflow.com</strong>
            </p>
          </div>

          <div className="surface-card border border-theme rounded-2xl sm:rounded-3xl divide-y divide-theme overflow-hidden shadow-sm">
            {SUPPORT_CHANNELS.map((channel) => (
              <div
                key={channel.num}
                className="p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition hover:bg-[var(--app-surface-soft)]/40"
              >
                <div className="flex items-start gap-4 sm:gap-5 max-w-2xl">
                  <span className="font-mono text-xs font-extrabold brand-text shrink-0 pt-0.5 select-none">
                    {channel.num}
                  </span>
                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary block">
                      {channel.category}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-primary mt-1 tracking-tight">
                      {channel.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-secondary leading-relaxed">
                      {channel.desc}
                    </p>
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                      {channel.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-theme/80 bg-[var(--app-surface-soft)] px-2.5 py-1 text-[11px] font-medium text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <a
                  href={`mailto:support@kinesisflow.com?subject=${encodeURIComponent(channel.subject)}`}
                  className="btn-secondary !text-xs shrink-0 self-start lg:self-center inline-flex items-center gap-1.5"
                >
                  {channel.buttonLabel} <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Resolution FAQ Accordion */}
        <section className="space-y-4" aria-labelledby="quick-answers-title">
          <div>
            <p className="eyebrow">Self Service</p>
            <h2 id="quick-answers-title" className="editorial-title text-2xl sm:text-3xl text-primary">
              Frequently resolved questions
            </h2>
          </div>

          <div className="space-y-3">
            {COMMON_ISSUES.map((issue) => (
              <details key={issue.q} className="surface-card group rounded-2xl p-5 border border-theme">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 text-xs sm:text-sm font-bold text-primary marker:hidden">
                  <span>{issue.q}</span>
                  <span className="text-xl font-light brand-text transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 border-t border-theme pt-3 text-xs sm:text-sm leading-relaxed text-secondary">
                  {issue.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA & Links */}
        <section className="surface-raised rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-theme">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-primary">Need more detailed documentation?</h2>
            <p className="mt-1 text-xs sm:text-sm text-secondary">
              Explore our full FAQ guide, review commercial terms, or jump back to the production studio.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link href="/faq" className="btn-secondary !text-xs">
              Read Video FAQ
            </Link>
            <Link href="/" className="btn-primary !text-xs">
              Back to Studio <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-theme bg-[var(--app-surface)] px-4 py-8 text-center text-xs text-secondary mt-12">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 KinesisFlow product. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link href="/" className="hover:text-primary transition">Studio</Link>
            <Link href="/about" className="hover:text-primary transition">About</Link>
            <Link href="/faq" className="hover:text-primary transition">FAQ</Link>
            <Link href="/terms" className="hover:text-primary transition">Terms</Link>
            <Link href="/privacy" className="hover:text-primary transition">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
