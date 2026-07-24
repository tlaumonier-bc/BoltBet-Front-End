# Grid Game v2 — Inverse-Density Pricing (IDP-1)

Design doc for the per-cell payout multipliers in `pricing.ts`. Read alongside
the backend model specs in `boltbet_backend/docs/grid-models/` (EAGZ-1.md) — this
model deliberately reuses EAGZ's per-cell EWMA counting and equirectangular cell
mapping, but runs client-side in real time and adds an odds/pricing layer EAGZ
never had.

## 0. Purpose

Give every grid cell a **live payout multiplier** that is approximately the
**inverse of its probability of being struck at least once in the upcoming lock
window `T`**. The player distributes a budget across cells; each cell resolves
independently against its (frozen) multiplier.

Hot cell (lots of recent strikes) → low multiplier (~1.1–1.5×).
Cold cell → high multiplier (up to the clamp, ~10×).

## 1. Why this is the whole point (preserving the edge)

Over a short window `T` the *next individual strike* is near-random, and everyone
sees the same heatmap — so **picking the currently-hottest cell has no edge**. But
a storm cell **drifts coherently**: its position a few seconds out is readable
from the wind/cloud layers and from the observed motion of the cell, even though
each strike is noisy.

So the skill is **spatial-temporal, not per-strike**: bet the cold cell the storm
is *moving into*, before it lights up.

For that edge to exist, the price must **lag** the storm — it must reflect where
strikes have *recently been*, not where they're *going*. Therefore:

> **The model prices off current/recent density ONLY. It contains no drift,
> velocity, or movement-prediction term. This is intentional.** If we made the
> model extrapolate storm motion, the cold-but-incoming cell would already be
> priced high, the player's information advantage would vanish, and the game
> would collapse back into RNG + "click the hottest cell".

The house edge (below) makes the *fair/crowd* price mildly -EV, so a player who
only chases the obvious hot cell slowly loses, while a player who reads movement
and buys underpriced cold cells is +EV. That asymmetry is the game.

## 2. Model (per cell, each pricing tick)

Let `T` = lock window (`windowMs`), `τ` = `halfLifeMs / ln2`.

1. **Temporally-weighted recent count.** For each strike in the cell within the
   observation window, weight `w = exp(-Δt / τ)` (Δt = age). Sum per cell →
   `weight_c`. (EWMA; identical decay idea to EAGZ §5.3.)
2. **Light symmetric spatial smoothing.** Convolve the per-cell weights with a
   normalised 3×3 kernel (`center`, `ortho`, `diag`). A strike near a cell edge
   informs neighbours. Symmetric ⇒ never anticipates direction of travel. Kept
   light so the storm's leading (cold) edge stays cold — see §1.
3. **Rate → expected count over T.** For a Poisson process, `E[Σ exp(-Δt/τ)] =
   rate·τ`, so `rate_c = weight_c / τ` and `λ_c = rate_c · T = weight_c · (T/τ)`.
4. **Probability of ≥1 strike (Poisson):** `p_c = 1 − exp(−λ_c)`.
5. **Fair inverse multiplier:** `1 / p_c`.
6. **House edge / overround:** `multiplier_c = (1 / p_c) · (1 − edge)`, clamped to
   `[multMin, multMax]`.

Because each cell is an independent binary market and every price is shrunk by
`(1 − edge)`, the implied probabilities `Σ (1−edge)/mult_c` sum to **more than 1**
(a bookmaker overround): betting the model's own prices is -EV, guaranteeing the
game is beatable only by pricing better than the model.

## 2b. Count-based payout (current game) — price off λ, not p

The shipped game is **continuous, per-cell, count-based**: you stake `credits` on a
cell; over the counting window `T` every strike that lands in it pays
`multiplier × credits`, so the round total is `strikes × multiplier × credits`.

Because payout scales with the **number** of strikes, the fair price is the inverse
of the **expected count** `λ`, i.e. `multiplier = (1/λ)·(1−edge)`, **not** `1/p`.

Why this matters: `p = 1−e^(−λ) ≤ λ`, so `1/p ≥ 1/λ`, and the gap grows with λ.
If we paid per strike at `1/p` odds, a hot cell (large λ) would return
`E[count]·(1/p) = λ/p ≫ 1` per credit — massively +EV — which would make chasing the
hottest cell optimal and destroy the cold-cell edge. Pricing off `1/λ` makes the
expected return per credit `λ·(1/λ)·(1−edge) = (1−edge)` on **every** cell (flat, with
the house edge), so the only way to be +EV is to bet a cell whose *true* λ exceeds the
priced λ — a cold cell the storm is drifting into. Skill = movement-reading, preserved.
`§4 windowMs` therefore equals the game's bet window (6 s).

## 3. Payout resolution — earlier **binary** option (superseded)

> Superseded by §2b's count-based payout at the product's request. Kept for context.

A staked cell resolves **binary**: if it is struck **at least once** during the
lock window `T`, it pays `stake × multiplier`; otherwise the stake is lost.

- **Why binary:** it's exactly the event the multiplier prices (`p = P(≥1
  strike)`), giving a clean prediction-market feel ("will lightning hit here in
  the next few seconds — yes/no") and making EV trivial to reason about:
  `EV = p · (stake·mult) − stake = stake·(p·mult − 1)`, which is negative at the
  fair+edge price and positive only where the true `p` exceeds the model's.
- **Strike-count alternative (not chosen):** pay `stake × mult × strikeCount`.
  Rejected because (a) the multiplier is derived from `P(≥1)`, not from `E[count]`,
  so count-scaling double-counts intensity and mis-prices; (b) it rewards raw hot
  cells (many strikes) again, undercutting the cold-cell edge; (c) variance
  explodes and the "market" reading is muddier. If we ever want it, price off
  `λ` (expected count) instead of `p` and document as IDP-2.

## 4. Parameters (IDP-1 baseline — all in `PRICING_CONFIG`)

| Param | Meaning | Baseline | Notes |
|---|---|---|---|
| `windowMs` `T` | Lock/resolution window | 4000 | Keep == game `LOCK_MS`. |
| `observationMs` | Lookback for the rate estimate | 90000 | Perf cap; old strikes ~0 weight anyway. |
| `halfLifeMs` | EWMA half-life | 45000 | 30–60s. Shorter = faster price reaction, noisier. Faster than EAGZ's 180s because we price a live round, not zone shape. |
| `edge` | House overround | 0.12 | 0.10–0.15 typical. Higher = harder to beat. |
| `multMin` / `multMax` | Multiplier clamp | 1.05 / 10 | Cold cells cap at `multMax`. |
| `centerWeight` / `orthoWeight` / `diagWeight` | 3×3 smoothing kernel | 1.0 / 0.25 / 0.08 | Raise to smooth more (erodes edge); lower toward 0 for pure per-cell (noisier, stronger edge). |

## 5. Calibration guidance

The target (per the brief): **skill should beat RNG over a one-minute match.**
Knobs, in rough order of leverage:

1. **`edge`** — the difficulty dial. Higher edge ⇒ density-chasing loses faster ⇒
   bigger reward for reading movement, but too high frustrates everyone.
2. **`halfLifeMs`** — how much the price lags the storm. This *is* the size of the
   edge window: longer half-life ⇒ price lags more ⇒ bigger movement edge (and
   staler hot cells). Shorter ⇒ price tracks the storm ⇒ smaller edge.
3. **Smoothing weights** — more smoothing shrinks the cold-edge opportunity.
4. **`multMax`** — caps the upside on the coldest cells (bankroll swing control).

A good validation loop (mirrors EAGZ-1.md §9): simulate a match where one bot
chases density (see `bot.ts`) and one "oracle" bets cells the storm is about to
enter; tune until the oracle's expected match score clears the density-chaser by
a comfortable but not absurd margin.

## 6. Explicitly out of scope (structured for later)

- **Live in-window re-weighting** (moving the stake during `T`). `priceCells()` is
  a pure snapshot function, so a future phase can re-price and re-allocate mid-
  window without touching this model.
- **Movement-aware pricing.** Deliberately excluded (§1). If ever added, it must
  be a *separate* published price (e.g. an "assisted" mode) so the skill mode's
  edge is preserved, and versioned IDP-2.
