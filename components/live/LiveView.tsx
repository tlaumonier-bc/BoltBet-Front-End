'use client';
// components/live/LiveView.tsx
// Owns the 3D-globe ⇄ MapLibre-map swap. Renders one view at a time; HUD
// overlays (LiveHUD / GameHUD) stay as siblings on top of it.

import { useState, useCallback } from 'react';
import GlobeWrapper from '@/components/Globe/GlobeWrapper';
import MapWrapper from '@/components/map/MapWrapper';
import type { Focus } from '@/lib/globeHandoff';

interface LiveViewProps {
  viewOnly?: boolean;
  fill?: boolean;
  enableZoom?: boolean;
  showZoomButtons?: boolean;
}

export default function LiveView({
  viewOnly = false,
  fill = false,
  enableZoom = true,
  showZoomButtons = false,
}: LiveViewProps) {
  const [mode, setMode] = useState<'globe' | 'map'>('globe');
  const [focus, setFocus] = useState<Focus>({ lat: 20, lon: 0 });

  const toMap = useCallback((f: Focus) => {
    setFocus(f);
    setMode('map');
  }, []);

  const toGlobe = useCallback((f: Focus) => {
    setFocus(f);
    setMode('globe');
  }, []);

  return mode === 'globe' ? (
    <GlobeWrapper
      viewOnly={viewOnly}
      fill={fill}
      enableZoom={enableZoom}
      showZoomButtons={showZoomButtons}
      enableMapHandoff
      initialFocus={focus}
      onZoomBeyond={toMap}
    />
  ) : (
    <MapWrapper viewOnly={viewOnly} fill={fill} initialFocus={focus} onZoomBelow={toGlobe} />
  );
}