import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AuthProviderWrapper } from '@/components/AuthProviderWrapper';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  applicationName: 'CineDoc AI',
  title: {
    default: 'CineDoc AI | AI Documentary and Kids Video Studio',
    template: '%s | CineDoc AI',
  },
  description: 'Create AI documentaries and Kids & Family videos with scripts, visuals, narration, optional subtitles, timeline editing, and production-ready rendering.',
  keywords: ['AI documentary generator', 'AI kids video generator', 'text to video studio', 'AI narration', 'documentary maker', 'Kids & Family videos'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'CineDoc AI',
    title: 'CineDoc AI | AI Video Production Studio',
    description: 'Produce documentaries and Kids & Family stories with audience-aware visuals, narration, subtitles, and timeline editing.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CineDoc AI | AI Video Production Studio',
    description: 'Create complete AI documentaries and Kids & Family videos in one production workflow.',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#090a0e' },
  ],
};

const themeScript = `
  try {
    const saved = localStorage.getItem('cinedoc-theme');
    const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-full">
        <Script id="cinedoc-theme" strategy="beforeInteractive">{themeScript}</Script>
        <AuthProviderWrapper>{children}</AuthProviderWrapper>
      </body>
    </html>
  );
}
