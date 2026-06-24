import type {
  ContentConfig,
  LocalePage,
  HreflangEntry,
  HreflangClusters,
} from './content-types';
import raw from './locales.json';
 
const config = raw as unknown as ContentConfig;
 
export const site = config.site;
export const funnel = config.funnel;
export const hreflangClusters: HreflangClusters = config.hreflangClusters;
 
/** All localized SEO pages, in build-priority order. */
export const pages: LocalePage[] = config.pages;
 
/** Only pages whose native copy is authored (safe to index/launch). */
export const launchablePages = (): LocalePage[] =>
  pages.filter((p) => p.content.translated);
 
/** Look up a page by full slug, e.g. '/fi/ukkostutka'. */
export const pageBySlug = (slug: string): LocalePage | undefined =>
  pages.find((p) => p.slug === slug);
 
/** Unique locale segments, e.g. ['fi','gb',...]. */
export const locales: string[] = Array.from(new Set(pages.map((p) => p.locale)));
 
/**
 * The primary (highest build-priority) page for a locale — what `/{locale}/`
 * redirects to, so the locale root never 404s and breadcrumbs resolve.
 */
export const primaryPageForLocale = (locale: string): LocalePage | undefined => {
  const loc = locale.toLowerCase();
  return pages
    .filter((p) => p.locale === loc)
    .sort((a, b) => a.priority - b.priority)[0];
};
 
/**
 * hreflang <link> alternates for a page: its own cluster (the equivalent map —
 * or storm — page in each other locale) + x-default. Clustering by page type
 * keeps one URL per language code, which is what lets each native term rank in
 * its own market without cannibalization.
 */
export const alternatesFor = (page: LocalePage): HreflangEntry[] =>
  hreflangClusters[page.hreflangClusterKey] ?? [];
 
/** Absolute canonical URL for a page. */
export const canonicalFor = (page: LocalePage): string =>
  site.baseUrl + page.slug;

/** One entry per language in this page's hreflang cluster, resolved to its
 *  LocalePage so the UI has flag/country/language without extra lookups.
 *  Excludes x-default. Used by the language switcher + suggestion banner. */
export interface LanguageAlternate {
  hreflang: string; // 'fi-FI'
  lang: string;     // 'fi' (subtag)
  locale: string;   // 'fi' (also the ISO-2 country code here → flag)
  country: string;  // 'Finland'
  language: string; // 'Finnish'
  slug: string;     // '/fi/ukkostutka'
  url: string;      // absolute
  isCurrent: boolean;
}

export const languageAlternatesFor = (page: LocalePage): LanguageAlternate[] => {
  const base = site.baseUrl;
  const out: LanguageAlternate[] = [];
  for (const a of alternatesFor(page)) {
    if (a.hreflang === 'x-default') continue;
    const slug = a.url.startsWith(base) ? a.url.slice(base.length) : a.url;
    const p = pageBySlug(slug);
    if (!p) continue; // cluster entry with no matching page — skip defensively
    out.push({
      hreflang: a.hreflang,
      lang: a.hreflang.split('-')[0].toLowerCase(),
      locale: p.locale,
      country: p.country,
      language: p.language,
      slug: p.slug,
      url: a.url,
      isCurrent: p.slug === page.slug,
    });
  }
  return out;
};