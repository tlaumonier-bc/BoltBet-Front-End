// lib/globe/layers.ts
// The catalog of toggleable globe layers (pure data — no Cesium here).
// `tier` decides where a layer shows up: beginner layers appear in both
// Beginner and Pro mode; pro layers appear only in Pro mode. The actual
// rendering lives in lib/globe/layerManager.ts, the on/off state in liveStore.
//
// Beginner = 4 layers, Pro = all 8 (the 4 beginner ones + 4 advanced).

export type GlobeLayerId =
  // ── beginner ──
  | 'recent-strikes'
  | 'storm-fog'
  | 'strike-pulse'
  | 'day-night'
  // ── pro ──
  | 'density-grid'
  | 'storm-cells'
  | 'pulse-type'
  | 'alert-zones';

export type LayerTier = 'beginner' | 'pro';

export interface GlobeLayerDef {
  id: GlobeLayerId;
  label: string;
  /** Short one-liner shown under the label in the panel. */
  description: string;
  tier: LayerTier;
  /** Small glyph shown on the toggle. */
  icon: string;
  /** True if the layer needs data/endpoints from the backend to render. */
  needsBackend: boolean;
}

export const GLOBE_LAYERS: GlobeLayerDef[] = [
  // ───────────────────────── BEGINNER ─────────────────────────
  {
    id: 'recent-strikes',
    label: 'Recent strikes',
    description: 'Heat-map of strikes from the last few minutes.',
    tier: 'beginner',
    icon: '⚡',
    needsBackend: true, // pulls historical strikes from the backend
  },
  {
    id: 'storm-fog',
    label: 'Storm fog',
    description: 'Drifting haze that thickens near active storms.',
    tier: 'beginner',
    icon: '🌫️',
    needsBackend: false, // pure scene effect
  },
  {
    id: 'strike-pulse',
    label: 'Pulse rings',
    description: 'Shock-rings ripple out from each new strike.',
    tier: 'beginner',
    icon: '💥',
    needsBackend: false, // reacts to the live feed already in the store
  },
  {
    id: 'day-night',
    label: 'Day / Night line',
    description: 'Show the live sunlight terminator. (Best with Day map.)',
    tier: 'beginner',
    icon: '🌓',
    needsBackend: false, // computed from the sun position
  },

  // ─────────────────────────── PRO ────────────────────────────
  {
    id: 'density-grid',
    label: 'Density grid',
    description: 'Colour each zone by its 24-hour strike count.',
    tier: 'pro',
    icon: '▦',
    needsBackend: true,
  },
  {
    id: 'storm-cells',
    label: 'Storm cell tracks',
    description: 'Movement arrows with speed and hail risk.',
    tier: 'pro',
    icon: '🎯',
    needsBackend: true,
  },
  {
    id: 'pulse-type',
    label: 'CG / IC split',
    description: 'Tint strikes cloud-to-ground vs intra-cloud.',
    tier: 'pro',
    icon: '⨁',
    needsBackend: true,
  },
  {
    id: 'alert-zones',
    label: 'Alert zones',
    description: 'Shaded severe-weather warnings and watches.',
    tier: 'pro',
    icon: '⚠️',
    needsBackend: true,
  },
];

/** Layers visible in Beginner mode. */
export const beginnerLayers = GLOBE_LAYERS.filter((l) => l.tier === 'beginner');

/** All layers (Pro mode). */
export const proLayers = GLOBE_LAYERS;

/** Layers to show for the current mode. */
export const layersForTier = (pro: boolean): GlobeLayerDef[] =>
  pro ? proLayers : beginnerLayers;

/** All layer ids — handy for building default state / diffing. */
export const ALL_LAYER_IDS = GLOBE_LAYERS.map((l) => l.id);

/**
 * Initial on/off state. Everything off by default so the globe looks exactly
 * as it does today until the user opts in. Flip a value to true here to ship a
 * layer enabled by default (e.g. 'recent-strikes' once the backend is wired).
 */
export function defaultLayerState(): Record<GlobeLayerId, boolean> {
  return {
    'recent-strikes': false,
    'storm-fog': false,
    'strike-pulse': false,
    'day-night': false,
    'density-grid': false,
    'storm-cells': false,
    'pulse-type': false,
    'alert-zones': false,
  };
}
