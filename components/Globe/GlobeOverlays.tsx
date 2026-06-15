'use client';
// components/Globe/GlobeOverlays.tsx
// DOM overlays for the globe: hover tooltip, "loading detail" pill, zoom buttons.

import { forwardRef } from 'react';

export const GlobeTooltip = forwardRef<HTMLDivElement>(function GlobeTooltip(_props, ref) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute z-20 hidden -translate-x-1/2 translate-y-[-115%] whitespace-nowrap rounded-md border border-white/15 bg-black/80 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
      style={{ display: 'none' }}
    />
  );
});

export function TileLoadingPill({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/80">
        <span className="globe-loading-spinner" />
        Loading map detail…
      </div>
    </div>
  );
}

export function GlobeZoomButtons({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div
      className="absolute bottom-6 right-6 z-20 flex flex-col gap-2"
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="glass flex h-11 w-11 items-center justify-center rounded-xl text-2xl leading-none text-white/90 transition hover:bg-white/15 active:scale-95"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="glass flex h-11 w-11 items-center justify-center rounded-xl text-2xl leading-none text-white/90 transition hover:bg-white/15 active:scale-95"
      >
        −
      </button>
    </div>
  );
}