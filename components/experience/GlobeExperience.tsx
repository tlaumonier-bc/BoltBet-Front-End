'use client';
// components/experience/GlobeExperience.tsx
// Single source of truth for the globe experience, shared by the homepage and
// every SEO country page. Two stacked 100svh panes inside one overflow-hidden
// viewport; a CSS transform slides between "globe" and "text" — there is no
// manual scroll between them, navigation is button-only. The text pane renders
// SeoContent, which is server-rendered on the SEO routes (crawlable), so the
// pushState URL and the real route at that URL always carry the same content.

import { useEffect, useRef } from 'react';
import GlobeWrapper from '@/components/Globe/GlobeWrapper';
import LiveHUD from '@/components/live/LiveHUD';
import SeoContent from '@/components/seo/SeoContent';
import { useLiveStore } from '@/store/liveStore';
import { buildCountryLinks } from '@/lib/globe/countryLinks';
import { boundsForLocale } from '@/lib/map/countryBounds';
import { primaryPageForLocale, pageBySlug, languageAlternatesFor } from '@/lib/content/content';
import type { LocalePage } from '@/lib/content/content-types';
import LanguageSuggestionBanner from '@/components/i18n/LanguageSuggestionBanner';

const COUNTRY_LINKS = buildCountryLinks();

export default function GlobeExperience({ initialPage }: { initialPage?: LocalePage }) {
  const selectedCountry = useLiveStore((s) => s.selectedCountry);
  const seoContentOpen = useLiveStore((s) => s.seoContentOpen);
  const setSeoContentOpen = useLiveStore((s) => s.setSeoContentOpen);
  const setSelectedCountry = useLiveStore((s) => s.setSelectedCountry);

  const initialBounds = initialPage ? boundsForLocale(initialPage.locale) : undefined;

  // The page whose text we show + URL we sync to. On a deep link it's the exact
  // page for the URL; on the homepage it's the primary page for the country the
  // user clicked. On the SEO route this resolves to `initialPage` even before
  // the selection effect runs, so SeoContent is in the server-rendered HTML.
  const activePage: LocalePage | null = (() => {
    const iso = selectedCountry?.iso2;
    if (iso) {
      if (initialPage && iso === initialPage.locale.toUpperCase()) return initialPage;
      return primaryPageForLocale(iso.toLowerCase()) ?? null;
    }
    return initialPage ?? null;
  })();

  const targetSlug = (): string => {
    const iso = selectedCountry?.iso2;
    if (!iso) return '/';
    if (initialPage && iso === initialPage.locale.toUpperCase()) return initialPage.slug;
    return primaryPageForLocale(iso.toLowerCase())?.slug ?? '/';
  };

  // SEO route: pre-select the country once on mount so the panel + highlight
  // mirror the SPA state. (Camera framing comes from initialBounds.)
  const didInit = useRef(false);
  useEffect(() => {
    if (initialPage && !didInit.current) {
      didInit.current = true;
      setSelectedCountry({ name: initialPage.country, iso2: initialPage.locale.toUpperCase() });
    }
  }, [initialPage, setSelectedCountry]);

  // Keep the address bar in sync without reloading. UX only — the canonical,
  // server-rendered route at the same URL is the SEO source of truth.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = targetSlug();
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry]);

  // Browser back/forward → re-derive the selection from the URL.
  useEffect(() => {
    const onPop = () => {
      const page = pageBySlug(window.location.pathname);
      setSelectedCountry(page ? { name: page.country, iso2: page.locale.toUpperCase() } : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setSelectedCountry]);

  // Changing/closing the country collapses the text view back to the globe.
  const prevName = useRef<string | null>(null);
  useEffect(() => {
    const name = selectedCountry?.name ?? null;
    if (name !== prevName.current) {
      prevName.current = name;
      setSeoContentOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry]);

  return (
    <main className="relative h-svh overflow-hidden bg-storm">
      {/* locked viewport: two 100svh panes, transform-slid (no manual scroll) */}
      <div
        className="h-[200svh] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"
        style={{ transform: seoContentOpen ? 'translateY(-100svh)' : 'translateY(0)' }}
      >
        {/* ── GLOBE PANE ───────────────────────────────────────────────── */}
        <section className="globe-drop relative h-svh w-full overflow-hidden bg-storm transform-[translateZ(0)]">
          <GlobeWrapper
            viewOnly
            fill
            enableZoom
            countryLinks={COUNTRY_LINKS}
            initialBounds={initialBounds}
          />
          {!activePage && (
            <h1 className="sr-only">
              Lightning Map Game — live real-time lightning strike map &amp; 60-second prediction game
            </h1>
          )}
        </section>

        {/* ── TEXT PANE (scrolls internally; SEO copy lives here) ───────── */}
        <section className="relative h-svh w-full overflow-y-auto bg-storm panel-scroll">
          {activePage && (
            <>
              <div className="sticky top-0 z-10 flex justify-center border-b border-white/5 bg-storm/85 px-6 pb-4 pt-20 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setSeoContentOpen(false)}
                  className="glass group flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <span aria-hidden className="text-base transition-transform group-hover:-translate-y-0.5">
                    ↑
                  </span>
                  Back to the globe
                </button>
              </div>
              <SeoContent page={activePage} />
            </>
          )}
        </section>
      </div>

      {/* HUD lives OUTSIDE the transformed slider so its fixed panels anchor to
          the viewport (a transform ancestor would re-base `fixed`). Hidden while
          reading the text. */}
      <div className={seoContentOpen ? 'hidden' : undefined}>
        <LiveHUD />
        {activePage && (
          <LanguageSuggestionBanner
            currentHreflang={activePage.hreflang}
            alternates={languageAlternatesFor(activePage)}
          />
        )}
      </div>

      {/* Mobile affordance to reach the text — CountryPanel's button is lg+ only. */}
      {activePage && !seoContentOpen && (
        <button
          type="button"
          onClick={() => setSeoContentOpen(true)}
          className="btn-glow fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-6 py-3 text-sm font-bold lg:hidden cursor-pointer"
        >
          Learn more about {activePage.country} ↓
        </button>
      )}
    </main>
  );
}