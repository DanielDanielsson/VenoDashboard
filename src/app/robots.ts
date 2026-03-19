import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.veno.local';

  return {
    rules: {
      userAgent: '*',
      disallow: '/'
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
