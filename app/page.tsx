// app/page.tsx — landing page.
// The first viewport is the full /live experience: the view-only globe + the
// LiveHUD console. Wheel zoom is off so scrolling moves down the page; users
// zoom with the on-globe +/− buttons or by double-clicking.
//
// The `transform` on the hero <section> turns it into the containing block for
// LiveHUD's `fixed` panels, so the HUD stays inside this 100vh hero (and scrolls
// away with it) instead of sticking to the window.

import Link from 'next/link';
import LiveView from '@/components/live/LiveView';
import LiveHUD from '@/components/live/LiveHUD';
import CountryGrid from '@/components/Hero/CountryGrid';
import { pages, launchablePages } from '@/lib/content/content';

const live = launchablePages();
const COUNTRIES = (live.length ? live : pages).map((p) => ({
  slug: p.slug,
  country: p.country,
  primaryKeyword: p.primaryKeyword,
}));

export default function HomePage() {
  return (
    <main className="relative">
      {/* ===== HERO: the /live experience, contained to the first viewport ===== */}
      <section className="relative h-svh min-h-140 w-full overflow-hidden bg-storm transform-[translateZ(0)]">
        <LiveView viewOnly fill enableZoom={false} showZoomButtons />
        <LiveHUD />

        {/* scroll affordance */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center">
          <span className="flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.3em] text-white/45">
            Scroll to explore
            <span className="animate-bounce text-base">↓</span>
          </span>
        </div>
      </section>

      {/* ===== CONTENT below the fold ===== */}
      <div className="relative bg-storm">
        <div className="mx-auto max-w-5xl px-6 pb-24 pt-16">
          <section>
            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              See lightning strike the Earth, <span className="text-gradient">live</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-white/70">
              Lightning Map Bets turns the live global lightning feed into something
              you can watch and play. Every bolt above is a real detection from the
              Blitzortung community network, plotted the moment it lands. Spin the
              globe, zoom into a storm, and predict where the sky lights up next —
              free to play, no real money.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/play" className="btn-glow rounded-full px-7 py-3 text-sm font-bold">
                Play the 60-second game
              </Link>
              <Link
                href="/live"
                className="glass rounded-full px-7 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Open the full live map
              </Link>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-xl font-bold">Lightning maps by country</h2>
            <CountryGrid countries={COUNTRIES} />
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
      </div>
    </main>
  );
}
