// lib/globe/recentStrikesLayer.ts
// One non-overlapping age band as a single-colour point cloud.
// Strategy: one big backfill, then poll only the delta (after cursor) and
// append. Expire points older than the band window. Never rebuild the cloud.

import * as Cesium from 'cesium';
import { getRecentStrikes, type RecentStrike } from '@/lib/api';

const POLL_MS = 15_000;

export interface LayerEffect {
  enable: () => void;
  disable: () => void;
}

export interface RecentStrikesOptions {
  minutes: number;       // band upper age, e.g. 60 = last hour
  olderThan?: number;    // band lower age in minutes
  color: Cesium.Color;
  maxPoints?: number;    // hard ceiling (default 200k)
  downsample?: number;   // server-side thinning for old bands
}

interface Held {
  prim: Cesium.PointPrimitive;
  receivedAt: number; // epoch ms
}

export function makeRecentStrikesEffect(scene: Cesium.Scene, opts: RecentStrikesOptions): LayerEffect {
  const { minutes, color } = opts;
  const olderThan = opts.olderThan ?? 0;
  const maxPoints = opts.maxPoints ?? 200_000;
  const downsample = opts.downsample ?? 1;

  let points: Cesium.PointPrimitiveCollection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let cursor: string | null = null;   // last received_at seen
  const held: Held[] = [];

  const addOne = (s: RecentStrike) => {
    if (!points) return;
    const prim = points.add({
      position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat),
      pixelSize: 7,
      color: color.withAlpha(0.85),
      outlineColor: color.withAlpha(0.2),
      outlineWidth: 3,
      scaleByDistance: new Cesium.NearFarScalar(2.0e6, 1.4, 4.0e7, 0.5),
      translucencyByDistance: new Cesium.NearFarScalar(2.0e6, 1.0, 4.0e7, 0.6),
    });
    held.push({ prim, receivedAt: Date.parse(s.received_at) });
  };

  // Drop points that aged out of the band window, and trim if over cap.
  const expire = () => {
    if (!points) return;
    const now = Date.now();
    const minAgeMs = olderThan * 60_000;       // younger edge of band
    const maxAgeMs = minutes * 60_000;         // older edge of band
    let removed = 0;
    for (const h of held) {
      const age = now - h.receivedAt;
      if (age > maxAgeMs || age < minAgeMs) {
        points.remove(h.prim);
        removed++;
      }
    }
    if (removed) {
      // compact held
      let w = 0;
      for (const h of held) {
        const age = now - h.receivedAt;
        if (!(age > maxAgeMs || age < minAgeMs)) held[w++] = h;
      }
      held.length = w;
    }
    while (held.length > maxPoints) {
      const h = held.shift()!;
      points.remove(h.prim);
    }
  };

  const ingest = (strikes: RecentStrike[]) => {
    // server returns newest-first; add oldest-first so cursor stays monotonic
    for (let i = strikes.length - 1; i >= 0; i--) addOne(strikes[i]);
    if (strikes.length) cursor = strikes[0].received_at; // newest
    expire();
  };

  const backfill = async () => {
    if (!points || inFlight) return;
    inFlight = true;
    try {
      const { strikes } = await getRecentStrikes(minutes, maxPoints, olderThan, { downsample });
      ingest(strikes);
    } catch { /* keep what we have */ } finally { inFlight = false; }
  };

  const poll = async () => {
    if (!points || inFlight) return;
    inFlight = true;
    try {
      const { strikes } = await getRecentStrikes(minutes, 20000, olderThan, {
        after: cursor ?? undefined,
        downsample,
      });
      ingest(strikes);
      if (!strikes.length) expire(); // still age out old points
    } catch { /* keep what we have */ } finally { inFlight = false; }
  };

  return {
    enable: () => {
      if (points) return;
      points = scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT }),
      );
      cursor = null;
      backfill();
      pollTimer = setInterval(poll, POLL_MS);
    },
    disable: () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (points && !scene.isDestroyed()) scene.primitives.remove(points);
      points = null;
      held.length = 0;
      cursor = null;
    },
  };
}