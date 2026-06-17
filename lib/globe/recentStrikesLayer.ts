// lib/globe/recentStrikesLayer.ts
// Real implementation of the "Recent strikes" beginner layer. Pulls raw strike
// positions from the backend (/api/strikes/recent/) for a fixed 30-minute
// window and renders them as a point cloud, coloured by age:
//   0–10 min  → red
//   10–20 min → orange
//   20–30 min → yellow
// Re-fetches on a timer so the cloud stays current (and ages re-bucket).
//
// NOTE: the backend caps `recent` at the newest 10k rows; 30 min of global
// strikes can exceed that, in which case this shows the most recent N.

import * as Cesium from 'cesium';
import { getRecentStrikes, type RecentStrike } from '@/lib/api';

const WINDOW_MINUTES = 30;
const POLL_MS = 15_000;
const MAX_POINTS = 8000; // render cap, independent of payload size

// Age-bucket colours (red → orange → yellow).
const COLOR_0_10 = Cesium.Color.fromCssColorString('#ef4444');  // red
const COLOR_10_20 = Cesium.Color.fromCssColorString('#fb923c'); // orange
const COLOR_20_30 = Cesium.Color.fromCssColorString('#fde047'); // yellow

function colorForAge(receivedAtMs: number, now: number): Cesium.Color {
  const ageMin = (now - receivedAtMs) / 60_000;
  if (ageMin < 10) return COLOR_0_10;
  if (ageMin < 20) return COLOR_10_20;
  return COLOR_20_30;
}

export interface LayerEffect {
  enable: () => void;
  disable: () => void;
}

export function makeRecentStrikesEffect(scene: Cesium.Scene): LayerEffect {
  let points: Cesium.PointPrimitiveCollection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const render = (strikes: RecentStrike[]) => {
    if (!points || scene.isDestroyed()) return;
    points.removeAll();
    const now = Date.now();
    const n = Math.min(strikes.length, MAX_POINTS);
    for (let i = 0; i < n; i++) {
      const s = strikes[i];
      const color = colorForAge(Date.parse(s.received_at), now);
      points.add({
        position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat),
        pixelSize: 7,                                               // dot diameter in px
        color: color.withAlpha(0.85),                               // ← fill opacity (0–1)
        outlineColor: color.withAlpha(0.20),                        // ← halo opacity (0–1)
        outlineWidth: 3,                                            // halo thickness in px
        scaleByDistance: new Cesium.NearFarScalar(2.0e6, 1.4, 4.0e7, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(2.0e6, 1.0, 4.0e7, 0.6),
      });
    }
  };

  const refresh = async () => {
    if (!points || inFlight) return;
    inFlight = true;
    try {
      const { strikes } = await getRecentStrikes(WINDOW_MINUTES, MAX_POINTS);
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