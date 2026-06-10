// The locale root (e.g. /fi/) redirects to that locale's primary map page
// (e.g. /fi/ukkostutka). This fixes the breadcrumb "home" target and gives a
// clean locale root without creating a duplicate-content competitor to the
// native-term page (which is the actual SEO target).

import { redirect, notFound } from 'next/navigation';
import { locales, primaryPageForLocale } from '@/lib/content/content';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleHome({ params }: { params: { locale: string } }) {
  const primary = primaryPageForLocale(params.locale);
  if (!primary) notFound();
  redirect(primary.slug);
}
