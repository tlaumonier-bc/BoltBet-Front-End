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

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = pageBySlug(`/${locale}/${slug}`);
  return page ? buildMetadata(page) : { title: 'Not found' };
}

export default async function LocaleMapPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const page = pageBySlug(`/${locale}/${slug}`);
  if (!page) notFound();
  return <SeoMapPage page={page} />;
}