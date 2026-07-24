// lib/grid-game/zones.ts
// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL playable-zone search for the Grid Game.
//
// Replaces the old per-country `buildAreaCandidates` search (which surfaced ~1
// zone and often 0). This scans ALL recent strikes worldwide and returns the
// hottest well-dispersed storm cells as playable zones. Backtested over 30 min of
// real strikes (see test/RESULTS.md): ~5 zones on average, always ≥1, with strikes
// spread across the grid (entropy ≈ 0.63, hottest cell ≈ 23%) so the game isn't
// "click the one hot cell".
//
// Model = greedy top-density peaks: repeatedly take the hottest coarse bin, carve
// a tight zone around it, suppress bins within separationKm, repeat. Distinct
// storm cells each become a zone; separationKm tiles big systems into several.
//
// ALL TUNABLES ARE IN `ZONE_CONFIG`. Re-tune with test/backtest.mjs.
// ─────────────────────────────────────────────────────────────────────────────

import type { Bounds } from '@/lib/map/countryBounds';
import type { CountryStrike } from '@/lib/api';
import type { Grid } from './geo';

export interface ZoneConfig {
  obsMs: number;          // lookback for recency-weighted density
  roundMs: number;        // round window dispersion/activity are measured over
  tauMs: number;          // recency decay constant
  coarseDeg: number;      // coarse bin size for peak detection
  minCellWeight: number;  // weighted-density floor for a bin to seed a zone
  focusRadiusKm: number;  // radius of strikes gathered into a zone around a peak
  separationKm: number;   // min distance between two zones (tiles big storms)
  minSigmaKm: number;     // floor on a zone's spatial spread
  minRoundStrikes: number;// min strikes in the zone over the round window
  targetPerCell: number;  // aim ~this many round strikes per cell (sets dims)
  sigmaK: number;         // grid half-extent = sigmaK · weighted std-dev
  minCols: number; minRows: number; maxCols: number; maxRows: number;
  entropyThreshold: number; // min normalized dispersion to accept a zone
  maxZones: number;         // hard cap
}

// Backtested optimum (test/RESULTS.md → "FINAL").
export const ZONE_CONFIG: ZoneConfig = {
  obsMs: 420_000,
  roundMs: 60_000,
  tauMs: 150_000,
  coarseDeg: 0.3,
  minCellWeight: 0.7,
  focusRadiusKm: 34,
  separationKm: 42,
  minSigmaKm: 10,
  minRoundStrikes: 4,
  targetPerCell: 1.3,
  sigmaK: 1.8,
  minCols: 5, minRows: 4, maxCols: 12, maxRows: 10,
  entropyThreshold: 0.5,
  maxZones: 12,
};

export interface PlayableZone {
  id: string;
  bounds: Bounds;
  cols: number;
  rows: number;
  grid: Grid;
  roundStrikes: number;
  hNorm: number;
  widthKm: number;
  score: number; // ranking key (recent activity)
}

const KM_PER_DEG = 111.32;
const cosLat = (lat: number) => Math.max(0.01, Math.cos((lat * Math.PI) / 180));

type Pt = { lat: number; lon: number; t: number };

/** Detect playable zones worldwide from a recent global strike feed. */
export function detectZones(strikes: CountryStrike[], now: number, cfg: ZoneConfig = ZONE_CONFIG): PlayableZone[] {
  const obsSince = now - cfg.obsMs;
  const roundSince = now - cfg.roundMs;
  const recent: Pt[] = [];
  for (const s of strikes) {
    const t = Date.parse(s.received_at);
    if (!Number.isFinite(t) || t < obsSince || t > now) continue;
    recent.push({ lat: s.lat, lon: s.lon, t });
  }
  if (!recent.length) return [];

  // Recency-weighted coarse bins → peak seeds (hottest first).
  const bins = new Map<string, { w: number; sw: number; slat: number; slon: number }>();
  for (const s of recent) {
    const cx = Math.floor((s.lon + 180) / cfg.coarseDeg);
    const cy = Math.floor((s.lat + 90) / cfg.coarseDeg);
    const key = cx + ',' + cy;
    let b = bins.get(key);
    if (!b) {
      b = { w: 0, sw: 0, slat: 0, slon: 0 };
      bins.set(key, b);
    }
    const w = Math.exp(-(now - s.t) / cfg.tauMs);
    b.w += w; b.sw += w; b.slat += w * s.lat; b.slon += w * s.lon;
  }
  const seeds = [...bins.values()]
    .map((b) => ({ w: b.w, clat: b.slat / b.sw, clon: b.slon / b.sw }))
    .sort((a, b) => b.w - a.w);

  const zones: PlayableZone[] = [];
  const claimed: { clat: number; clon: number }[] = [];
  const sep2 = cfg.separationKm ** 2;
  const r2 = cfg.focusRadiusKm ** 2;
  for (const seed of seeds) {
    if (seed.w < cfg.minCellWeight) break; // sorted desc: nothing hotter remains
    // skip peaks that fall inside an already-claimed zone
    let near = false;
    for (const p of claimed) {
      const dlat = (seed.clat - p.clat) * KM_PER_DEG;
      const dlon = (seed.clon - p.clon) * KM_PER_DEG * cosLat(p.clat);
      if (dlat * dlat + dlon * dlon <= sep2) { near = true; break; }
    }
    if (near) continue;
    claimed.push({ clat: seed.clat, clon: seed.clon });
    const c = cosLat(seed.clat);
    const gathered = recent.filter((s) => {
      const dlat = (s.lat - seed.clat) * KM_PER_DEG;
      const dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      return dlat * dlat + dlon * dlon <= r2;
    });
    const zone = buildZone(gathered, now, roundSince, cfg);
    if (zone) zones.push(zone);
    if (zones.length >= cfg.maxZones) break;
  }
  zones.sort((a, b) => b.score - a.score);
  return zones;
}

function buildZone(all: Pt[], now: number, roundSince: number, cfg: ZoneConfig): PlayableZone | null {
  if (!all.length) return null;

  // recency-weighted centroid + spread (km)
  let sw = 0, sx = 0, sy = 0;
  for (const s of all) {
    const w = Math.exp(-(now - s.t) / cfg.tauMs);
    sw += w; sx += w * s.lon; sy += w * s.lat;
  }
  if (sw <= 0) return null;
  const clat = sy / sw, clon = sx / sw;
  let vlat = 0, vlon = 0;
  for (const s of all) {
    const w = Math.exp(-(now - s.t) / cfg.tauMs);
    vlat += w * (s.lat - clat) ** 2;
    vlon += w * (s.lon - clon) ** 2;
  }
  const sigLatKm = Math.max(cfg.minSigmaKm, Math.sqrt(vlat / sw) * KM_PER_DEG);
  const sigLonKm = Math.max(cfg.minSigmaKm, Math.sqrt(vlon / sw) * KM_PER_DEG * cosLat(clat));

  const roundCount = all.reduce((n, s) => (s.t >= roundSince ? n + 1 : n), 0);
  if (roundCount < cfg.minRoundStrikes) return null;

  // adaptive dims: aim ~targetPerCell round strikes per cell, shaped to the cluster
  const target = roundCount / cfg.targetPerCell;
  const nCells = Math.max(cfg.minCols * cfg.minRows, Math.min(cfg.maxCols * cfg.maxRows, target));
  const aspect = sigLonKm / Math.max(0.01, sigLatKm);
  let rows = Math.round(Math.sqrt(nCells / Math.max(0.1, aspect)));
  rows = Math.max(cfg.minRows, Math.min(cfg.maxRows, rows));
  let cols = Math.round(nCells / Math.max(1, rows));
  cols = Math.max(cfg.minCols, Math.min(cfg.maxCols, cols));

  const halfHDeg = (cfg.sigmaK * sigLatKm) / KM_PER_DEG;
  const halfWDeg = (cfg.sigmaK * sigLonKm) / (KM_PER_DEG * cosLat(clat));
  const minLat = clat - halfHDeg, maxLat = clat + halfHDeg;
  const minLon = clon - halfWDeg, maxLon = clon + halfWDeg;
  const spanLat = maxLat - minLat, spanLon = maxLon - minLon;
  if (spanLat <= 0 || spanLon <= 0) return null;

  // dispersion gate over the round window (equirectangular cell mapping)
  const counts = new Array<number>(cols * rows).fill(0);
  let inGrid = 0;
  for (const s of all) {
    if (s.t < roundSince) continue;
    const rx = (s.lon - minLon) / spanLon;
    const ry = (maxLat - s.lat) / spanLat;
    if (rx < 0 || rx >= 1 || ry < 0 || ry >= 1) continue;
    counts[Math.min(rows - 1, Math.floor(ry * rows)) * cols + Math.min(cols - 1, Math.floor(rx * cols))] += 1;
    inGrid += 1;
  }
  if (inGrid < cfg.minRoundStrikes) return null;
  let h = 0;
  for (const n of counts) {
    if (n > 0) {
      const p = n / inGrid;
      h -= p * Math.log(p);
    }
  }
  const hNorm = h / Math.log(cols * rows);
  if (hNorm < cfg.entropyThreshold) return null;

  return {
    id: `${clat.toFixed(1)},${clon.toFixed(1)}`,
    bounds: { minLat, maxLat, minLon, maxLon, label: '' },
    cols,
    rows,
    grid: { cols, rows },
    roundStrikes: inGrid,
    hNorm,
    widthKm: spanLon * KM_PER_DEG * cosLat(clat),
    score: inGrid + sw, // recent activity: round strikes + weighted density
  };
}
