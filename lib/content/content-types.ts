// content-types.ts — shape of content/locales.json (generated in Phase 1).
// Drop into the frontend repo at lib/content/content-types.ts.
// Do not edit locales.json by hand; re-run generate_content_config.py.

export type IntentTier = 'lightning' | 'storm' | 'product';
export type PageType = 'seo_map' | 'seo_storm' | 'product_funnel';
export type KeywordRole = 'primary' | 'secondary';

export interface Keyword {
  term: string;
  role: KeywordRole;
  volume: number | null; // monthly searches
  kd: number | null;     // keyword difficulty 0–100
  tier: string | null;
  isBrand: boolean;      // brand/English/misspelling vs native category word
}

export interface LeadSecondary {
  term: string;
  kd: number;
  volume: number | null;
}

export interface ContentSection {
  h2: string;
  body: string;
  isFunnel?: boolean;  // the "guess the next 60s" block that links to /play
  ctaText?: string;
  ctaPrompt?: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface PageContent {
  translated: boolean;    // false => English skeleton, copy not yet authored
  breadcrumb: string[];
  h1: string;
  title: string;          // <title> tag
  metaDescription: string;
  imageAlt: string;
  sections: ContentSection[];
  faq: FaqItem[];
  faqHeading?: string;
}

export interface LocalePage {
  priority: number;       // build order (1 = Finland flagship)
  locale: string;         // 'fi', 'gb', ...
  localePath: string;     // '/fi'
  country: string;
  language: string;
  hreflang: string;       // BCP-47, e.g. 'fi-FI'
  slug: string;           // '/fi/ukkostutka'
  pageType: PageType;
  intentTier: IntentTier;
  hreflangClusterKey: string; // which cluster this page's alternates come from
  primaryKeyword: string;
  primaryKeywordOriginal: string; // pre-reconciliation, for audit
  primaryVolume: number | null;
  primaryKd: number | null;
  leadSecondary: LeadSecondary | null; // term to feature in an early H2
  keywords: Keyword[];
  content: PageContent;
}

export interface HreflangEntry {
  hreflang: string; // 'fi-FI' or 'x-default'
  url: string;      // absolute
}

/** Clusters keyed by page type ('seo_map', 'seo_storm'): equivalent pages,
 *  one URL per language code. */
export type HreflangClusters = Record<string, HreflangEntry[]>;

export interface Funnel {
  slug: string;        // '/{locale}/play'
  pageType: 'product_funnel';
  note: string;
  renamedFrom: string; // '/{locale}/predict'
  seo: false;
}

export interface SiteMeta {
  brand: string;
  domain: string;
  baseUrl: string;
}

export interface ContentConfig {
  site: SiteMeta;
  funnel: Funnel;
  hreflangClusters: HreflangClusters;
  pages: LocalePage[];
}
