// components/seo/SeoMapPage.tsx
// The reusable template for every localized map page (the brief's worked example
// is Finland). Server-rendered for SEO; the globe is the only client island.
// Layout mirrors the landing page: a full-screen globe hero framed on the
// country (no rotation, zoom via +/− buttons, wheel scrolls the page), then all
// the localized copy below the fold -> game funnel -> FAQ (+ schema).

import Link from 'next/link';
import type { LocalePage } from '@/lib/content/content-types';
import { playHrefFor } from '@/lib/content/content';
import { boundsForLocale } from '@/lib/map/countryBounds';
import { pageJsonLd } from '@/lib/seo/schema';
import GlobeWrapper from '@/components/Globe/GlobeWrapper';

export default function SeoMapPage({ page }: { page: LocalePage }) {
  const bounds = boundsForLocale(page.locale);
  const play = playHrefFor(page);
  const c = page.content;
  const funnelSection = c.sections.find((s) => s.isFunnel);

  return (
    <main className="relative">
      {/* structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd(page)) }}
      />

      {/* ===== HERO: full-screen globe framed on this country ===== */}
      <section className="relative h-svh min-h-140 w-full overflow-hidden bg-storm transform-[translateZ(0)]">
        <GlobeWrapper
          viewOnly
          fill
          enableZoom={false}
          showZoomButtons
          autoRotate={false}
          initialBounds={bounds}
        />

        {/* scroll affordance */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[70] flex justify-center">
          <span className="flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.3em] text-white/45">
            Scroll to explore
            <span className="animate-bounce text-base">↓</span>
          </span>
        </div>
      </section>

      {/* ===== CONTENT below the fold ===== */}
      <div className="relative bg-storm">
        <div className="mx-[10%] px-6 pb-24 pt-16">
          {/* breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-xs text-white/50">
            {c.breadcrumb.map((name, i) => (
              <span key={i}>
                {i > 0 && <span className="px-1.5 text-white/30">›</span>}
                {i === c.breadcrumb.length - 1 ? (
                  <span className="text-white/70">{name}</span>
                ) : (
                  <Link href={page.localePath} className="hover:text-white">
                    {name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          {/* H1 */}
          <h1 className="font-display mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
            {c.h1}
          </h1>

          <p className="mt-2 text-xs text-white/40">
            Live strike data from the Blitzortung community detection network.
          </p>

          {/* inline funnel prompt (brief: one here, one in the section) */}
          {funnelSection?.ctaPrompt && (
            <Link
              href={play}
              className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-bolt/20 bg-bolt/5 px-5 py-3 text-sm transition hover:bg-bolt/10"
            >
              <span className="text-white/80">{funnelSection.ctaPrompt}</span>
              <span className="shrink-0 font-semibold text-bolt">{funnelSection.ctaText ?? 'Play'} →</span>
            </Link>
          )}

          {/* localized content sections */}
          <div className="mt-12 space-y-12">
            {c.sections.map((s, i) =>
              s.isFunnel ? (
                <section
                  key={i}
                  className="glass rounded-2xl border border-bolt/20 p-6"
                >
                  <h2 className="font-display text-xl font-bold">{s.h2}</h2>
                  <p className="mt-3 text-white/70">{s.body}</p>
                  <Link
                    href={play}
                    className="btn-glow mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold"
                  >
                    {s.ctaText ?? 'Play'}
                  </Link>
                </section>
              ) : (
                <section key={i}>
                  <h2 className="font-display text-xl font-bold">{s.h2}</h2>
                  <p className="mt-3 whitespace-pre-line text-white/70">{s.body}</p>
                </section>
              )
            )}
          </div>

          {/* FAQ — native <details> so it's SEO-visible and JS-free */}
          {c.faq.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-2xl font-bold">{c.faqHeading}</h2>
              <div className="mt-4 space-y-2">
                {c.faq.map((f, i) => (
                  <details
                    key={i}
                    className="glass group rounded-xl px-5 py-4 [&_summary]:cursor-pointer"
                  >
                    <summary className="flex items-center justify-between font-medium marker:content-['']">
                      {f.q}
                      <span className="text-white/40 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 text-sm text-white/65">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}