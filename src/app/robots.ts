import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/admin/', '/api/', '/auth/', '/sign-in', '/sign-in/', '/sign-up', '/sign-up/', '/generated/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
