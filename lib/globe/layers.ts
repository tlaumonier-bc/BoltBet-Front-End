// lib/globe/layers.ts
// Beginner = Strikes · 1 h + Clouds + Rain.
// Pro adds Strikes · 6 h + Strikes · 24 h + Temperature + Wind.
// Array order = display order in the panel.

export type GlobeLayerId =
  | 'recent-strikes-1h'
  | 'storm-fog'
  | 'precipitation'
  | 'recent-strikes-6h'
  | 'recent-strikes-24h'
  | 'temperature'
  | 'wind';

export type LayerTier = 'beginner' | 'pro';

export interface GlobeLayerDef {
  id: GlobeLayerId;
  label: string;
  description: string;
  tier: LayerTier;
  icon: string;
}

export const GLOBE_LAYERS: GlobeLayerDef[] = [
  { id: 'recent-strikes-1h', label: 'Strikes · 1 h', description: 'Strikes from the last hour.', tier: 'beginner', icon: '⚡' },
  { id: 'recent-strikes-6h', label: 'Strikes · 6 h', description: 'Strikes 1 to 6 hours old.', tier: 'pro', icon: '⚡' },
  { id: 'recent-strikes-24h', label: 'Strikes · 24 h', description: 'Strikes 6 to 24 hours old.', tier: 'pro', icon: '⚡' },
  { id: 'storm-fog', label: 'Clouds', description: 'Live cloud cover across the globe.', tier: 'beginner', icon: '☁️' },
  { id: 'precipitation', label: 'Rain', description: 'Live rain, minute by minute.', tier: 'beginner', icon: '🌧️' },
  { id: 'temperature', label: 'Temperature', description: "The planet's heat, blue to red.", tier: 'pro', icon: '🌡️' },
  { id: 'wind', label: 'Wind', description: 'The air in motion, worldwide.', tier: 'pro', icon: '💨' },
];

export const beginnerLayers = GLOBE_LAYERS.filter((l) => l.tier === 'beginner');
export const proLayers = GLOBE_LAYERS;
export const layersForTier = (pro: boolean): GlobeLayerDef[] => (pro ? proLayers : beginnerLayers);
export const ALL_LAYER_IDS = GLOBE_LAYERS.map((l) => l.id);

export function defaultLayerState(): Record<GlobeLayerId, boolean> {
  return {
    'recent-strikes-1h': false,
    'storm-fog': false,
    'precipitation': false,
    'recent-strikes-6h': false,
    'recent-strikes-24h': false,
    'temperature': false,
    'wind': false,
  };
}