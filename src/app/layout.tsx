
import type { Metadata, Viewport } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AuthProviderWrapper } from '@/components/AuthProviderWrapper';
import { CookieConsent } from '@/components/CookieConsent';
import { ScrollRestorationFix } from '@/components/ScrollRestorationFix';
import { assertLaunchConfiguration, getSiteUrl } from '@/lib/brand';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: 'KinesisFlow',
  title: {
    default: 'KinesisFlow | Documentary and Kids Video Creator',
    template: '%s | KinesisFlow',
  },
  description: 'Create documentary-style videos and Kids & Family videos with AI-assisted scripts, visuals, narration, optional subtitles, timeline editing, and MP4 rendering.',
  keywords: ['AI documentary generator', 'AI kids video generator', 'text to video studio', 'AI narration', 'documentary maker', 'Kids & Family videos'],
  openGraph: {
    type: 'website',
    siteName: 'KinesisFlow',
    title: 'KinesisFlow | Documentary and Kids Video Creator',
    description: 'Create documentary-style and Kids & Family videos with guided visuals, narration, subtitles, and timeline editing.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'KinesisFlow documentary and Kids & Family video creator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KinesisFlow | Documentary and Kids Video Creator',
    description: 'Create documentary-style and Kids & Family videos in one guided workflow.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f1ec' },
    { media: '(prefers-color-scheme: dark)', color: '#11120f' },
  ],
};

const themeScript = `
  try {
    const saved = localStorage.getItem('kinesisflow-theme') || localStorage.getItem('cinedoc-theme');
    if (saved && !localStorage.getItem('kinesisflow-theme')) localStorage.setItem('kinesisflow-theme', saved);
    const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  assertLaunchConfiguration();
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) for GA4 Measurement ID: G-Z7HJRVY5CP */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z7HJRVY5CP" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-Z7HJRVY5CP', {
  page_path: window.location.pathname,
});`,
          }}
        />
        {/* Google Tag Manager container */}
        <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-53JXZ5LW" />
      </head>
      <body className="min-h-full">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-53JXZ5LW"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Script id="kinesisflow-theme" strategy="beforeInteractive">{themeScript}</Script>
        <ScrollRestorationFix />
        <AuthProviderWrapper>
          {children}
          <CookieConsent />
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
