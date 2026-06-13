// components/seo/SeoMapPage.tsx
// The reusable template for every localized map page (the brief's worked example
// is Finland). Server-rendered for SEO; the globe is the only client island.
// Architecture per content_brief: map above the fold -> localized sections ->
// game funnel -> FAQ (+ FAQPage / BreadcrumbList schema).

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
    <main className="relative min-h-screen">
      {/* structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd(page)) }}
      />

      <div className="mx-auto max-w-3xl px-6 pb-24 pt-28">
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

        {/* THE PRODUCT: live 3D globe, framed on this country, above the fold */}
        <div className="relative mt-6 h-[58vh] min-h-[360px] overflow-hidden rounded-2xl border border-white/10">
          <GlobeWrapper viewOnly fill enableZoom={false} showZoomButtons initialBounds={bounds} />
        </div>
        <p className="mt-2 text-xs text-white/40">
          Live strike data from the Blitzortung community detection network.
        </p>

        {/* inline funnel prompt, right under the map (brief: one here, one in the section) */}
        {funnelSection?.ctaPrompt && (
          <Link
            href={play}
            className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-bolt/20 bg-bolt/5 px-5 py-3 text-sm transition hover:bg-bolt/10"
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
    </main>
  );
}