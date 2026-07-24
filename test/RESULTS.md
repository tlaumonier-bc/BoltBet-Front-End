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

## Selected model — `FINAL` (peaks mode)  → `lib/grid-game/zones.ts`

| metric | value |
|---|---|
| avg zones / tick | **5.02** |
| median | 5 |
| ticks ≥1 / ≥3 / ≥5 | 100% / 95% / 55% |
| hNorm (dispersion) | 0.63 |
| topShare (hottest cell) | 0.23 |
| avg zone width | ~40 km |

Params: `mode=peaks, coarseDeg=0.3, obsMs=420k, tauMs=150k, roundMs=60k,
minCellWeight=0.7, focusRadiusKm=34, separationKm=42, minSigmaKm=10,
minRoundStrikes=4, targetPerCell=1.3, sigmaK=1.8, entropyThreshold=0.5,
dims 5×4 … 12×10, maxZones=12`.

Reproduce: `node test/backtest.mjs` (all configs) or `node test/backtest.mjs FINAL`.
Refresh data: `curl '<backend>/api/strikes/recent/?minutes=30&limit=200000' -o test/data/strikes-30m.json`.
