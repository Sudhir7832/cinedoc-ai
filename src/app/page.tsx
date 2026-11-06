import type { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';
import { getSiteUrl, PRODUCT_NAME } from '@/lib/brand';

const description = 'Create documentary-style videos and Kids & Family videos from a topic or script with AI-assisted scenes, narration, optional subtitles, timeline editing, and MP4 rendering.';

export const metadata: Metadata = {
  title: { absolute: 'KinesisFlow | Documentary and Kids Video Creator' },
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'KinesisFlow | Documentary and Kids Video Creator',
    description,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KinesisFlow | Documentary and Kids Video Creator',
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
          'Documentary-style and Kids & Family video workflows',
          'Topic-to-script and custom-script creation',
          'AI-assisted scene visuals and narration',
          'Optional burned-in subtitles',
          'Scene and timeline editing',
          'Landscape and one-minute vertical MP4 rendering',
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
