'use client';
// components/seo/SeoContent.tsx
// The localized, keyword-rich copy for one country page. Pure presentational
// except for the Play CTAs, which are a small client component (PlayCta) that
// switches the globe into Game mode — there is no /play route anymore.
import Link from 'next/link';
import type { LocalePage } from '@/lib/content/content-types';
import CountryLiveSeoCard from './CountryLiveSeoCard';
import CountryLightningMapCard from './CountryLightningMapCard';
import PlayCta from './PlayCta';
import { useT } from '@/lib/i18n/ui';

export default function SeoContent({ page }: { page: LocalePage }) {
  const { t } = useT();
  const c = page.content;
  const funnelSection = c.sections.find((s) => s.isFunnel);

  return (
    <div className="mx-auto w-[90vw] pb-20 pt-3 text-sm sm:w-[70vw] sm:pb-24 sm:pt-4 sm:text-base">
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

      <h1 className="font-display mt-3 text-2xl font-extrabold leading-tight sm:mt-4 sm:text-5xl">
        {c.h1}
      </h1>

      <p className="mt-2 text-xs text-white/40">
        {t('seo.dataSource')}
      </p>

      {/* inline funnel prompt */}
      {funnelSection?.ctaPrompt && (
        <PlayCta className="mt-5 hidden w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-bolt/20 bg-bolt/5 px-5 py-3 text-left text-sm transition hover:bg-bolt/10 md:flex">
          <span className="text-white/80">{funnelSection.ctaPrompt}</span>
          <span className="shrink-0 font-semibold text-bolt">
            {funnelSection.ctaText ?? t('seo.play')} →
          </span>
        </PlayCta>
      )}

      <CountryLiveSeoCard page={page} />
      <CountryLightningMapCard page={page} />

      {/* localized content sections */}
      <div className="mt-8 space-y-8 sm:mt-12 sm:space-y-12">
        {c.sections.map((s, i) =>
          s.isFunnel ? (
            <section key={i} className="glass rounded-2xl border border-bolt/20 p-4 sm:p-6">
              <h2 className="font-display text-lg font-bold sm:text-xl">{s.h2}</h2>
              <p className="mt-2 leading-relaxed text-white/70 sm:mt-3">{s.body}</p>
              <PlayCta className="btn-glow mt-5 hidden cursor-pointer rounded-full px-7 py-3 text-sm font-bold md:inline-block">
                {s.ctaText ?? t('seo.play')}
              </PlayCta>
            </section>
          ) : (
            <section key={i}>
              <h2 className="font-display text-lg font-bold sm:text-xl">{s.h2}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-white/70 sm:mt-3">{s.body}</p>
            </section>
          ),
        )}
      </div>

      {/* FAQ — native <details> so it's SEO-visible and JS-free */}
      {c.faq.length > 0 && (
        <section className="mt-10 sm:mt-14">
          <h2 className="font-display text-xl font-bold sm:text-2xl">{c.faqHeading}</h2>
          <div className="mt-4 space-y-2">
            {c.faq.map((f, i) => (
              <details
                key={i}
                className="glass group rounded-xl px-4 py-3 sm:px-5 sm:py-4 [&_summary]:cursor-pointer"
              >
                <summary className="flex items-center justify-between text-sm font-medium marker:content-[''] sm:text-base">
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