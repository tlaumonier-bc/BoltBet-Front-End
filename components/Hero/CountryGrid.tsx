'use client';
// components/Hero/CountryGrid.tsx
// Shows the first 8 country links + a "more" tile. Clicking "more" reveals the
// rest. IMPORTANT for SEO: every link is always rendered in the DOM — the
// overflow tiles are only hidden with CSS (display:none) when collapsed — so
// crawlers see all country pages even before the user expands.

import { useState } from 'react';
import Link from 'next/link';

type Item = { slug: string; country: string; primaryKeyword: string };

const VISIBLE = 8;

export default function CountryGrid({ countries }: { countries: Item[] }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = countries.length - VISIBLE;

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {countries.map((p, i) => (
        <Link
          key={p.slug}
          href={p.slug}
          className={`glass rounded-xl px-4 py-3 text-sm transition ${
            !expanded && i >= VISIBLE ? 'hidden' : ''
          }`}
        >
          <span className="font-medium">{p.country}</span>
          <span className="ml-2 text-white/45">{p.primaryKeyword}</span>
        </Link>
      ))}

      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Show ${hiddenCount} more countries`}
          className="glass rounded-xl px-4 py-3 text-left text-sm font-semibold text-electric/90 transition hover:cursor-pointer"
        >
          + {hiddenCount} more →
        </button>
      )}
    </div>
  );
}
