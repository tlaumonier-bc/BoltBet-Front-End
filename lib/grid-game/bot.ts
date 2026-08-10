// lib/grid-game/bot.ts
// ─────────────────────────────────────────────────────────────────────────────
// The Grid-Game opponent, rebuilt for the CONTINUOUS credit game (was a one-shot
// portfolio allocator in v2). Over the 60s round the bot repeatedly opens bets on
// live cells, resolved against the same real strike feed and prices as the player.
//
// Design goals (see the plan in chat + PRICING.md):
//   • "Not so dumb it busts instantly."  The game has a house edge: on a cell with
//     real strike expectation λ, multiplier ≈ (1/λ)(1−edge), so EV ≈ (1−edge)·stake
//     — you only bleed the edge. But on a near-empty cell λ→0 the multiplier is
//     clamped (multMax) and EV collapses toward 0 — a bet there is almost pure
//     loss. So a dumb bot that sprays big stakes onto cold/empty cells zeroes out
//     in seconds and ends the match early. This bot therefore ONLY bets cells with
//     λ ≥ `lambdaFloor` (real strike expectation, low-variance ~break-even-minus-
//     edge) and stakes a SMALL fraction of its balance, so it survives to 60s.
//   • "Not too smart."  It chases current density (chaseExponent) and is blind to
//     where the storm is *heading* — exactly what the pricing leaves underpriced —
//     so a human who reads storm movement (wind/track layers) still beats it.
//
// ALL DIFFICULTY LIVES IN `BOT_CONFIG` — calibrated with test/bot-sim.mjs, which
// replays real strikes and reports the bot's survive-to-60s rate + final balance.
// ─────────────────────────────────────────────────────────────────────────────

import type { CellPrice } from './pricing';

export interface BotConfig {
  /** Stake per bet as a fraction of the bot's CURRENT balance. Small ⇒ variance
   *  can't bust it before the clock runs out. Main survival dial. */
  stakeFrac: number;
  /** Gap between the bot's bets (ms), sampled uniformly in [min,max] so it feels
   *  human and doesn't fire on a fixed metronome. */
  minTickMs: number;
  maxTickMs: number;
  /** How sharply it favours the hottest cells. 1 = ∝ density; >1 piles onto the
   *  very hottest (lower variance, steadier); <1 = flatter. */
  chaseExponent: number;
  /** Multiplicative jitter (0..1) on per-cell weights so cell choice isn't
   *  deterministic. 0 = always the same ranking. */
  noise: number;
  /** Skip cells with expected strikes/window below this — they're multiplier-
   *  clamped and near-pure-loss (the trap that busts a naive bot). */
  lambdaFloor: number;
  /** Never hold more than this many live bets at once. */
  maxConcurrent: number;
}

// Calibrated in test/bot-sim.mjs: survives the full 60s in ~99% of replayed
// rounds, ending near its 100-credit start (bleeds only the house edge), while
// staying beatable by a movement-reading player.
export const BOT_CONFIG: BotConfig = {
  stakeFrac: 0.06,
  minTickMs: 1_500,
  maxTickMs: 2_600,
  chaseExponent: 1.2,
  noise: 0.3,
  lambdaFloor: 0.15,
  maxConcurrent: 4,
};

export interface BotBetDecision {
  cell: number;
  credits: number;
}

const MIN_STAKE = 1; // matches the game's MIN_BET

/**
 * Decide the bot's next bet from the live per-cell `prices`, its current
 * `balance`, and how many of its bets are still live (`liveBets`). Returns the
 * cell + integer stake, or `null` to sit this tick out (broke, at the concurrency
 * cap, or the zone has no cell worth betting right now).
 *
 * `rng` defaults to Math.random; pass a seeded rng in tests for reproducibility.
 */
export function pickBotBet(
  prices: readonly Pick<CellPrice, 'lambda' | 'multiplier'>[],
  balance: number,
  liveBets: number,
  cfg: BotConfig = BOT_CONFIG,
  rng: () => number = Math.random,
  occupied?: ReadonlySet<number>,
): BotBetDecision | null {
  if (balance < MIN_STAKE) return null;
  if (liveBets >= cfg.maxConcurrent) return null;

  // Candidate cells = those with a real strike expectation. Below the floor the
  // multiplier is clamped and the bet is near-pure-loss — the bot never touches
  // those (that's the whole "don't bust instantly" rule). Cells the bot already
  // holds a live bet on are skipped too (one stake per cell, like the player).
  const weights: { i: number; w: number }[] = [];
  let total = 0;
  for (let i = 0; i < prices.length; i += 1) {
    if (occupied?.has(i)) continue;
    const lambda = prices[i]?.lambda ?? 0;
    if (lambda < cfg.lambdaFloor) continue;
    const jitter = 1 + cfg.noise * (rng() * 2 - 1);
    const w = Math.pow(lambda, cfg.chaseExponent) * Math.max(0, jitter);
    if (w > 0) {
      weights.push({ i, w });
      total += w;
    }
  }
  if (!weights.length || total <= 0) return null; // quiet zone → fold this tick

  // Weighted-random pick (leans hot via chaseExponent, but not deterministic).
  let r = rng() * total;
  let cell = weights[weights.length - 1].i;
  for (const cand of weights) {
    r -= cand.w;
    if (r <= 0) {
      cell = cand.i;
      break;
    }
  }

  const stake = Math.max(MIN_STAKE, Math.min(Math.floor(balance), Math.round(cfg.stakeFrac * balance)));
  if (stake < MIN_STAKE || stake > balance) return null;
  return { cell, credits: stake };
}

/** Delay (ms) until the bot's next bet, sampled in [minTickMs, maxTickMs]. */
export function nextBotDelay(cfg: BotConfig = BOT_CONFIG, rng: () => number = Math.random): number {
  return cfg.minTickMs + rng() * (cfg.maxTickMs - cfg.minTickMs);
}
