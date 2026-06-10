import { redirect, notFound } from 'next/navigation';
import { locales, primaryPageForLocale } from '@/lib/content/content';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const primary = primaryPageForLocale(locale);
  if (!primary) notFound();
  redirect(primary.slug);
}