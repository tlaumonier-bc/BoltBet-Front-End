'use client';
// components/seo/SeoContent.tsx
// The localized, keyword-rich copy for one country page. Pure presentational
// except for the Play CTAs, which are a small client component (PlayCta) that
// switches the globe into Game mode — there is no /play route anymore.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { englishTranslationTemplateFor } from '@/lib/content/content';
import type { ContentSection, FaqItem, LocalePage, PageContent } from '@/lib/content/content-types';
import CountryLiveSeoCard from './CountryLiveSeoCard';
import PlayCta from './PlayCta';

function replaceCountry(text: string, sourceCountry: string, targetCountry: string): string {
  return text
    .replaceAll(sourceCountry, targetCountry)
    .replaceAll('the UK', targetCountry)
    .replaceAll('UK', targetCountry);
}

function translatedContentFor(page: LocalePage, template: LocalePage): PageContent {
  const mapSection = (section: ContentSection): ContentSection => ({
    ...section,
    h2: replaceCountry(section.h2, template.country, page.country),
    body: replaceCountry(section.body, template.country, page.country),
    ctaText: section.ctaText ? replaceCountry(section.ctaText, template.country, page.country) : section.ctaText,
    ctaPrompt: section.ctaPrompt
      ? replaceCountry(section.ctaPrompt, template.country, page.country)
      : section.ctaPrompt,
  });

  const mapFaq = (faq: FaqItem): FaqItem => ({
    q: replaceCountry(faq.q, template.country, page.country),
    a: replaceCountry(faq.a, template.country, page.country),
  });

  return {
    ...template.content,
    breadcrumb: ['Home', `${page.country} lightning map`],
    h1: `Lightning map for ${page.country} - live lightning strikes in real time`,
    sections: template.content.sections.map(mapSection),
    faq: template.content.faq.map(mapFaq),
  };
}

export default function SeoContent({ page }: { page: LocalePage }) {
  const [translated, setTranslated] = useState(false);
  const template = englishTranslationTemplateFor(page);
  const canTranslate = Boolean(template && template.language !== page.language);
  const translatedContent = useMemo(
    () => (template ? translatedContentFor(page, template) : page.content),
    [page, template],
  );
  const c = translated && canTranslate ? translatedContent : page.content;
  const funnelSection = c.sections.find((s) => s.isFunnel);

  return (
    <div className="mx-auto w-[70vw] pb-24 pt-4">
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

      {canTranslate && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">
              {translated
                ? 'Showing a display-only English translation. The URL and SEO page remain in the original local language.'
                : `This page is written in ${page.language} for local search keywords.`}
            </p>
            <button
              type="button"
              onClick={() => setTranslated((value) => !value)}
              className="shrink-0 cursor-pointer rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              {translated ? `Show original ${page.language}` : 'Translate to English'}
            </button>
          </div>
        </div>
      )}

      {/* inline funnel prompt */}
      {funnelSection?.ctaPrompt && (
        <PlayCta className="mt-5 flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-bolt/20 bg-bolt/5 px-5 py-3 text-left text-sm transition hover:bg-bolt/10">
          <span className="text-white/80">{funnelSection.ctaPrompt}</span>
          <span className="shrink-0 font-semibold text-bolt">
            {funnelSection.ctaText ?? 'Play'} →
          </span>
        </PlayCta>
      )}

      <CountryLiveSeoCard page={page} />

      {/* localized content sections */}
      <div className="mt-12 space-y-12">
        {c.sections.map((s, i) =>
          s.isFunnel ? (
            <section key={i} className="glass rounded-2xl border border-bolt/20 p-6">
              <h2 className="font-display text-xl font-bold">{s.h2}</h2>
              <p className="mt-3 text-white/70">{s.body}</p>
              <PlayCta className="btn-glow mt-5 inline-block cursor-pointer rounded-full px-7 py-3 text-sm font-bold">
                {s.ctaText ?? 'Play'}
              </PlayCta>
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