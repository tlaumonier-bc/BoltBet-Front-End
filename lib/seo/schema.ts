// lib/seo/schema.ts — JSON-LD builders for the localized map pages.
// Output is injected via a <script type="application/ld+json"> in the template.

import type { LocalePage } from '@/lib/content/content-types';
import { site, canonicalFor } from '@/lib/content/content';

export function faqSchema(page: LocalePage) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.content.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbSchema(page: LocalePage) {
  const base = site.baseUrl;
  const crumbs = page.content.breadcrumb;
  // First crumb = locale home; last crumb = this page.
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((name, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item:
        i === crumbs.length - 1
          ? canonicalFor(page)
          : `${base}${page.localePath}`, // locale root (redirects to primary page)
    })),
  };
}

/** Combine the page's structured data into one array for a single script tag. */
export function pageJsonLd(page: LocalePage) {
  return [breadcrumbSchema(page), faqSchema(page)];
}
