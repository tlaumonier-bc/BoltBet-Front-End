// app/page.tsx (REPLACES existing) — map-first landing.
// Decision (Phase 0): lead with the fast 2D map, not the heavy globe, and not
// betting-forward. The globe lives on /live and /{locale}/play.

import Link from 'next/link';
import LightningMap2D from '@/components/map/LightningMap2D';
import { WORLD_BOUNDS } from '@/lib/map/countryBounds';
import { pages } from '@/lib/content/content';

const POPULAR = pages.slice(0, 8); // first 8 by build priority

export default function HomePage() {
  return (
    <main className="relative min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-28">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white/80">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-bolt shadow-[0_0_10px_#fde047]" />
          Live · real-time strikes worldwide
        </span>

        <h1 className="font-display mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          See lightning strike the Earth, <span className="text-gradient">live</span>.
        </h1>

        <p className="mt-5 max-w-xl text-base text-white/65 sm:text-lg">
          A real-time map of lightning worldwide, built on the Blitzortung detection
          network. Watch the storms move — then guess whether more or fewer bolts hit
          in the next 60 seconds. Free to play, no real money.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/live" className="btn-glow rounded-full px-8 py-3.5 text-sm font-bold">
            Open the live map →
          </Link>
          <Link
            href="/play"
            className="glass rounded-full px-8 py-3.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Play the 60-second game
          </Link>
        </div>

        {/* the map IS the hero */}
        <LightningMap2D bounds={WORLD_BOUNDS} className="mt-10 h-[60vh] min-h-[380px]" />
        <p className="mt-2 text-xs text-white/40">
          Live strike data from the Blitzortung community detection network.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-4">
          {[
            ['162', 'live zones'],
            ['Real-time', 'lightning data'],
            ['Free', 'to play'],
          ].map(([big, small]) => (
            <div key={small}>
              <div className="font-display text-2xl font-bold text-white">{big}</div>
              <div className="text-xs uppercase tracking-widest text-white/40">{small}</div>
            </div>
          ))}
        </div>

        {/* internal links to localized maps */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-bold">Lightning maps by country</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {POPULAR.map((p) => (
              <Link
                key={p.slug}
                href={p.slug}
                className="glass rounded-xl px-4 py-3 text-sm transition hover:bg-white/[0.06]"
              >
                <span className="font-medium">{p.country}</span>
                <span className="ml-2 text-white/45">{p.primaryKeyword}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-electric/80 hover:text-electric"
          >
            How the lightning map and the 60-second game work →
          </Link>
        </section>
      </div>
    </main>
  );
}
