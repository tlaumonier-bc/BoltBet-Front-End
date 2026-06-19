// lib/game/multiplier.ts
// The zone-bet multiplier model. Mirror this EXACTLY on the backend (same
// ZONE_SIZE_DEG, same constants) so server multipliers match what users saw.
import { allZones, zoneSolidAngleHelper, type ZoneBox } from '@/lib/zones';

export const DURATIONS = [1, 10, 60, 1440] as const;
export type Duration = (typeof DURATIONS)[number];

export function durationLabel(min: number): string {
  if (min >= 1440) return '24h';
  if (min >= 60) return '1h';
  if (min >= 10) return '10min';
  return '1min';
}

// Longer windows pay more — so players aren't pushed toward spamming 1-min bets.
const DURATION_BOOST: Record<number, number> = { 1: 1.0, 10: 1.35, 60: 1.85, 1440: 2.6 };
export function durationBoost(min: number): number {
  return DURATION_BOOST[min] ?? 1.0;
}

const DEG2RAD = Math.PI / 180;

// Solid angle (steradians) of a box = Δlon(rad) · (sin latMax − sin latMin).
// Polar boxes are far smaller than equatorial ones despite equal degree spans.
export function zoneSolidAngle(z: ZoneBox): number {
  const dLon = (z.lonMax - z.lonMin) * DEG2RAD;
  return dLon * (Math.sin(z.latMax * DEG2RAD) - Math.sin(z.latMin * DEG2RAD));
}

// Precompute areas once.
const ZONES = allZones();
const AREA: Record<string, number> = {};
let areaSum = 0;
for (const z of ZONES) {
  const a = zoneSolidAngle(z);
  AREA[z.id] = a;
  areaSum += a;
}
const MEAN_AREA = areaSum / ZONES.length;

// ── model constants (tune here) ──────────────────────────────────────────
const AREA_PRIOR = 0.6; // weight of the area prior when strikes are sparse
const EDGE = 0.85;      // house edge: <1 = slightly sub-fair payouts
const GAMMA = 0.5;      // compresses 1/p into a sane multiplier range
const MIN_MULT = 1.2;
const MAX_MULT = 50;

export interface ZoneMultipliers {
  recentStrikes: number;
  byDuration: Record<number, number>;
}

/** activity: { zoneId -> strike count over the lookback window }. */
export function computeMultipliers(
  activity: Record<string, number>,
): Record<string, ZoneMultipliers> {
  const w: Record<string, number> = {};
  let wSum = 0;
  for (const z of ZONES) {
    const c = activity[z.id] ?? 0;
    const wi = c + AREA_PRIOR * (AREA[z.id] / MEAN_AREA); // strike share + area prior
    w[z.id] = wi;
    wSum += wi;
  }

  const out: Record<string, ZoneMultipliers> = {};
  for (const z of ZONES) {
    const p = w[z.id] / wSum;                 // estimated win probability
    const base = EDGE / Math.pow(p, GAMMA);
    const byDuration: Record<number, number> = {};
    for (const d of DURATIONS) byDuration[d] = clampRound(base * durationBoost(d));
    out[z.id] = { recentStrikes: activity[z.id] ?? 0, byDuration };
  }
  return out;
}

function clampRound(m: number): number {
  return Math.round(Math.max(MIN_MULT, Math.min(MAX_MULT, m)) * 10) / 10;
}

/** Inverse of the model — used only by the offline mock to resolve bets. */
export function impliedWinProb(multiplier: number, durationMinutes: number): number {
  const p = Math.pow((EDGE * durationBoost(durationMinutes)) / multiplier, 1 / GAMMA);
  return Math.max(0, Math.min(0.95, p));
}

/** Grid label colour: red = favourite (low mult) → violet = long shot. */
export function multiplierColor(m: number): string {
  if (m < 2) return '#f87171';
  if (m < 4) return '#fbbf24';
  if (m < 10) return '#a3e635';
  if (m < 20) return '#38bdf8';
  return '#c084fc';
}

// kept only so a stray import never breaks the build; harmless no-op alias.
export const _area = zoneSolidAngleHelper;