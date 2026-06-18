// lib/globe/recentStrikesLayer.ts
// Renders ONE non-overlapping age band as a single-colour point cloud.
// A band is [now - minutes, now - olderThan]; olderThan=0 means "up to now".

import * as Cesium from 'cesium';
import { getRecentStrikes, type RecentStrike } from '@/lib/api';

const POLL_MS = 15_000;
const MAX_POINTS = 8000;

export interface LayerEffect {
  enable: () => void;
  disable: () => void;
}

export interface RecentStrikesOptions {
  minutes: number;
  olderThan?: number;
  color: Cesium.Color;
}

export function makeRecentStrikesEffect(scene: Cesium.Scene, opts: RecentStrikesOptions): LayerEffect {
  const { minutes, color } = opts;
  const olderThan = opts.olderThan ?? 0;

  let points: Cesium.PointPrimitiveCollection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const render = (strikes: RecentStrike[]) => {
    if (!points || scene.isDestroyed()) return;
    points.removeAll();
    const n = Math.min(strikes.length, MAX_POINTS);
    for (let i = 0; i < n; i++) {
      const s = strikes[i];
      points.add({
        position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat),
        pixelSize: 7,
        color: color.withAlpha(0.85),
        outlineColor: color.withAlpha(0.20),
        outlineWidth: 3,
        scaleByDistance: new Cesium.NearFarScalar(2.0e6, 1.4, 4.0e7, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(2.0e6, 1.0, 4.0e7, 0.6),
      });
    }
  };

  const refresh = async () => {
    if (!points || inFlight) return;
    inFlight = true;
    try {
      const { strikes } = await getRecentStrikes(minutes, MAX_POINTS, olderThan);
      render(strikes);
    } catch {
      /* backend hiccup — keep the previous render */
    } finally {
      inFlight = false;
    }
  };

  return {
    enable: () => {
      if (points) return;
      points = scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT }),
      );
      refresh();
      pollTimer = setInterval(refresh, POLL_MS);
    },
    disable: () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (points && !scene.isDestroyed()) scene.primitives.remove(points);
      points = null;
    },
  };
}