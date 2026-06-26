// app/sitemap.ts (REPLACES existing)
// Driven by the content config. Lists only INDEXABLE URLs:
//  - static pages (home, live, how-it-works, leaderboard)
//  - localized map pages that are translated (launchable)
// Untranslated localized pages appear automatically once authored (Phase 6).

import type { MetadataRoute } from 'next';
import { site, launchablePages } from '@/lib/content/content';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = site.baseUrl;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
  ];

  const localeRoutes: MetadataRoute.Sitemap = launchablePages().map((p) => ({
    url: `${base}${p.slug}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...localeRoutes];
}
