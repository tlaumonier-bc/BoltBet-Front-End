'use client';
// components/Globe/GlobeMapStyleToggle.tsx
// Standalone Night/Day imagery switch for pages that don't mount the full
// LiveHUD (the localized SEO map pages). It reads/writes the same liveStore
// `mapStyle` that lib/globe/imagery.ts subscribes to, so the globe reacts live.
// `defaultStyle` is applied once on first render — before the lazily-mounted
// globe's imagery effect calls getState() — so there is no night→day flash.

import { useState } from 'react';
import { useLiveStore, type GlobeMapStyle } from '@/store/liveStore';

const MAP_STYLES: { id: GlobeMapStyle; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
]

export default function GlobeMapStyleToggle({
  defaultStyle,
  className = '',
}: {
  defaultStyle?: GlobeMapStyle;
  className?: string;
}) {
  // Apply the page default exactly once, during the first render, before
  // GlobeWrapper's dynamically-imported globe creates its viewer and reads
  // useLiveStore.getState().mapStyle in setupImagery. useState's lazy
  // initializer is the run-once-in-render primitive, so the correct layer is
  // shown from the first frame instead of flipping after mount.
  useState(() => {
    if (defaultStyle && useLiveStore.getState().mapStyle !== defaultStyle) {
      useLiveStore.setState({ mapStyle: defaultStyle });
    }
    return null;
  });

  const mapStyle = useLiveStore((s) => s.mapStyle);
  const setMapStyle = useLiveStore((s) => s.setMapStyle);

  return (
    <div
      className={`glass pointer-events-auto flex shrink-0 self-start rounded-full p-1 text-xs font-semibold ${className}`}
    >
      {MAP_STYLES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setMapStyle(m.id)}
          aria-pressed={mapStyle === m.id}
          className={`rounded-full px-3.5 py-1.5 transition ${
            mapStyle === m.id
              ? 'bg-electric text-storm shadow-[0_0_14px_rgba(56,189,248,0.45)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}