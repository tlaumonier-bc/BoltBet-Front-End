// lib/grid-game/bot.ts
// ─────────────────────────────────────────────────────────────────────────────
// The v2 opponent. It must ALSO distribute a stake — but as a NAIVE DENSITY
// CHASER: it allocates roughly proportional to the current heatmap density and
// is blind to the payout multipliers and to where the storm is *moving*. So it
// keeps piling onto the obvious hot cells (which carry low multipliers), and a
// player who reads storm movement and buys underpriced cold-but-incoming cells
// beats it over a match.
//
// ALL DIFFICULTY LIVES IN `BOT_CONFIG` — calibrate there. (Budget is passed in
// from the game config so player and bot always share the same per-round budget.)
// ─────────────────────────────────────────────────────────────────────────────

export interface BotConfig {
  /** How sharply the bot concentrates on the hottest cells.
   *  1 = allocate linearly in density; >1 = pile onto the very hottest (lower EV,
   *  higher variance); <1 = flatter/safer. This is the main difficulty dial. */
  chaseExponent: number;
  /** Multiplicative jitter (0..1) on per-cell weights so the bot isn't perfectly
   *  deterministic round to round. 0 = deterministic. */
  noise: number;
  /** If the storm covers very few hot cells, also sprinkle stake on this many
   *  random cells so the bot doesn't dump everything on one cell. */
  scatterCells: number;
  // ── Future difficulty (kept here so calibration stays in one place) ──────────
  // A `foresight` knob (0..1) could blend in a movement-aware allocation to make
  // the bot harder. Intentionally absent in the baseline: the bot must be beatable
  // by a movement-reading human (see PRICING.md §1).
}

export const BOT_CONFIG: BotConfig = {
  chaseExponent: 1.5,
  noise: 0.35,
  scatterCells: 3,
};

/**
 * Allocate `budget` integer stake units across `nCells` from the current
 * per-cell `density` (temporally-weighted recent strike counts — the same signal
 * the heatmap shows). Returns an int array of length `nCells` summing to
 * `budget`. `rng` defaults to Math.random; pass a seeded rng for tests.
 */
export function allocateBot(
  density: number[],
  budget: number,
  nCells: number,
  cfg: BotConfig = BOT_CONFIG,
  rng: () => number = Math.random,
): number[] {
  const weights = new Array<number>(nCells).fill(0);

  let hot = 0;
  for (let i = 0; i < nCells; i += 1) {
    const d = density[i] ?? 0;
    if (d > 0) {
      const jitter = 1 + cfg.noise * (rng() * 2 - 1);
      weights[i] = Math.pow(d, cfg.chaseExponent) * Math.max(0, jitter);
      if (weights[i] > 0) hot += 1;
    }
  }

  // If the storm barely covers any cell, scatter a little onto random cells so
  // the bot still fields a spread (and can occasionally luck into a cold hit).
  if (hot < cfg.scatterCells) {
    for (let k = 0; k < cfg.scatterCells; k += 1) {
      const i = Math.floor(rng() * nCells);
      weights[i] += 0.001 * (1 + rng());
    }
  }

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // No signal at all → single random chip so the round still resolves.
    const stakes = new Array<number>(nCells).fill(0);
    stakes[Math.floor(rng() * nCells)] = budget;
    return stakes;
  }

  // Largest-remainder rounding so the integer stakes sum exactly to `budget`.
  const exact = weights.map((w) => (w / total) * budget);
  const floors = exact.map((x) => Math.floor(x));
  let used = floors.reduce((a, b) => a + b, 0);
  const remainders = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r);
  let k = 0;
  while (used < budget && k < remainders.length) {
    floors[remainders[k].i] += 1;
    used += 1;
    k += 1;
  }
  return floors;
}
