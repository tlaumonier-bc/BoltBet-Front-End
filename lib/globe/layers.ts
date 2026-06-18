// lib/globe/layers.ts
// The catalog of toggleable globe layers (pure data — no Cesium here).
// Beginner = Recent strikes + Storm fog. Pro adds Density grid + Alert zones.

export type GlobeLayerId =
  // ── beginner ──
  | 'recent-strikes'
  | 'storm-fog'
  // ── pro ──
  | 'density-grid'
  | 'alert-zones';

export type LayerTier = 'beginner' | 'pro';

export interface GlobeLayerDef {
  id: GlobeLayerId;
  label: string;
  description: string;
  tier: LayerTier;
  icon: string;
  needsBackend: boolean;
}

export const GLOBE_LAYERS: GlobeLayerDef[] = [
  // ───────────────────────── BEGINNER ─────────────────────────
  {
    id: 'recent-strikes',
    label: 'Recent strikes',
    description: 'Heat-map of strikes from the last 30 minutes.',
    tier: 'beginner',
    icon: '⚡',
    needsBackend: true,
  },
  {
    id: 'storm-fog',
    label: 'Storm fog',
    description: 'Drifting haze that thickens near active storms.',
    tier: 'beginner',
    icon: '🌫️',
    needsBackend: false,
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

/** Initial on/off state — everything off so the globe looks unchanged until opt-in. */
export function defaultLayerState(): Record<GlobeLayerId, boolean> {
  return {
    'recent-strikes': false,
    'storm-fog': false,
    'density-grid': false,
    'alert-zones': false,
  };
}