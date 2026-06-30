import Link from 'next/link';
import BrandHomeLink from './BrandHomeLink';
import CountryMenu from './CountryMenu';
import GridGameButton from './GridGameButton';
import PlayButton from './PlayButton';
import { pages, launchablePages } from '@/lib/content/content';

// Targeted countries: the live (authored) pages, falling back to all configured
// pages while copy is still being written.
const live = launchablePages();
const COUNTRIES = (live.length ? live : pages).map((p) => ({
  slug: p.slug,
  country: p.country,
  primaryKeyword: p.primaryKeyword,
}));

export default function Nav() {
  return (
    <nav className="fixed left-1/2 top-4 z-50 w-[min(960px,92vw)] -translate-x-1/2">
      <div className="glass flex items-center justify-between rounded-2xl px-5 py-3">
        <BrandHomeLink />
        <div className="flex items-center gap-1 text-sm text-white/60">
          <CountryMenu countries={COUNTRIES} />
          <Link href="/how-it-works" className="rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white">
            How it works
          </Link>
          <Link href="/leaderboard" className="rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white">
            Leaderboard
          </Link>
          <GridGameButton />
          <PlayButton />
        </div>
      </div>
    </nav>
  );
}