// lib/grid-game/pricing.ts
// ─────────────────────────────────────────────────────────────────────────────
// INVERSE-DENSITY PRICING for the Grid Game.  Design doc: ./PRICING.md
//
// The game pays per strike: payout = strikes × multiplier × credits over the
// bet's counting window T. So each cell's multiplier ≈ the inverse of its
// EXPECTED strike COUNT (λ) over T. Hot cell → low multiplier; cold cell → high
// multiplier. (Inverse of λ, not of probability — a per-strike payout at
// probability odds would make hot cells hugely +EV; see PRICING.md.)
//
// The whole point (see PRICING.md §"Preserving the edge"): we price OFF
// CURRENT/RECENT density only — never off predicted storm movement. That leaves
// a cold-but-incoming cell underpriced, so a player who reads where the storm is
// drifting (wind/cloud layers + observed cell motion) earns +EV by betting it
// before it heats up. Do NOT add a drift/movement term here or you erase the
// player's edge and turn the game back into "click the hottest cell".
//
// Adapted from the backend EAGZ model (lightning/eagz.py): same temporally-
// weighted (EWMA) per-cell counting and the same equirectangular cell mapping,
// but run client-side in real time so prices update live as density shifts.
//
// EVERYTHING TUNABLE LIVES IN `PRICING_CONFIG` BELOW — calibrate there.
// ─────────────────────────────────────────────────────────────────────────────

import type { Bounds } from '@/lib/map/countryBounds';
import type { CountryStrike } from '@/lib/api';
import { cellForStrikeEqui, type Grid } from './geo';

export interface PricingConfig {
  /** Lock/resolution window T (ms): the window a bet is exposed to strikes.
   *  Keep in sync with the game's LOCK_MS so displayed odds match reality. */
  windowMs: number;
  /** How far back (ms) strikes are considered for the rate estimate. Older
   *  strikes contribute ~nothing after a few half-lives; this just caps work. */
  observationMs: number;
  /** EWMA half-life (ms): how fast a cell "forgets" old strikes. Shorter =
   *  prices react faster to the storm moving (and are noisier). 30–60s. */
  halfLifeMs: number;
  /** House edge / overround (0..1). multiplier = (1/p)*(1-edge). Makes the
   *  crowd/fair price -EV, so you only profit by pricing better than the model
   *  (i.e. reading movement). ~0.10–0.15 is a normal book margin. */
  edge: number;
  /** Multiplier clamps. */
  multMin: number;
  multMax: number;
  /** Symmetric 3×3 spatial smoothing of the weighted per-cell counts. A strike
   *  near a cell edge informs neighbours too. KEEP LIGHT — heavy smoothing warms
   *  the storm's leading (cold) edge and erases the movement-reader's edge. The
   *  kernel is symmetric on purpose: it never anticipates the direction of
   *  travel, only acknowledges spatial spread. Weights are relative; the kernel
   *  is normalised to sum 1 so smoothing preserves total λ, only redistributes. */
  centerWeight: number;
  orthoWeight: number;
  diagWeight: number;
}

// EAGZ uses τ = 180s over a 10-min observation window for zone *shape*. For live
// per-round *pricing* over a 60s round we want faster reaction, so the half-life
// is shorter (45s) — see PRICING.md §Parameters.
export const PRICING_CONFIG: PricingConfig = {
  windowMs: 6_000, // = the bet's strike-counting window; keep in sync with BET_WINDOW_MS
  observationMs: 90_000,
  halfLifeMs: 45_000,
  edge: 0.12,
  multMin: 1.05,
  multMax: 10,
  centerWeight: 1.0,
  orthoWeight: 0.25,
  diagWeight: 0.08,
};

export interface CellPrice {
  /** Payout multiplier shown on the cell and used at resolution. */
  multiplier: number;
  /** P(at least one qualifying strike in window T), Poisson. */
  p: number;
  /** Expected qualifying strikes in window T. */
  lambda: number;
  /** Temporally-weighted recent strike count feeding the estimate (debug/heat). */
  weight: number;
}

const LN2 = Math.log(2);

/**
 * Price every cell of `grid` over `bounds` from `strikes`, as of `now` (ms).
 * Returns one CellPrice per cell, indexed `row * cols + col`.
 */
export function priceCells(
  strikes: CountryStrike[],
  bounds: Bounds,
  grid: Grid,
  now: number,
  cfg: PricingConfig = PRICING_CONFIG,
): CellPrice[] {
  const nCells = grid.cols * grid.rows;
  const tauMs = cfg.halfLifeMs / LN2; // exp decay constant from half-life
  const tScale = cfg.windowMs / tauMs; // λ = weightedCount * (T / τ)

  // 1) Temporally-weighted per-cell strike counts (EWMA), equirectangular mapping.
  const raw = new Array<number>(nCells).fill(0);
  for (const s of strikes) {
    const t = Date.parse(s.received_at);
    if (!Number.isFinite(t)) continue;
    const age = now - t;
    if (age < 0 || age > cfg.observationMs) continue;
    const cell = cellForStrikeEqui(s.lat, s.lon, bounds, grid);
    if (cell === null) continue;
    raw[cell] += Math.exp(-age / tauMs);
  }

  // 2) Light symmetric spatial smoothing (normalised 3×3 kernel).
  const kSum = cfg.centerWeight + 4 * cfg.orthoWeight + 4 * cfg.diagWeight;
  const smoothed = new Array<number>(nCells).fill(0);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      let acc = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue;
          const w = dr === 0 && dc === 0 ? cfg.centerWeight : dr === 0 || dc === 0 ? cfg.orthoWeight : cfg.diagWeight;
          acc += w * raw[r * grid.cols + c];
        }
      }
      smoothed[row * grid.cols + col] = acc / kSum;
    }
  }

  // 3) Rate → λ (expected strike COUNT over T) → inverse-of-λ multiplier + edge.
  //    The game pays per strike (payout = strikes × multiplier × credits), so the
  //    fair price is 1/E[count] = 1/λ, NOT 1/P(≥1). Using 1/p here would make hot
  //    cells hugely +EV (since p ≪ λ when λ is large) and destroy the cold-cell
  //    edge — see PRICING.md §"Count-based payout". `p` is kept for reference only.
  return smoothed.map((weight) => {
    const lambda = weight * tScale; // E[strikes in T] = (weight/τ)·T
    const p = 1 - Math.exp(-lambda); // P(≥1 strike in T) — informational
    const fair = lambda > 1e-6 ? 1 / lambda : cfg.multMax / (1 - cfg.edge);
    const multiplier = clamp(fair * (1 - cfg.edge), cfg.multMin, cfg.multMax);
    return { multiplier: round2(multiplier), p, lambda, weight };
  });
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
function round2(x: number) {
  return Math.round(x * 100) / 100;
}
