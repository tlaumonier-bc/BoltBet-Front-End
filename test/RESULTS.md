# Grid Game — active-zone search backtest

**Data:** `test/data/strikes-30m.json` — 17,786 real global strikes over 30 min
(~593/min). Replay searches every 3 s (600 ticks) and, per tick, runs a global
zone detector over the recency-weighted strikes visible so far.

**Metrics**
- `avgZones` — mean playable zones found worldwide per tick (target ≈ 5).
- `%>=1/3/5` — share of ticks with at least N zones.
- `hNorm` — normalized Shannon entropy of strikes across a zone's cells over the
  60 s round window (1 = perfectly spread, 0 = one cell). Higher = better game.
- `topShare` — fraction of a zone's round strikes in its single hottest cell
  (lower = better; high means "just click the hot cell").

## The problem with the old search
The shipped game searched **per selected country** with a fixed 10×8 grid and
strict floors, so it surfaced ~1 zone and often 0. A global detector already does
much better; the work was getting to ~5 zones *without* wrecking dispersion.

## Key finding
Two knobs trade off against each other:
- **Looser activity floors** raise the count but *lower* entropy (admit sloppy,
  one-cell-dominated zones). Bad.
- **Focus-on-peak + fine bins** keep zones tight and well-dispersed (hNorm ~0.67)
  but under-count (~2.7) because each storm system collapses to one zone.

The winning approach is **greedy top-density-peaks**: repeatedly take the hottest
coarse bin, carve a tight zone around it, suppress bins within `separationKm`, and
repeat. Distinct storm cells each become their own tight, well-dispersed zone, and
`separationKm` tiles larger systems into several playable zones — lifting the count
to ~5 while keeping hNorm ≈ 0.63.

## Balanced seed-anchored model (current) → `lib/grid-game/zones.ts`

Each zone's radius **grows until it gathers ~`targetRoundStrikes` (90)** strikes in
the last minute (capped at `maxFocusKm` 300) — so a zone stays strike-rich whether
storms are busy or quiet — and the zone is **framed on its seed peak, not the
gathered centroid**. That is the key change: with centroid-framing, every seed over
one big storm re-centred onto the storm's centre of mass and collapsed to a single
zone (count stuck at ~3.5 no matter the dedupe distance). Seed-anchoring keeps each
seed at its own location, so a large system **tiles into several distinct,
partially-overlapping zones** (shared edges, distinct centres ≥`minSepKm` 60 km
apart → no exact duplicates).

On the 30-min backtest (~593/min): **avg 5.1 zones (median 5, ≥5 on 56% of ticks),
median ~74 strikes/zone, hNorm ~0.58**. This is the **"Balanced"** product choice.
The hard limit, proven by the sweeps: Earth typically has only **~3–5 distinct dense
storm complexes** at once, so "≥5 *distinct* zones each ≥100/min" (5×100 = 500/min
concentrated in five places) is physically impossible on this data — the top few
290 km regions hold only ~45% of global strikes. Reaching the ~5-zone count the game
wants therefore means admitting mid-tier peaks + mild overlap, which caps per-zone
strikes at ~74 (still 2.5× the old ~30/zone model). Sweep evidence (seed-anchored):

| config | avgZ | medZ | %≥5 | med strk | hNorm |
|---|---|---|---|---|---|
| strikes-first (t120, distinct) | 3.5 | 3 | 22% | 111 | 0.61 |
| C (t100, mcw .4, cd .2) | 4.1 | 4 | 35% | 87 | 0.59 |
| **FINAL (t90, mcw .3, cd .2, sep60)** | **5.1** | **5** | **56%** | **74** | **0.58** |
| F (t85, mcw .25) | 5.4 | 5 | 62% | 71 | 0.58 |

## Earlier: bigger, denser zones (fixed radius)

Retuned per the "≥100 strikes/zone/min, still ≥5 zones, still distributed" goal.
Big focus radius (gather many strikes) + small separation (tile dense storms into
several strike-rich zones).

| metric | value (30-min backtest) |
|---|---|
| avg zones / tick | **5.28** (median 5, ≥5 on 66% of ticks) |
| strikes / zone / min | **avg 155, median 169** — 71% of zones ≥100 |
| hNorm (dispersion) | 0.57 (hottest cell ≈ 25%) |
| avg zone width | ~178 km |

Params: `mode=peaks, coarseDeg=0.3, obsMs=420k, tauMs=150k, roundMs=60k,
minCellWeight=0.7, focusRadiusKm=160, separationKm=46, minSigmaKm=10,
minRoundStrikes=18, targetPerCell=2.0, sigmaK=1.8, entropyThreshold=0.5,
dims 5×4 … 12×10, maxZones=12`.

**Fundamental tradeoff (documented):** with only ~590 strikes/min globally, ≥5
zones EACH ≥100/min is not always simultaneously possible — forcing every zone
≥100 collapses to ~3–4 zones (there aren't 5 storms that dense). This config
targets **avg ≥100 with ≥5 zones**, tiling dense storms via overlap; when global
activity is higher it naturally yields more distinct dense zones, and when it's
diffuse (a quiet hour) zones are smaller. Earlier small-zone model on the same
data: ~51 strikes/zone → this: ~155 (3× denser).

Reproduce: `node test/backtest.mjs` (all configs) or `node test/backtest.mjs FINAL`.
Refresh data: `curl '<backend>/api/strikes/recent/?minutes=30&limit=200000' -o test/data/strikes-30m.json`.
