// app/sitemap.ts (REPLACES existing)
// Driven by the content config. Lists only INDEXABLE URLs:
//  - static pages (home, live, how-it-works, leaderboard)
//  - localized map pages that are translated (launchable)
// Untranslated localized pages appear automatically once authored (Phase 6).

import type { MetadataRoute } from 'next';
import { site, launchablePages, alternatesFor } from '@/lib/content/content';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = site.baseUrl;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
  ];

  const localeRoutes: MetadataRoute.Sitemap = launchablePages().map((p) => {
    // hreflang alternates for this page's cluster (excluding x-default, which
    // sitemap `alternates.languages` doesn't model the same way).
    const languages: Record<string, string> = {};
    for (const a of alternatesFor(p)) {
      if (a.hreflang !== 'x-default') languages[a.hreflang] = a.url;
    }
    return {
      url: `${base}${p.slug}`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
      alternates: { languages },
    };
  });

  return [...staticRoutes, ...localeRoutes];
}
