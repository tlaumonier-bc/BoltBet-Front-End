'use client';

import Link from 'next/link';
import { useLiveStore } from '@/store/liveStore';

export default function BrandHomeLink() {
  const seoContentOpen = useLiveStore((s) => s.seoContentOpen);
  const setSeoContentOpen = useLiveStore((s) => s.setSeoContentOpen);

  return (
    <Link
      href="/"
      onClick={(event) => {
        if (!seoContentOpen) return;
        event.preventDefault();
        setSeoContentOpen(false);
      }}
      className="min-w-0"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="text-bolt leading-none">⚡</span>
        <span className="min-w-0 leading-none">
          <span className="font-display block truncate text-sm font-bold tracking-tight sm:text-base">
            Lightning Map Game
          </span>
          <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45 sm:text-[10px]">
            Real time live lightning map
          </span>
        </span>
      </span>
    </Link>
  );
}
