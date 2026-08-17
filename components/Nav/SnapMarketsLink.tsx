'use client';
// components/Nav/SnapMarketsLink.tsx — external brand link to SnapMarkets (white
// logo lockup, self-hosted in public/images/) + an (i) info tooltip teasing the
// upcoming lightning-strikes market. Tooltip copy is i18n'd (nav.snapInfo), with
// English as the default/fallback. Raw <img> on purpose: small brand SVGs.
/* eslint-disable @next/next/no-img-element */
import { useT } from '@/lib/i18n/ui';

export default function SnapMarketsLink() {
  const { t } = useT();
  return (
    <div className="ml-2 hidden items-center gap-1 sm:flex">
      <a
        href="https://snapmarkets.com/?utm_source=embed"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="SnapMarkets"
        className="flex items-center px-1 py-1.5 opacity-90 transition hover:opacity-100"
      >
        <span
          role="img"
          aria-label="SnapMarkets"
          className="inline-flex select-none items-center gap-[0.22em] text-[22px]"
          style={{ lineHeight: 1 }}
        >
          <img src="/images/snaplogo-white.svg" alt="" className="block h-[1em] w-auto select-none" draggable={false} />
          <img src="/images/snapmarkets-white.svg" alt="" className="block h-[1em] w-auto select-none" draggable={false} />
        </span>
      </a>

      {/* Info (i) — hover/focus reveals the partnership teaser */}
      <span className="group relative flex">
        <button
          type="button"
          aria-label={t('nav.snapInfo')}
          className="grid size-4 place-items-center rounded-full border border-white/25 text-[10px] font-black leading-none text-white/50 transition hover:border-white/50 hover:text-white/90"
        >
          i
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-[60] mt-2 w-64 rounded-xl border border-white/12 bg-slate-950/95 p-3 text-[11px] font-medium leading-relaxed text-white/75 opacity-0 shadow-2xl backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {t('nav.snapInfo')}
        </span>
      </span>
    </div>
  );
}
