'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { useLiveStore } from '@/store/liveStore';

type CountryItem = { slug: string; country: string; primaryKeyword: string };

export default function MobileMenuButton({ countries }: { countries: CountryItem[] }) {
  const [open, setOpen] = useState(false);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const setMode = useLiveStore((s) => s.setMode);
  const setSeoContentOpen = useLiveStore((s) => s.setSeoContentOpen);
  const setSelectedCountry = useLiveStore((s) => s.setSelectedCountry);
  const setMobileSheet = useLiveStore((s) => s.setMobileSheet);

  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setCountriesOpen(false);
  };

  const onPlay = () => {
    close();
    setSelectedCountry(null);
    setMode('game');
    setSeoContentOpen(false);
    setMobileSheet('game');
    if (pathname !== '/') router.push('/');
    posthog.capture('game_entered', { from_path: pathname });
  };

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex size-9 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/8 text-white transition hover:bg-white/15"
      >
        <span className="h-0.5 w-4 rounded-full bg-current" />
        <span className="h-0.5 w-4 rounded-full bg-current" />
        <span className="h-0.5 w-4 rounded-full bg-current" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(82vw,320px)] rounded-2xl border border-white/10 bg-storm/95 p-2 shadow-2xl backdrop-blur-xl">
          <Link
            href="/how-it-works"
            onClick={close}
            className="block rounded-xl px-3 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            How it works
          </Link>
          <Link
            href="/leaderboard"
            onClick={close}
            className="block rounded-xl px-3 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            Leaderboard
          </Link>

          <button
            type="button"
            onClick={() => setCountriesOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            <span>By country</span>
            <span className={`text-[10px] transition-transform ${countriesOpen ? 'rotate-180' : ''}`}>v</span>
          </button>
          {countriesOpen && (
            <div className="max-h-[32vh] overflow-y-auto rounded-xl bg-white/[0.04] p-1">
              {countries.map((country) => (
                <Link
                  key={country.slug}
                  href={country.slug}
                  onClick={close}
                  className="block rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                >
                  <span className="block text-sm font-medium text-white/90">{country.country}</span>
                  <span className="block text-[11px] text-white/40">{country.primaryKeyword}</span>
                </Link>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onPlay}
            className="btn-glow mt-2 w-full rounded-xl px-3 py-3 text-sm font-bold"
          >
            Play the game
          </button>
        </div>
      )}
    </div>
  );
}
