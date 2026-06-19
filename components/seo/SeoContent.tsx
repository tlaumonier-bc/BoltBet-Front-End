// components/seo/SeoContent.tsx
// The localized, keyword-rich copy for one country page. Pure presentational,
// no client hooks — so it server-renders (crawlable HTML) when used inside the
// SEO route, and also renders fine client-side on the homepage click path.
import Link from 'next/link';
import type { LocalePage } from '@/lib/content/content-types';
import { playHrefFor } from '@/lib/content/content';

export default function SeoContent({ page }: { page: LocalePage }) {
  const c = page.content;
  const play = playHrefFor(page);
  const funnelSection = c.sections.find((s) => s.isFunnel);

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-4">
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

      <h1 className="font-display mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
        {c.h1}
      </h1>

      <p className="mt-2 text-xs text-white/40">
        Live strike data from the Blitzortung community detection network.
      </p>

      {/* inline funnel prompt */}
      {funnelSection?.ctaPrompt && (
        <Link
          href={play}
          className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-bolt/20 bg-bolt/5 px-5 py-3 text-sm transition hover:bg-bolt/10"
        >
          <span className="text-white/80">{funnelSection.ctaPrompt}</span>
          <span className="shrink-0 font-semibold text-bolt">
            {funnelSection.ctaText ?? 'Play'} →
          </span>
        </Link>
      )}

      {/* localized content sections */}
      <div className="mt-12 space-y-12">
        {c.sections.map((s, i) =>
          s.isFunnel ? (
            <section key={i} className="glass rounded-2xl border border-bolt/20 p-6">
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
          ),
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
  );
}