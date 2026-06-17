// lib/globe/quality.ts
// Graphics-quality presets for the Cesium globe. EDIT THE NUMBERS HERE to tune
// each tier — they're applied live by components/Globe/LightningGlobe.tsx.
//
//   resolutionScaleCap — max device-pixel multiplier, capped against the
//                        display DPR. On a retina screen 1.5 renders ~2.25× the
//                        CSS pixels (full retina ≈ 4×). Lower = far cheaper
//                        fragment shading, slightly softer.
//   targetFrameRate    — render-loop cap (fps). Lower = much less GPU / heat.
//   msaaSamples        — hardware anti-aliasing for crisp borders/labels.
//                        1 = off, 2 = current, 4 = very smooth (costly).
//   fog                — distance fog near the limb (cheap, minor visual).
//   atmosphere         — the blue atmosphere glow shell (one translucent pass).

export type GlobeQuality = 'low' | 'medium' | 'high';

export interface QualityPreset {
  resolutionScaleCap: number;
  targetFrameRate: number;
  msaaSamples: number;
  fog: boolean;
  atmosphere: boolean;
}

export const QUALITY_PRESETS: Record<GlobeQuality, QualityPreset> = {
  low: {
    resolutionScaleCap: 1.0,
    targetFrameRate: 24,
    msaaSamples: 1, // off
    fog: false,
    atmosphere: true, // kept for the look; set false to save one more draw call
  },
  // ── CURRENT values — this is the look you have today. ──
  medium: {
    resolutionScaleCap: 1.5,
    targetFrameRate: 30,
    msaaSamples: 1,
    fog: true,
    atmosphere: true,
  },
  high: {
    resolutionScaleCap: 2.0,
    targetFrameRate: 60,
    msaaSamples: 4,
    fog: true,
    atmosphere: true,
  },
};

export const DEFAULT_QUALITY: GlobeQuality = 'medium';