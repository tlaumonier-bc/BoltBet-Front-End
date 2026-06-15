// lib/globe/tileLoadTracker.ts
// Two loading states:
//  1. onReady()                  — fired once, when the first tiles are in.
//  2. setTilesLoading(true/false) — the "Loading map detail…" pill while
//     higher-res tiles stream in on later zooms.

import * as Cesium from 'cesium';

export function createTileLoadTracker({
  scene,
  onReady,
  setTilesLoading,
}: {
  scene: Cesium.Scene;
  onReady: () => void;
  setTilesLoading: (loading: boolean) => void;
}): () => void {
  let destroyed = false;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let sawInitialTiles = false;
  let initialReady = false;

  const revealGlobe = () => {
    if (initialReady) return;
    initialReady = true;
    if (!destroyed) onReady();
  };

  // Safety net: never leave the loader stuck if imagery tiles fail to load.
  const readyFallback = setTimeout(revealGlobe, 8000);

  const onTileProgress = (queued: number) => {
    if (destroyed) return;

    if (!initialReady) {
      if (queued > 0) sawInitialTiles = true;
      if (sawInitialTiles && queued === 0) revealGlobe();
      return;
    }

    if (queued > 0) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (!showTimer) showTimer = setTimeout(() => { setTilesLoading(true); showTimer = null; }, 150);
    } else {
      if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      if (!hideTimer) hideTimer = setTimeout(() => { setTilesLoading(false); hideTimer = null; }, 300);
    }
  };
  scene.globe.tileLoadProgressEvent.addEventListener(onTileProgress);

  return () => {
    destroyed = true;
    clearTimeout(readyFallback);
    if (showTimer) clearTimeout(showTimer);
    if (hideTimer) clearTimeout(hideTimer);
    if (!scene.isDestroyed()) {
      scene.globe.tileLoadProgressEvent.removeEventListener(onTileProgress);
    }
  };
}