'use client';
// components/Hero/HeroGlobe.tsx
// The landing hero visual. Strategy for "impressive AND fast for SEO":
//   1. A static poster image paints immediately — it is the LCP element, so
//      first paint stays fast and the page's text/links (server-rendered in
//      page.tsx, on top of this) are crawlable with no JS.
//   2. After the page is idle, the real WebGL globe is dynamically imported
//      (ssr:false) and crossfaded in. Heavy three.js never blocks first paint.
//   3. Users who prefer reduced motion or are on Save-Data keep the poster only.

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HeroGlobeCanvas = dynamic(() => import('./HeroGlobeCanvas'), { ssr: false });

export default function HeroGlobe({ poster = '/globe-poster.png' }: { poster?: string }) {
  const [showGlobe, setShowGlobe] = useState(false);
  const [posterHidden, setPosterHidden] = useState(false);

  // Decide whether to upgrade to the live globe, once, after idle.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saveData = (navigator as any)?.connection?.saveData;
    if (reduce || saveData) return; // keep the static poster

    const start = () => setShowGlobe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(start, { timeout: 2500 })
      : window.setTimeout(start, 1200);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id as number);
    };
  }, []);

  // Once the globe has mounted, fade the poster out over it.
  useEffect(() => {
    if (!showGlobe) return;
    const t = setTimeout(() => setPosterHidden(true), 900);
    return () => clearTimeout(t);
  }, [showGlobe]);

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-storm" aria-hidden="true">
      {showGlobe && (
        <div className="absolute inset-0">
          <HeroGlobeCanvas />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        fetchPriority="high"
        className={`absolute left-1/2 top-1/2 h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 ${
          posterHidden ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div className="absolute inset-0 bg-linear-to-b from-storm/40 via-storm/10 to-storm" />
    </div>
  );
}
