// test/backtest.mjs
// Backtest for the Grid Game "active zone" search.
//
// Replays 30 min of real global strikes, and every STEP_MS (3 s) runs a
// zone-detection model over the strikes visible up to that instant, counting how
// many playable zones exist worldwide. Also measures GAME QUALITY per zone:
//   - hNorm     : normalized Shannon entropy of strikes across the zone's cells
//                 over the round window (1 = perfectly spread, 0 = one cell).
//   - topShare  : fraction of the zone's round strikes in its single hottest cell
//                 (lower = better; high = "just click the hot cell").
//
// Goal (per brief): on average ~5 playable zones worldwide, AND well-dispersed
// strikes inside each zone (high hNorm / low topShare).
//
// Run:  node test/backtest.mjs
//       node test/backtest.mjs <configName>   (run one config, verbose)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dir, 'data', 'strikes-30m.json'), 'utf8'));
const STRIKES = (raw.strikes || [])
  .map((s) => ({ lat: s.lat, lon: s.lon, t: Date.parse(s.received_at) }))
  .filter((s) => Number.isFinite(s.t))
  .sort((a, b) => a.t - b.t);

const T0 = STRIKES[0].t;
const T1 = STRIKES[STRIKES.length - 1].t;
const STEP_MS = 3_000; // "every 3s we search for new zones"
const KM_PER_DEG = 111.32;

const cosLat = (lat) => Math.max(0.01, Math.cos((lat * Math.PI) / 180));

// ── the tunable model ────────────────────────────────────────────────────────
// GLOBAL detector. Two modes:
//   'region' — flood-fill connected active coarse bins, one zone per region
//              (focused on its densest bin). Good quality, but under-counts when
//              a storm system has several cells.
//   'peaks'  — greedy top density peaks: repeatedly take the hottest coarse bin,
//              carve out a zone around it, and suppress nearby bins so distinct
//              storm cells each become their own tight, well-dispersed zone.
function coarseBins(strikes, now, cfg) {
  const obsSince = now - cfg.obsMs;
  const bins = new Map();
  for (const s of strikes) {
    if (s.t < obsSince || s.t > now) continue;
    const cx = Math.floor((s.lon + 180) / cfg.coarseDeg);
    const cy = Math.floor((s.lat + 90) / cfg.coarseDeg);
    const key = cx + ',' + cy;
    let b = bins.get(key);
    if (!b) {
      b = { cx, cy, w: 0, sw: 0, slat: 0, slon: 0, strikes: [] };
      bins.set(key, b);
    }
    const w = Math.exp(-(now - s.t) / cfg.tauMs);
    b.w += w; b.sw += w; b.slat += w * s.lat; b.slon += w * s.lon;
    b.strikes.push(s);
  }
  return bins;
}

function detectZonesRegion(strikes, now, cfg) {
  const roundSince = now - cfg.roundMs;
  const bins = coarseBins(strikes, now, cfg);
  const active = new Map();
  for (const [k, b] of bins) if (b.w >= cfg.minCellWeight) active.set(k, b);
  const seen = new Set();
  const zones = [];
  for (const [key, start] of active) {
    if (seen.has(key)) continue;
    const comp = [];
    const stack = [start];
    seen.add(key);
    while (stack.length) {
      const b = stack.pop();
      comp.push(b);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const nk = b.cx + dx + ',' + (b.cy + dy);
          if (active.has(nk) && !seen.has(nk)) {
            seen.add(nk);
            stack.push(active.get(nk));
          }
        }
      }
    }
    let all = [];
    for (const b of comp) all = all.concat(b.strikes);
    if (cfg.focusRadiusKm > 0 && comp.length > 1) {
      let peak = comp[0];
      for (const b of comp) if (b.w > peak.w) peak = b;
      const plat = peak.slat / peak.sw;
      const plon = peak.slon / peak.sw;
      const r2 = cfg.focusRadiusKm ** 2;
      const c = cosLat(plat);
      all = all.filter((s) => {
        const dlat = (s.lat - plat) * KM_PER_DEG;
        const dlon = (s.lon - plon) * KM_PER_DEG * c;
        return dlat * dlat + dlon * dlon <= r2;
      });
    }
    const zone = buildZone(all, now, roundSince, cfg);
    if (zone) zones.push(zone);
  }
  zones.sort((a, b) => b.roundCount - a.roundCount);
  return zones;
}

function detectZonesPeaks(strikes, now, cfg) {
  const roundSince = now - cfg.roundMs;
  const recent = strikes.filter((s) => s.t >= now - cfg.obsMs && s.t <= now);
  const bins = coarseBins(recent, now, cfg);
  const list = [...bins.values()]
    .map((b) => ({ w: b.w, clat: b.slat / b.sw, clon: b.slon / b.sw }))
    .sort((a, b) => b.w - a.w);
  const zones = [];
  const accepted = []; // {clat, clon, sepKm} — centres of ACCEPTED zones
  const tooClose = (lat, lon) => accepted.some((a) => {
    const dlat = (lat - a.clat) * KM_PER_DEG;
    const dlon = (lon - a.clon) * KM_PER_DEG * cosLat(a.clat);
    return dlat * dlat + dlon * dlon <= a.sepKm * a.sepKm;
  });
  for (const seed of list) {
    if (seed.w < cfg.minCellWeight) break; // sorted desc: nothing hotter remains
    const c = cosLat(seed.clat);
    if (tooClose(seed.clat, seed.clon)) continue; // seed inside an accepted zone

    // ADAPTIVE radius: grow until the zone gathers ~targetRoundStrikes strikes in
    // the round window (bigger in quiet periods, small when storms are dense),
    // capped at maxFocusKm. Then separation scales with the chosen radius.
    const roundD = [];
    for (const s of recent) {
      if (s.t < roundSince) continue;
      const dlat = (s.lat - seed.clat) * KM_PER_DEG;
      const dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      const d = Math.hypot(dlat, dlon);
      if (d <= cfg.maxFocusKm) roundD.push(d);
    }
    roundD.sort((a, b) => a - b);
    let R = cfg.maxFocusKm;
    if (roundD.length >= cfg.targetRoundStrikes) R = Math.max(cfg.minFocusKm, roundD[cfg.targetRoundStrikes - 1]);
    else if (roundD.length) R = Math.max(cfg.minFocusKm, Math.min(cfg.maxFocusKm, roundD[roundD.length - 1]));
    const sepKm = Math.max(cfg.minSepKm, Math.min(cfg.maxSepKm, R * cfg.separationFrac));
    const r2 = R * R;
    const gathered = recent.filter((s) => {
      const dlat = (s.lat - seed.clat) * KM_PER_DEG;
      const dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      return dlat * dlat + dlon * dlon <= r2;
    });
    // BALANCED: anchor the zone frame on the SEED (not the gathered centroid), so
    // several seeds over one big storm yield distinct, partially-overlapping zones
    // instead of all collapsing onto the storm's centre of mass.
    const zone = buildZone(gathered, now, roundSince, cfg, seed.clat, seed.clon);
    if (!zone) continue;
    // Separate on the SEED centre. sepKm < zone width ⇒ mild overlap (shared edges,
    // distinct centres) → ~4–5 zones over dense systems, no exact duplicates.
    accepted.push({ clat: seed.clat, clon: seed.clon, sepKm });
    zones.push(zone);
    if (zones.length >= cfg.maxZones) break;
  }
  zones.sort((a, b) => b.roundCount - a.roundCount);
  return zones;
}

function detectZones(strikes, now, cfg) {
  return cfg.mode === 'peaks' ? detectZonesPeaks(strikes, now, cfg) : detectZonesRegion(strikes, now, cfg);
}

function buildZone(all, now, roundSince, cfg, anchorLat, anchorLon) {
  if (!all.length) return null;

  // weighted centroid + spread (km). If an anchor (the seed) is given, frame the
  // zone on it instead of the centroid, so nearby seeds over one storm produce
  // distinct, partially-overlapping zones rather than collapsing to one.
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

  const roundCount = all.filter((s) => s.t >= roundSince).length;
  if (roundCount < cfg.minRoundStrikes) return null;

  // adaptive dims: ~targetPerCell strikes per cell over the round
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

  // dispersion over the ROUND window (what the player experiences)
  const counts = new Array(cols * rows).fill(0);
  let inGrid = 0;
  for (const s of all) {
    if (s.t < roundSince) continue;
    const rx = (s.lon - minLon) / spanLon;
    const ry = (maxLat - s.lat) / spanLat;
    if (rx < 0 || rx >= 1 || ry < 0 || ry >= 1) continue;
    const col = Math.min(cols - 1, Math.floor(rx * cols));
    const row = Math.min(rows - 1, Math.floor(ry * rows));
    counts[row * cols + col] += 1;
    inGrid += 1;
  }
  if (inGrid < cfg.minRoundStrikes) return null;
  let h = 0, top = 0;
  for (const n of counts) {
    if (n > 0) {
      const p = n / inGrid;
      h -= p * Math.log(p);
      if (n > top) top = n;
    }
  }
  const hNorm = h / Math.log(cols * rows);
  if (hNorm < cfg.entropyThreshold) return null;

  return {
    minLat, maxLat, minLon, maxLon, cols, rows,
    roundCount: inGrid,
    hNorm,
    topShare: top / inGrid,
    widthKm: spanLon * KM_PER_DEG * cosLat(clat),
  };
}

// ── run one config over the whole replay ─────────────────────────────────────
function runConfig(cfg) {
  const startTick = T0 + Math.max(cfg.obsMs, cfg.roundMs);
  const counts = [];
  const roundCounts = [];
  let entropySum = 0, topSum = 0, zoneObs = 0;
  let widthSum = 0, strikeSum = 0, ge100 = 0;
  for (let now = startTick; now <= T1; now += STEP_MS) {
    const zones = detectZones(STRIKES, now, cfg);
    counts.push(zones.length);
    for (const z of zones) {
      entropySum += z.hNorm;
      topSum += z.topShare;
      widthSum += z.widthKm;
      strikeSum += z.roundCount;
      roundCounts.push(z.roundCount);
      if (z.roundCount >= 100) ge100 += 1;
      zoneObs += 1;
    }
  }
  counts.sort((a, b) => a - b);
  roundCounts.sort((a, b) => a - b);
  const n = counts.length;
  const avg = counts.reduce((a, b) => a + b, 0) / n;
  const median = counts[Math.floor(n / 2)];
  const pct = (k) => ((counts.filter((c) => c >= k).length / n) * 100).toFixed(0);
  return {
    avg: avg.toFixed(2),
    median,
    pctGe5: pct(5),
    avgStrk: zoneObs ? (strikeSum / zoneObs).toFixed(0) : '-',
    medStrk: roundCounts.length ? roundCounts[Math.floor(roundCounts.length / 2)] : '-',
    pctZoneGe100: zoneObs ? ((ge100 / zoneObs) * 100).toFixed(0) : '-',
    hNorm: zoneObs ? (entropySum / zoneObs).toFixed(2) : '-',
    topShare: zoneObs ? (topSum / zoneObs).toFixed(2) : '-',
    widthKm: zoneObs ? (widthSum / zoneObs).toFixed(0) : '-',
  };
}

// ── configs ──────────────────────────────────────────────────────────────────
const BASE = {
  mode: 'region',
  obsMs: 300_000,   // 5 min lookback for shape/activity
  roundMs: 60_000,  // round window (dispersion measured here)
  tauMs: 150_000,   // recency half-life-ish decay constant
  coarseDeg: 1.0,   // coarse bin size for region detection
  minCellWeight: 1.5,
  focusRadiusKm: 0, // 0 = don't focus (keep whole region)
  separationKm: 130, // peaks mode: min distance between distinct zones
  maxZones: 12,      // peaks mode: hard cap
  minSigmaKm: 8,
  minRoundStrikes: 6,
  targetPerCell: 1.5,
  sigmaK: 1.8,
  minCols: 5, minRows: 4, maxCols: 12, maxRows: 10,
  entropyThreshold: 0.5,
};

// Best region-mode config from the last sweep, as a quality reference.
const REGION_REF = { ...BASE, coarseDeg: 0.3, focusRadiusKm: 45, obsMs: 420_000, tauMs: 150_000, entropyThreshold: 0.55, targetPerCell: 1.2, minCellWeight: 1.5, minRoundStrikes: 5 };

// PEAKS mode: greedy top density peaks → one tight zone per storm cell.
const PK = {
  ...BASE, mode: 'peaks', obsMs: 420_000, tauMs: 150_000, roundMs: 60_000,
  coarseDeg: 0.5, focusRadiusKm: 90, separationKm: 160, minSigmaKm: 10,
  targetPerCell: 1.3, sigmaK: 1.8, entropyThreshold: 0.5, minRoundStrikes: 5, maxZones: 12,
};
// GOAL: bigger, denser zones — avg ≥100 strikes/zone/min, still ≥5 zones avg,
// still reasonably distributed. Lever: larger focus radius (gather more strikes)
// + matching separation, coarser bins, slightly relaxed entropy.
const PKB = { ...PK, coarseDeg: 0.3, minCellWeight: 0.7, minRoundStrikes: 3, obsMs: 420_000, tauMs: 150_000, targetPerCell: 2.0, entropyThreshold: 0.5 };
// ADAPTIVE-radius model: each zone grows to gather ~targetRoundStrikes, capped at
// maxFocusKm; separation scales with the chosen radius. minRoundStrikes stays a
// floor so near-empty peaks are dropped.
const ADAPT = { ...PKB, minRoundStrikes: 25, minFocusKm: 60, separationFrac: 0.5, minSepKm: 45, maxSepKm: 220 };
// BALANCED: dedupe distance small enough to allow partial overlap (distinct
// centres, shared edges) → ~4–5 zones without exact duplicates.
// Seed-anchored: separation is now an ABSOLUTE seed-centre spacing (pin
// minSepKm==maxSepKm). Smaller spacing ⇒ more tiling/overlap ⇒ more zones.
// o = {sep, target, maxFocus, minCellWeight, coarseDeg, minRound}
const bal = (o) => ({
  ...ADAPT, separationFrac: 1, minSepKm: o.sep, maxSepKm: o.sep,
  targetRoundStrikes: o.tgt ?? 110, maxFocusKm: o.maxF ?? 300,
  minCellWeight: o.mcw ?? 0.7, coarseDeg: o.cd ?? 0.3, minRoundStrikes: o.mrs ?? 25,
});
const CONFIGS = {
  // relax seed gate + finer bins to admit more distinct peaks
  A_mcw04: bal({ sep: 80, tgt: 100, mcw: 0.4, cd: 0.25 }),
  B_mcw03: bal({ sep: 80, tgt: 100, mcw: 0.3, cd: 0.25 }),
  C_cd20:  bal({ sep: 75, tgt: 100, mcw: 0.4, cd: 0.2 }),
  D_cd20b: bal({ sep: 65, tgt: 95,  mcw: 0.35, cd: 0.2, mrs: 20 }),
  E_lo:    bal({ sep: 60, tgt: 90,  mcw: 0.3, cd: 0.2, mrs: 18 }),
  F_lo2:   bal({ sep: 55, tgt: 85,  mcw: 0.25, cd: 0.2, mrs: 18 }),
  // FINAL = "Balanced": ~5 zones on avg, distinct seed-anchored centres, ~74
  // strikes/zone (2.5× the old model), still distributed (hNorm ~0.58).
  FINAL: bal({ sep: 60, tgt: 90, mcw: 0.3, cd: 0.2, mrs: 18 }),
};

const only = process.argv[2];
const names = only ? [only] : Object.keys(CONFIGS);
const pad = (s, n) => String(s).padEnd(n);
console.log(`Data: ${STRIKES.length} strikes, ${((T1 - T0) / 60000).toFixed(1)} min, ~${(STRIKES.length / ((T1 - T0) / 60000)).toFixed(0)}/min global`);
console.log(pad('config', 16), pad('avgZ', 6), pad('medZ', 5), pad('%>=5', 6), pad('avgStrk', 8), pad('medStrk', 8), pad('%z>=100', 8), pad('hNorm', 7), pad('topSh', 6), 'widthKm');
for (const name of names) {
  const r = runConfig(CONFIGS[name]);
  console.log(pad(name, 16), pad(r.avg, 6), pad(r.median, 5), pad(r.pctGe5 + '%', 6), pad(r.avgStrk, 8), pad(r.medStrk, 8), pad(r.pctZoneGe100 + '%', 8), pad(r.hNorm, 7), pad(r.topShare, 6), r.widthKm);
}
