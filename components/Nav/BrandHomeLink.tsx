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
      className="font-display text-base font-bold tracking-tight"
    >
      <span className="text-bolt">⚡</span> Lightning Map Game
    </Link>
  );
}
