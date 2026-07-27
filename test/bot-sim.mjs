// test/bot-sim.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Bot survival sim for the CONTINUOUS Grid Game. Replays 30 min of real strikes,
// and for many anchor times: detects the hottest playable zone (shipped
// ZONE_CONFIG), then plays a full 60s round as the bot ALONE — opening bets via
// the REAL bot logic (lib/grid-game/bot.ts, imported through node's type
// stripping) and resolving them against the actual strike feed with the REAL
// pricing (lib/grid-game/pricing.ts logic).
//
// Reports the bot's survive-to-60s rate and final-balance distribution. The bar:
// the game should reach the 60s finish MOST of the time (bot shouldn't bust early
// and end the match), while the bot still only drifts down by ~the house edge.
//
// Run:  node --experimental-strip-types test/bot-sim.mjs
//       node --experimental-strip-types test/bot-sim.mjs <stakeFrac> (override)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickBotBet, nextBotDelay, BOT_CONFIG } from '../lib/grid-game/bot.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dir, 'data', 'strikes-30m.json'), 'utf8'));
const STRIKES = (raw.strikes || [])
  .map((s) => ({ lat: s.lat, lon: s.lon, t: Date.parse(s.received_at) }))
  .filter((s) => Number.isFinite(s.t))
  .sort((a, b) => a.t - b.t);
const T0 = STRIKES[0].t;
const T1 = STRIKES[STRIKES.length - 1].t;

const KM_PER_DEG = 111.32;
const cosLat = (lat) => Math.max(0.01, Math.cos((lat * Math.PI) / 180));

// ── shipped ZONE_CONFIG (lib/grid-game/zones.ts) ─────────────────────────────
const CFG = {
  obsMs: 420_000, roundMs: 60_000, tauMs: 150_000, coarseDeg: 0.2, minCellWeight: 0.3,
  targetRoundStrikes: 90, minFocusKm: 60, maxFocusKm: 300, separationFrac: 1, minSepKm: 60, maxSepKm: 60,
  minSigmaKm: 10, minRoundStrikes: 18, targetPerCell: 2.0, sigmaK: 1.8,
  minCols: 5, minRows: 4, maxCols: 12, maxRows: 10, entropyThreshold: 0.5, maxZones: 12,
};

// ── shipped PRICING_CONFIG (lib/grid-game/pricing.ts) ────────────────────────
const PX = {
  windowMs: 6_000, observationMs: 90_000, halfLifeMs: 45_000, edge: 0.12,
  multMin: 1.05, multMax: 10, centerWeight: 1.0, orthoWeight: 0.25, diagWeight: 0.08,
};
const BET_WINDOW_MS = PX.windowMs;
const MIN_BET = 1;
const START_CREDITS = 100;
const GAME_MS = 60_000;

// seeded RNG (mulberry32) so runs are reproducible
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── zone detection (seed-anchored adaptive, mirrors zones.ts) ─────────────────
function detectHottestZone(now) {
  const recent = STRIKES.filter((s) => s.t >= now - CFG.obsMs && s.t <= now);
  if (!recent.length) return null;
  const bins = new Map();
  for (const s of recent) {
    const cx = Math.floor((s.lon + 180) / CFG.coarseDeg);
    const cy = Math.floor((s.lat + 90) / CFG.coarseDeg);
    const key = cx + ',' + cy;
    let b = bins.get(key);
    if (!b) { b = { w: 0, sw: 0, slat: 0, slon: 0 }; bins.set(key, b); }
    const w = Math.exp(-(now - s.t) / CFG.tauMs);
    b.w += w; b.sw += w; b.slat += w * s.lat; b.slon += w * s.lon;
  }
  const seeds = [...bins.values()].map((b) => ({ w: b.w, clat: b.slat / b.sw, clon: b.slon / b.sw })).sort((a, b) => b.w - a.w);
  const roundSince = now - CFG.roundMs;
  const accepted = [];
  const tooClose = (lat, lon) => accepted.some((a) => {
    const dlat = (lat - a.clat) * KM_PER_DEG, dlon = (lon - a.clon) * KM_PER_DEG * cosLat(a.clat);
    return dlat * dlat + dlon * dlon <= a.sepKm * a.sepKm;
  });
  const zones = [];
  for (const seed of seeds) {
    if (seed.w < CFG.minCellWeight) break;
    if (tooClose(seed.clat, seed.clon)) continue;
    const c = cosLat(seed.clat);
    const roundD = [];
    for (const s of recent) {
      if (s.t < roundSince) continue;
      const dlat = (s.lat - seed.clat) * KM_PER_DEG, dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      const d = Math.hypot(dlat, dlon);
      if (d <= CFG.maxFocusKm) roundD.push(d);
    }
    roundD.sort((a, b) => a - b);
    let R = CFG.maxFocusKm;
    if (roundD.length >= CFG.targetRoundStrikes) R = Math.max(CFG.minFocusKm, roundD[CFG.targetRoundStrikes - 1]);
    else if (roundD.length) R = Math.max(CFG.minFocusKm, Math.min(CFG.maxFocusKm, roundD[roundD.length - 1]));
    const sepKm = Math.max(CFG.minSepKm, Math.min(CFG.maxSepKm, R * CFG.separationFrac));
    const r2 = R * R;
    const gathered = recent.filter((s) => {
      const dlat = (s.lat - seed.clat) * KM_PER_DEG, dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      return dlat * dlat + dlon * dlon <= r2;
    });
    const z = buildZone(gathered, now, roundSince, seed.clat, seed.clon);
    if (!z) continue;
    accepted.push({ clat: seed.clat, clon: seed.clon, sepKm });
    zones.push(z);
    if (zones.length >= CFG.maxZones) break;
  }
  zones.sort((a, b) => b.roundCount - a.roundCount);
  return zones[0] ?? null;
}

function buildZone(all, now, roundSince, anchorLat, anchorLon) {
  if (!all.length) return null;
  let sw = 0, sx = 0, sy = 0;
  for (const s of all) { const w = Math.exp(-(now - s.t) / CFG.tauMs); sw += w; sx += w * s.lon; sy += w * s.lat; }
  if (sw <= 0) return null;
  const clat = anchorLat, clon = anchorLon;
  let vlat = 0, vlon = 0;
  for (const s of all) { const w = Math.exp(-(now - s.t) / CFG.tauMs); vlat += w * (s.lat - clat) ** 2; vlon += w * (s.lon - clon) ** 2; }
  const sigLatKm = Math.max(CFG.minSigmaKm, Math.sqrt(vlat / sw) * KM_PER_DEG);
  const sigLonKm = Math.max(CFG.minSigmaKm, Math.sqrt(vlon / sw) * KM_PER_DEG * cosLat(clat));
  const roundCount = all.filter((s) => s.t >= roundSince).length;
  if (roundCount < CFG.minRoundStrikes) return null;
  const target = roundCount / CFG.targetPerCell;
  const nCells = Math.max(CFG.minCols * CFG.minRows, Math.min(CFG.maxCols * CFG.maxRows, target));
  const aspect = sigLonKm / Math.max(0.01, sigLatKm);
  let rows = Math.max(CFG.minRows, Math.min(CFG.maxRows, Math.round(Math.sqrt(nCells / Math.max(0.1, aspect)))));
  let cols = Math.max(CFG.minCols, Math.min(CFG.maxCols, Math.round(nCells / Math.max(1, rows))));
  const halfHDeg = (CFG.sigmaK * sigLatKm) / KM_PER_DEG;
  const halfWDeg = (CFG.sigmaK * sigLonKm) / (KM_PER_DEG * cosLat(clat));
  const bounds = { minLat: clat - halfHDeg, maxLat: clat + halfHDeg, minLon: clon - halfWDeg, maxLon: clon + halfWDeg };
  if (bounds.maxLat <= bounds.minLat || bounds.maxLon <= bounds.minLon) return null;
  // dispersion gate
  const counts = new Array(cols * rows).fill(0);
  let inGrid = 0;
  for (const s of all) {
    if (s.t < roundSince) continue;
    const cell = cellForStrike(s.lat, s.lon, bounds, cols, rows);
    if (cell === null) continue;
    counts[cell] += 1; inGrid += 1;
  }
  if (inGrid < CFG.minRoundStrikes) return null;
  let h = 0;
  for (const n of counts) { if (n > 0) { const p = n / inGrid; h -= p * Math.log(p); } }
  if (h / Math.log(cols * rows) < CFG.entropyThreshold) return null;
  return { bounds, cols, rows, roundCount: inGrid };
}

function cellForStrike(lat, lon, bounds, cols, rows) {
  const spanLon = bounds.maxLon - bounds.minLon, spanLat = bounds.maxLat - bounds.minLat;
  if (spanLon <= 0 || spanLat <= 0) return null;
  const rx = (lon - bounds.minLon) / spanLon, ry = (bounds.maxLat - lat) / spanLat;
  if (rx < 0 || rx >= 1 || ry < 0 || ry >= 1) return null;
  return Math.min(rows - 1, Math.floor(ry * rows)) * cols + Math.min(cols - 1, Math.floor(rx * cols));
}

// ── pricing (mirrors lib/grid-game/pricing.ts priceCells) ────────────────────
const LN2 = Math.log(2);
function priceCells(strikes, bounds, cols, rows, now) {
  const nCells = cols * rows;
  const tau = PX.halfLifeMs / LN2;
  const tScale = PX.windowMs / tau;
  const rawArr = new Array(nCells).fill(0);
  for (const s of strikes) {
    const age = now - s.t;
    if (age < 0 || age > PX.observationMs) continue;
    const cell = cellForStrike(s.lat, s.lon, bounds, cols, rows);
    if (cell === null) continue;
    rawArr[cell] += Math.exp(-age / tau);
  }
  const kSum = PX.centerWeight + 4 * PX.orthoWeight + 4 * PX.diagWeight;
  const out = new Array(nCells);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let acc = 0;
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        const r = row + dr, c = col + dc;
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const w = dr === 0 && dc === 0 ? PX.centerWeight : dr === 0 || dc === 0 ? PX.orthoWeight : PX.diagWeight;
        acc += w * rawArr[r * cols + c];
      }
      const weight = acc / kSum;
      const lambda = weight * tScale;
      const fair = lambda > 1e-6 ? 1 / lambda : PX.multMax / (1 - PX.edge);
      const multiplier = Math.round(Math.max(PX.multMin, Math.min(PX.multMax, fair * (1 - PX.edge))) * 100) / 100;
      out[row * cols + col] = { lambda, multiplier };
    }
  }
  return out;
}

// ── play one 60s round as the bot alone ──────────────────────────────────────
function playRound(zone, t0, rng) {
  const { bounds, cols, rows } = zone;
  // pre-bin every strike in the zone bbox by cell, sorted by time
  const zoneStrikes = STRIKES.filter((s) => cellForStrike(s.lat, s.lon, bounds, cols, rows) !== null)
    .map((s) => ({ t: s.t, cell: cellForStrike(s.lat, s.lon, bounds, cols, rows) }));
  const SIM_STEP = 200;
  let balance = START_CREDITS;
  let bets = []; // {cell, stake, mult, startedAt, expiresAt, idx}
  let nextBet = t0 + nextBotDelay(BOT_CONFIG, rng);
  let placed = 0, folds = 0;
  const end = t0 + GAME_MS;

  for (let now = t0; now <= end; now += SIM_STEP) {
    // resolve: credit new strikes in each live bet's cell
    for (const bet of bets) {
      const windowEnd = Math.min(now, bet.expiresAt);
      while (bet.idx < zoneStrikes.length) {
        const zs = zoneStrikes[bet.idx];
        if (zs.t > windowEnd) break;
        if (zs.t >= bet.startedAt && zs.cell === bet.cell) balance += bet.mult * bet.stake;
        bet.idx += 1;
      }
    }
    // advance each bet's scan cursor lazily is complex; instead recount is O(n). To
    // keep per-bet counting correct we store idx per bet initialized at placement.

    const liveBets = bets.filter((b) => now <= b.expiresAt).length;
    const busted = balance < MIN_BET && !bets.some((b) => now <= b.expiresAt);
    if (busted) return { survived: false, bustAt: now - t0, final: balance, placed, folds };

    if (now >= nextBet && balance >= MIN_BET) {
      const prices = priceCells(STRIKES, bounds, cols, rows, now);
      const occupied = new Set(bets.filter((b) => now <= b.expiresAt).map((b) => b.cell));
      const dec = pickBotBet(prices, balance, liveBets, BOT_CONFIG, rng, occupied);
      if (dec) {
        balance -= dec.credits;
        // start this bet's scan cursor at the first strike with t >= startedAt
        let idx = 0; while (idx < zoneStrikes.length && zoneStrikes[idx].t < now) idx += 1;
        bets.push({ cell: dec.cell, stake: dec.credits, mult: prices[dec.cell].multiplier, startedAt: now, expiresAt: now + BET_WINDOW_MS, idx });
        placed += 1;
        nextBet = now + nextBotDelay(BOT_CONFIG, rng);
      } else {
        folds += 1;
        nextBet = now + 800; // quiet/at-cap → try again shortly
      }
    }
    // drop fully-resolved bets to keep the array small
    bets = bets.filter((b) => now <= b.expiresAt);
  }
  return { survived: true, bustAt: null, final: balance, placed, folds };
}

// ── run the sweep ────────────────────────────────────────────────────────────
const override = process.argv[2] ? Number(process.argv[2]) : null;
if (override != null && Number.isFinite(override)) BOT_CONFIG.stakeFrac = override;

const ANCHOR_STEP = 15_000; // start a round every 15s of replay
const rounds = [];
let anchorsWithZone = 0, anchorsTotal = 0;
for (let now = T0 + CFG.obsMs; now <= T1 - GAME_MS; now += ANCHOR_STEP) {
  anchorsTotal += 1;
  const zone = detectHottestZone(now);
  if (!zone) continue;
  anchorsWithZone += 1;
  // a few seeds per anchor to average over bot RNG
  for (let seed = 0; seed < 3; seed += 1) {
    rounds.push(playRound(zone, now, mulberry32((now % 100000) * 7 + seed * 101 + 1)));
  }
}

const n = rounds.length;
const survived = rounds.filter((r) => r.survived).length;
const finals = rounds.map((r) => r.final).sort((a, b) => a - b);
const mean = finals.reduce((a, b) => a + b, 0) / n;
const median = finals[Math.floor(n / 2)];
const placed = rounds.reduce((a, r) => a + r.placed, 0) / n;
const busts = rounds.filter((r) => !r.survived);
const meanBustAt = busts.length ? (busts.reduce((a, r) => a + r.bustAt, 0) / busts.length / 1000).toFixed(1) : '-';

console.log(`Data: ${STRIKES.length} strikes, ${((T1 - T0) / 60000).toFixed(1)} min`);
console.log(`Zones found at ${anchorsWithZone}/${anchorsTotal} anchors · ${n} rounds simulated`);
console.log(`BOT_CONFIG.stakeFrac=${BOT_CONFIG.stakeFrac} lambdaFloor=${BOT_CONFIG.lambdaFloor} chaseExp=${BOT_CONFIG.chaseExponent} maxConcurrent=${BOT_CONFIG.maxConcurrent}`);
console.log('');
console.log(`survive-to-60s : ${((survived / n) * 100).toFixed(1)}%  (${survived}/${n})`);
console.log(`final balance  : mean ${mean.toFixed(1)}  median ${median.toFixed(0)}  min ${finals[0].toFixed(0)}  max ${finals[n - 1].toFixed(0)}  (start ${START_CREDITS})`);
console.log(`bets / round   : ${placed.toFixed(1)} placed`);
if (busts.length) console.log(`busts          : ${busts.length}, mean bust at ${meanBustAt}s`);
