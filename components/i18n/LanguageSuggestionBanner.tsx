'use client';
// components/i18n/LanguageSuggestionBanner.tsx
// If the visitor's browser language doesn't match this page's language AND we
// have that language as an alternate, offer a dismissible "view in X" link.
// Deliberately a suggestion, not a redirect — never reroutes crawlers/users.
import { useEffect, useState } from 'react';
import { flagEmoji } from '@/lib/live/owm';
import type { LanguageAlternate } from '@/lib/content/content';

const DISMISS_KEY = 'lang_suggestion_dismissed_v1';

export default function LanguageSuggestionBanner({
  currentHreflang,
  alternates,
}: {
  currentHreflang: string;
  alternates: LanguageAlternate[];
}) {
  const [suggestion, setSuggestion] = useState<LanguageAlternate | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Defer out of the synchronous effect body so the setState doesn't cascade
    // a render (React 19 lint). We're only sampling navigator.languages once.
    queueMicrotask(() => {
      if (cancelled) return;

      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        /* private mode — just proceed */
      }

      const userLangs = (navigator.languages?.length ? navigator.languages : [navigator.language])
        .filter(Boolean)
        .map((l) => l.toLowerCase());

      const currentLang = currentHreflang.split('-')[0].toLowerCase();
      if (userLangs.some((l) => l.split('-')[0] === currentLang)) return;

      let match: LanguageAlternate | null = null;
      for (const ul of userLangs) {
        const ulBase = ul.split('-')[0];
        match =
          alternates.find((a) => a.hreflang.toLowerCase() === ul) ??
          alternates.find((a) => a.lang === ulBase) ??
          null;
        if (match) break;
      }
      if (match && !match.isCurrent) setSuggestion(match);
    });

    return () => {
      cancelled = true;
    };
  }, [currentHreflang, alternates]);

  if (!suggestion) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setSuggestion(null);
  };

  return (
    <div className="fixed left-1/2 top-20 z-50 w-[min(440px,92vw)] -translate-x-1/2">
      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl">
        <span className="text-xl leading-none" aria-hidden>
          {flagEmoji(suggestion.locale)}
        </span>
        <a href={suggestion.slug} hrefLang={suggestion.hreflang} className="flex-1 text-sm font-medium text-white/90 transition hover:text-white">
          View this page in {suggestion.language} →
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}