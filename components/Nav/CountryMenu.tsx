'use client';
// components/Nav/CountryMenu.tsx
// "By country" dropdown. Opens on hover (mouse) and on tap (touch). All country
// links stay in the DOM even when closed — only the panel's visibility toggles —
// so crawlers always see them.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Item = { slug: string; country: string; primaryKeyword: string };

export default function CountryMenu({ countries }: { countries: Item[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
      >
        By country
        <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Centered under the trigger. The pt-2 (padding, not margin) keeps the
          panel hover-connected to the button so the mouse never crosses a gap. */}
      <div
        className={`absolute left-1/2 top-full -translate-x-1/2 pt-2 transition ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0'
        }`}
      >
        <div className="glass max-h-[60vh] w-[min(520px,86vw)] overflow-y-auto rounded-2xl p-2">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {countries.map((c) => (
              <Link
                key={c.slug}
                href={c.slug}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
              >
                <span className="block text-sm font-medium text-white/90">{c.country}</span>
                <span className="block text-[11px] text-white/40">{c.primaryKeyword}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}