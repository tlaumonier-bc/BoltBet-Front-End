// lib/globe/countryLinks.ts
// One clickable CountryLink per targeted country (the primary page for each
// locale). Shared by both the homepage and the SEO routes so the globe behaves
// identically on each. Type-only import of CountryLink keeps Cesium out of the
// client bundle here.
import type { CountryLink } from '@/lib/globe/countryBorders';
import type { LocalePage } from '@/lib/content/content-types';
import { pages, launchablePages } from '@/lib/content/content';
import { boundsForLocale } from '@/lib/map/countryBounds';

export function buildCountryLinks(): CountryLink[] {
  const live = launchablePages();
  const source = live.length ? live : pages;

  // Keep the primary (lowest-priority) page per locale, so multi-page
  // countries (e.g. Poland) resolve to one canonical destination.
  const byLocale = new Map<string, LocalePage>();
  for (const p of source) {
    const existing = byLocale.get(p.locale);
    if (!existing || p.priority < existing.priority) byLocale.set(p.locale, p);
  }

  return [...byLocale.values()].map((p) => {
    const b = boundsForLocale(p.locale);
    return {
      iso: p.locale,
      names: [p.country, b.label].filter(Boolean) as string[],
      slug: p.slug,
      center: { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2 },
      label: b.label,
    };
  });
}