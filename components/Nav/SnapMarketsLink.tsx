// components/Nav/SnapMarketsLink.tsx — external brand link to SnapMarkets, using
// their white logo assets (same lockup as on snapmarkets.com). Raw <img> on
// purpose: these are external brand SVGs, not app-owned/optimizable images.
/* eslint-disable @next/next/no-img-element */

export default function SnapMarketsLink() {
  return (
    <a
      href="https://snapmarkets.com/?utm_source=embed"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="SnapMarkets"
      className="ml-2 hidden items-center px-2 py-1.5 opacity-90 transition hover:opacity-100 sm:flex"
    >
      <span
        role="img"
        aria-label="SnapMarkets"
        className="inline-flex select-none items-center gap-[0.22em] text-[22px]"
        style={{ lineHeight: 1 }}
      >
        <img
          src="https://snapmarkets.com/assets/snap-brand/snaplogo-white.svg"
          alt=""
          className="block h-[1em] w-auto select-none"
          draggable={false}
        />
        <img
          src="https://snapmarkets.com/assets/snap-brand/snapmarkets-white.svg"
          alt=""
          className="block h-[1em] w-auto select-none"
          draggable={false}
        />
      </span>
    </a>
  );
}
