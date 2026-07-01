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
    <nav className="fixed left-1/2 top-2 z-50 w-[min(960px,94vw)] -translate-x-1/2 sm:top-4 sm:w-[min(960px,92vw)]">
      <div className="glass flex items-center justify-between gap-2 rounded-2xl px-3 py-2 sm:px-5 sm:py-3">
        <BrandHomeLink />
        <div className="flex min-w-0 items-center gap-1 text-xs text-white/60 sm:text-sm">
          <div className="hidden md:block">
            <CountryMenu countries={COUNTRIES} />
          </div>
          <Link href="/how-it-works" className="hidden rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white sm:block">
            How it works
          </Link>
          <Link href="/leaderboard" className="hidden rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white sm:block">
            Leaderboard
          </Link>
          <GridGameButton />
          <PlayButton />
        </div>
      </div>
    </nav>
  );
}