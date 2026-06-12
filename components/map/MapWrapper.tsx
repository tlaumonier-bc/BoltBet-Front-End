'use client';
// components/map/MapWrapper.tsx
// Client-only loader for the MapLibre map (WebGL, browser-only — no SSR).

import dynamic from 'next/dynamic';
import type { Focus } from '@/lib/globeHandoff';

interface LightningMapProps {
  viewOnly?: boolean;
  fill?: boolean;
  initialFocus?: Focus;
  onZoomBelow?: (f: Focus) => void;
}

const LightningMapGL = dynamic<LightningMapProps>(
  () => import('./LightningMapGL'),
  {
    ssr: false,
    loading: () => <MapPlaceholder />,
  }
);

function MapPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="h-64 w-64 animate-pulse rounded-full bg-linear-to-br from-blue-900 via-slate-900 to-black shadow-[0_0_90px_25px_rgba(59,130,246,0.25)]" />
      <span className="absolute bottom-12 text-sm tracking-[0.3em] text-blue-300/60">
        LOADING MAP…
      </span>
    </div>
  );
}

export default function MapWrapper(props: LightningMapProps) {
  return <LightningMapGL {...props} />;
}