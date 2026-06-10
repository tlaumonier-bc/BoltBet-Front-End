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
 
/** Look up a page by its locale segment, e.g. 'fi'. */
export const pageByLocale = (locale: string): LocalePage | undefined =>
  pages.find((p) => p.locale === locale.toLowerCase());
 
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
 
/** The funnel destination for a locale, e.g. '/fi/play'. */
export const playHrefFor = (page: LocalePage): string =>
  funnel.slug.replace('{locale}', page.locale);