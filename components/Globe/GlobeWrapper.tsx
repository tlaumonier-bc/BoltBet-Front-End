'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

interface LightningGlobeProps {
  viewOnly?: boolean;
  fill?: boolean;
  enableZoom?: boolean;
  showZoomButtons?: boolean;
  autoRotate?: boolean;
  initialBounds?: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  /** Fired once the globe's first tiles are in. Supplied by GlobeWrapper. */
  onReady?: () => void;
  /** Round-based game: click a zone to pick it; locked zone is highlighted. */
  gameMode?: boolean;
  onPickZone?: (zoneId: string) => void;
  lockedZoneId?: string | null;
}

const LightningGlobe = dynamic<LightningGlobeProps>(
  () => import('./LightningGlobe'),
  // No `loading` placeholder: the GlobeLoader below covers BOTH the chunk
  // download and the first tile load, so there's one continuous loader.
  { ssr: false }
);

function GlobeLoader({ fill, hidden }: { fill?: boolean; hidden: boolean }) {
  return (
    <div
      className={`${fill ? 'absolute' : 'fixed'} inset-0 z-60 flex flex-col items-center justify-center gap-6 bg-storm transition-opacity duration-700 ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden={hidden}
    >
      <div className="relative flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-linear-to-br from-blue-900 via-slate-900 to-black shadow-[0_0_90px_25px_rgba(59,130,246,0.25)]" />
        <span className="relative h-8 w-8 animate-spin rounded-full border-2 border-blue-400/25 border-t-blue-300" />
      </div>
      <span className="text-xs uppercase tracking-[0.4em] text-blue-300/70">
        Loading globe…
      </span>
    </div>
  );
}

export default function GlobeWrapper(props: LightningGlobeProps) {
  const [ready, setReady] = useState(false);

  return (
    <>
      <LightningGlobe {...props} onReady={() => setReady(true)} />
      <GlobeLoader fill={props.fill} hidden={ready} />
    </>
  );
}