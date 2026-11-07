import type { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';
import { getSiteUrl, PRODUCT_NAME } from '@/lib/brand';

const description = 'Turn one topic into documentaries, kids videos, and viral YouTube content. Auto-generates scripts, cinematic visuals, neural voiceover, subtitles, and dual high-CTR 16:9 YouTube thumbnails.';

export const metadata: Metadata = {
  title: { absolute: 'KinesisFlow | Turn Topics Into Documentaries, Kids Videos & Viral YouTube Content' },
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'KinesisFlow | Turn Topics Into Documentaries, Kids Videos & Viral YouTube Content',
    description,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KinesisFlow | Turn Topics Into Documentaries, Kids Videos & Viral YouTube Content',
    description,
    images: ['/opengraph-image'],
  },
};

export default function HomePage() {
  const siteUrl = getSiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Brand',
        '@id': `${siteUrl}/#brand`,
        name: PRODUCT_NAME,
        url: siteUrl,
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: PRODUCT_NAME,
        url: siteUrl,
        description,
        about: { '@id': `${siteUrl}/#brand` },
        inLanguage: 'en',
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/#software`,
        name: PRODUCT_NAME,
        url: siteUrl,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        description,
        featureList: [
          'Faceless YouTube channel automation and workflows',
          'Dual high-CTR 16:9 YouTube thumbnail generation for A/B testing',
          'Documentary-style and Kids & Family video workflows',
          'Topic-to-script and custom-script creation with review step',
          'AI-assisted scene visuals with Ken Burns motion and neural voiceover',
          'Timed burned-in subtitles and multi-language support (English & Hindi)',
          'Scene and timeline editing without rebuilding projects',
          'Landscape 16:9 and vertical 9:16 1080p MP4 rendering',
        ],
        brand: { '@id': `${siteUrl}/#brand` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <HomeClient />
    </>
  );
}
