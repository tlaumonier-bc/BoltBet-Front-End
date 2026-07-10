import { pages, launchablePages } from '@/lib/content/content';
import NavClient from './NavClient';

// Targeted countries: the live (authored) pages, falling back to all configured
// pages while copy is still being written.
const live = launchablePages();
const COUNTRIES = (live.length ? live : pages).map((p) => ({
  slug: p.slug,
  country: p.country,
  primaryKeyword: p.primaryKeyword,
}));

export default function Nav() {
  return <NavClient countries={COUNTRIES} />;
}