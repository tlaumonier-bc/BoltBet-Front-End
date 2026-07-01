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
      className="font-display min-w-0 text-sm font-bold tracking-tight sm:text-base"
    >
      <span className="text-bolt">⚡</span>
      <span className="ml-1 sm:hidden">Lightning</span>
      <span className="ml-1 hidden sm:inline">Lightning Map Game</span>
    </Link>
  );
}
