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
  // ADAPTIVE radius: a zone grows around its peak until it gathers this many
  // round-window strikes (bigger in quiet periods, small when storms are dense),
  // clamped to [minFocusKm, maxFocusKm]. Separation between zones scales with the
  // chosen radius (separationFrac), clamped to [minSepKm, maxSepKm].
  targetRoundStrikes: number;
  minFocusKm: number;
  maxFocusKm: number;
  separationFrac: number;
  minSepKm: number;
  maxSepKm: number;
  minSigmaKm: number;     // floor on a zone's spatial spread
  minRoundStrikes: number;// min strikes in the zone over the round window (drop near-empty peaks)
  targetPerCell: number;  // aim ~this many round strikes per cell (sets dims)
  sigmaK: number;         // grid half-extent = sigmaK · weighted std-dev
  minCols: number; minRows: number; maxCols: number; maxRows: number;
  entropyThreshold: number; // min normalized dispersion to accept a zone
  maxZones: number;         // hard cap
}

// Backtested "Balanced" optimum (test/RESULTS.md): seed-anchored adaptive-radius
// zones — ~5 zones on avg (median 5, ≥5 on ~56% of ticks), median ~74
// strikes/zone/min (2.5× the old model), still distributed (hNorm ~0.58), with
// distinct seed-anchored centres (≥minSepKm apart → mild overlap, no duplicates).
// At ~590 strikes/min globally, 5 zones EACH ≥100/min is physically impossible
// (there aren't 5 storms that dense at once), so this trades per-zone strikes for
// the ~5-zone count the game wants; each zone still auto-sizes to gather strikes.
export const ZONE_CONFIG: ZoneConfig = {
  obsMs: 420_000,
  roundMs: 60_000,
  tauMs: 150_000,
  coarseDeg: 0.2,
  minCellWeight: 0.3,
  targetRoundStrikes: 90,
  minFocusKm: 60,
  maxFocusKm: 300,
  separationFrac: 1,
  minSepKm: 60,
  maxSepKm: 60,
  minSigmaKm: 10,
  minRoundStrikes: 18,
  targetPerCell: 2.0,
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
  const accepted: { clat: number; clon: number; sepKm: number }[] = []; // centres of ACCEPTED zones
  const tooClose = (lat: number, lon: number) => accepted.some((a) => {
    const dlat = (lat - a.clat) * KM_PER_DEG;
    const dlon = (lon - a.clon) * KM_PER_DEG * cosLat(a.clat);
    return dlat * dlat + dlon * dlon <= a.sepKm * a.sepKm;
  });
  for (const seed of seeds) {
    if (seed.w < cfg.minCellWeight) break; // sorted desc: nothing hotter remains
    if (tooClose(seed.clat, seed.clon)) continue; // seed inside an accepted zone
    const c = cosLat(seed.clat);

    // Adaptive radius: smallest radius (clamped) holding ~targetRoundStrikes of
    // the last round-window's strikes, so a zone stays strike-rich in quiet times.
    const roundD: number[] = [];
    for (const s of recent) {
      if (s.t < roundSince) continue;
      const dlat = (s.lat - seed.clat) * KM_PER_DEG;
      const dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      const d = Math.hypot(dlat, dlon);
      if (d <= cfg.maxFocusKm) roundD.push(d);
    }
    roundD.sort((a, b) => a - b);
    let radius = cfg.maxFocusKm;
    if (roundD.length >= cfg.targetRoundStrikes) radius = Math.max(cfg.minFocusKm, roundD[cfg.targetRoundStrikes - 1]);
    else if (roundD.length) radius = Math.max(cfg.minFocusKm, Math.min(cfg.maxFocusKm, roundD[roundD.length - 1]));
    const sepKm = Math.max(cfg.minSepKm, Math.min(cfg.maxSepKm, radius * cfg.separationFrac));
    const r2 = radius * radius;
    const gathered = recent.filter((s) => {
      const dlat = (s.lat - seed.clat) * KM_PER_DEG;
      const dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      return dlat * dlat + dlon * dlon <= r2;
    });
    // Anchor the frame on the SEED (not the gathered centroid) so several seeds
    // over one big storm yield distinct, partially-overlapping zones.
    const zone = buildZone(gathered, now, roundSince, cfg, seed.clat, seed.clon);
    if (!zone) continue;
    // Separate on the seed centre. sepKm < zone width ⇒ mild overlap (distinct
    // centres, shared edges), so dense systems tile into several playable zones.
    accepted.push({ clat: seed.clat, clon: seed.clon, sepKm });
    zones.push(zone);
    if (zones.length >= cfg.maxZones) break;
  }
  zones.sort((a, b) => b.score - a.score);
  return zones;
}

function buildZone(
  all: Pt[], now: number, roundSince: number, cfg: ZoneConfig,
  anchorLat?: number, anchorLon?: number,
): PlayableZone | null {
  if (!all.length) return null;

  // recency-weighted centroid + spread (km). If an anchor (the seed) is supplied
  // we frame the zone on it rather than the centroid, so several seeds over one
  // storm produce distinct, partially-overlapping zones instead of collapsing.
  let sw = 0, sx = 0, sy = 0;
  for (const s of all) {
    const w = Math.exp(-(now - s.t) / cfg.tauMs);
    sw += w; sx += w * s.lon; sy += w * s.lat;
  }
  if (sw <= 0) return null;
  const clat = anchorLat != null ? anchorLat : sy / sw;
  const clon = anchorLon != null ? anchorLon : sx / sw;
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
