import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Served at /robots.txt. Lets search engines and AI crawlers index public pages, keeps them out of
// private/account pages, and points them at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/admin', '/auth', '/api', '/claim', '/messages', '/orders', '/favorites', '/lists', '/watchlist']
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
