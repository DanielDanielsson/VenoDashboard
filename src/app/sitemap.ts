import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.veno.local';
  const routes = [
    '',
    '/login',
    '/dashboard',
    '/dashboard/glucose',
    '/dashboard/settings',
    '/dashboard/integrations',
    '/dashboard/api-keys'
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.7
  }));
}
