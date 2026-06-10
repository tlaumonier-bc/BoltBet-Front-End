// The 3D globe is back as the hero, but as a deferred visual behind fully
// server-rendered text (see components/Hero/HeroGlobe.tsx). All SEO-critical
// content — H1, intro, country links, stats — is plain HTML, crawlable with
// no JS. The fast 2D map still powers every localized SEO page and /live.

import Link from 'next/link';
import HeroGlobe from '@/components/Hero/HeroGlobe';
import { pages, launchablePages } from '@/lib/content/content';

// Link the country grid to indexable (translated) pages first; fall back to
// build order if none are live yet.
const live = launchablePages();
const POPULAR = (live.length ? live : pages).slice(0, 8);

export default function HomePage() {
  return (
    <main className="relative min-h-screen">
      {/* HERO — impressive globe behind, SEO text in front */}
      <section className="relative isolate flex min-h-[90vh] items-center overflow-hidden">
        <HeroGlobe />
        <div className="mx-auto w-full max-w-5xl px-6 py-24">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white/80">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-bolt shadow-[0_0_10px_#fde047]" />
            Live · real-time strikes worldwide
          </span>

          <h1 className="font-display mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            See lightning strike the Earth, <span className="text-gradient">live</span>.
          </h1>

          <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
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

          <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
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
        </div>
      </section>

      {/* CONTENT — on solid background below the hero */}
      <div className="relative bg-storm">
        <div className="mx-auto max-w-5xl px-6 pb-24 pt-4">
          <section>
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
      </div>
    </main>
  );
}
