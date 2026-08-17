'use client';

import Link from 'next/link';
import BrandHomeLink from './BrandHomeLink';
import CountryMenu from './CountryMenu';
import SnapMarketsLink from './SnapMarketsLink';
import MobileMenuButton from './MobileMenuButton';
import PlayButton from './PlayButton';
import UiLanguageSwitcher from '@/components/i18n/UiLanguageSwitcher';
import { useT } from '@/lib/i18n/ui';

type CountryItem = { slug: string; country: string; primaryKeyword: string };

export default function NavClient({ countries }: { countries: CountryItem[] }) {
  const { t } = useT();

  return (
    <nav className="fixed left-1/2 top-2 z-50 w-[min(1040px,96vw)] -translate-x-1/2 sm:top-4 sm:w-[min(1080px,94vw)]">
      <div className="glass flex items-center justify-between gap-2 rounded-2xl px-3 py-2 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-5 md:gap-[30px]">
          <BrandHomeLink />
          <UiLanguageSwitcher className="shrink-0" />
        </div>
        <div className="flex min-w-0 items-center gap-1 text-xs text-white/60 sm:text-sm">
          <div className="hidden md:block">
            <CountryMenu countries={countries} />
          </div>
          <Link href="/how-it-works" className="hidden whitespace-nowrap rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white sm:block">
            {t('nav.howItWorks')}
          </Link>
          <Link href="/leaderboard" className="hidden whitespace-nowrap rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white sm:block">
            {t('nav.leaderboard')}
          </Link>
          <SnapMarketsLink />
          <div className="hidden sm:block">
            <PlayButton />
          </div>
          <MobileMenuButton countries={countries} />
        </div>
      </div>
    </nav>
  );
}
