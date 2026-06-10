// app/[locale]/[slug]/page.tsx
// One dynamic route generates all 25 localized SEO map pages from the content
// config. Mirrors the repo's existing route style (sync params, static params,
// dynamicParams=false) for drop-in compatibility — verify against the installed
// Next version per AGENTS.md (async params differ across majors).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pages, pageBySlug } from '@/lib/content/content';
import { buildMetadata } from '@/lib/seo/metadata';
import SeoMapPage from '@/components/seo/SeoMapPage';

export const dynamicParams = false;

export function generateStaticParams() {
  return pages.map((p) => ({ locale: p.locale, slug: p.slug.split('/').pop()! }));
}

type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = pageBySlug(`/${params.locale}/${params.slug}`);
  return page ? buildMetadata(page) : { title: 'Not found' };
}

export default function LocaleMapPage({ params }: { params: Params }) {
  const page = pageBySlug(`/${params.locale}/${params.slug}`);
  if (!page) notFound();
  return <SeoMapPage page={page} />;
}
