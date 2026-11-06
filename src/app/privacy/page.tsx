import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clapperboard, Database, Eye, Lock, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LEGAL_OPERATOR } from '@/lib/brand';

const description = 'How KinesisFlow handles account data, project inputs, generated media, payment references, and configured third-party processors.';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description,
  alternates: { canonical: '/privacy' },
  openGraph: { type: 'website', url: '/privacy', title: 'KinesisFlow Privacy Policy', description, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: 'KinesisFlow Privacy Policy', description, images: ['/opengraph-image'] },
};

const PRIVACY_SECTIONS = [
  {
    icon: Eye,
    title: 'Information We Collect',
    body: 'We collect the minimum information needed to manage accounts, process video jobs, and maintain credit and payment records.',
    bullets: [
      'Account information such as email, display name, hashed credentials, or an authenticated identity-provider ID.',
      'Project inputs such as topics, scripts, audience format, narration settings, generated scenes, and media paths.',
      'Payment references and credit-ledger entries. Raw card numbers are handled by the selected payment gateway and are not stored by KinesisFlow.',
    ],
  },
  {
    icon: Database,
    title: 'Project and Media Storage',
    body: 'Generated images, narration files, subtitles, and rendered videos are stored for project delivery and editing. Administrators may also publish selected testimonial videos to the public showcase.',
    bullets: [
      'Project content is processed under the terms and data-handling policies of the configured AI providers; review those policies before submitting sensitive material.',
      'Deleting a project removes its locally managed generated files where supported by the deployment.',
    ],
  },
  {
    icon: Lock,
    title: 'Providers and Processors',
    body: 'The service may send the content required for generation or payment processing to configured third-party providers.',
    bullets: [
      'AI providers may include Cloudflare, OpenRouter, Puter, Microsoft Neural voices, and Sarvam AI.',
      'Authentication and account sessions are provided through the configured Supabase deployment.',
      'Payments may be processed by enabled gateways such as Stripe, Razorpay, or Dodo Payments.',
    ],
  },
  {
    icon: Shield,
    title: 'Your Rights and Controls',
    body: 'You can delete individual projects from the studio. You may also request access to, correction of, export of, or deletion of account data subject to legal and operational retention requirements.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="app-shell min-h-screen">
      <header className="app-header sticky top-0 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !px-3 text-xs"><ArrowLeft className="h-4 w-4" /> Back to studio</Link>
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-text)] text-[var(--app-surface)]"><Clapperboard className="h-4 w-4" /></span><span className="hidden text-sm font-extrabold text-primary sm:inline">KinesisFlow</span><ThemeToggle /></div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <span className="accent-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]"><Shield className="h-3.5 w-3.5" /> Data privacy and security</span>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-primary sm:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-secondary">Last updated October 29, 2026 · How creative assets and account data are handled</p>
        </div>

        <div className="mb-4 rounded-2xl border border-[var(--app-warning)] bg-[var(--app-warning-soft)] p-4 text-sm leading-6 text-[var(--app-warning)]">
          <strong className="block">Release-blocking operator notice</strong>
          The legal operator is not yet confirmed. Current placeholder: {LEGAL_OPERATOR}. This policy must be reviewed and updated with operator identity and contact details before launch.
        </div>

        <div className="space-y-4">
          {PRIVACY_SECTIONS.map((section, index) => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="surface-card rounded-3xl p-6 sm:p-8">
                <h2 className="flex items-center gap-3 text-lg font-extrabold text-primary"><span className="brand-soft flex h-9 w-9 items-center justify-center rounded-xl"><Icon className="h-4 w-4" /></span><span><span className="mr-2 font-mono text-xs brand-text">{String(index + 1).padStart(2, '0')}</span>{section.title}</span></h2>
                <p className="mt-4 text-sm leading-7 text-secondary">{section.body}</p>
                {section.bullets && <ul className="mt-4 space-y-2.5">{section.bullets.map(item => <li key={item} className="flex gap-3 text-sm leading-6 text-secondary"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[var(--app-success)]" />{item}</li>)}</ul>}
              </section>
            );
          })}
        </div>
      </main>

      <footer className="border-t border-theme bg-[var(--app-surface)] px-4 py-6 text-center text-xs text-secondary">© 2026 KinesisFlow product · <Link href="/terms" className="font-semibold brand-text hover:underline">Terms and Conditions</Link> · <Link href="/about" className="font-semibold brand-text hover:underline">About</Link></footer>
    </div>
  );
}
