// lib/seo/metadata.ts — build Next Metadata from a LocalePage.
// Drives <title>, description, canonical and Open Graph.

import type { Metadata } from 'next';
import type { LocalePage } from '@/lib/content/content-types';
import { site, canonicalFor } from '@/lib/content/content';

export function buildMetadata(page: LocalePage): Metadata {
  const canonical = canonicalFor(page);

  // Untranslated placeholder pages must NOT be indexed until copy is authored
  // (Phase 6), or Google sees thin English duplicates across locales.
  const indexable = page.content.translated;

  // By default, country pages are canonical local landing pages with no hreflang
  // alternates (France and the UK are not equivalent translations). A page may
  // opt into cross-language linking via `hreflangAlternates` — e.g. the
  // reciprocal /gb/lightning-map ↔ /ph/mapa-ng-kidlat pair, with x-default → UK.
  const languages = page.hreflangAlternates?.length
    ? Object.fromEntries(page.hreflangAlternates.map((a) => [a.hreflang, a.url]))
    : undefined;

  return {
    title: page.content.title,
    description: page.content.metaDescription,
    alternates: languages ? { canonical, languages } : { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: site.brand,
      title: page.content.ogTitle ?? page.content.title,
      description: page.content.metaDescription,
      url: canonical,
      locale: page.hreflang.replace('-', '_'),
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: page.content.imageAlt }],
    },
    twitter: { card: 'summary_large_image' },
  };
}
