// lib/globe/config.ts
// Tunable constants + one-time Cesium runtime setup. Tweak visuals here.

import * as Cesium from 'cesium';

// Tell Cesium where its static assets live (copied to /public/cesium).
if (typeof window !== 'undefined') {
  (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium';
}
// Optional: Cesium Ion satellite imagery instead of CARTO.
const ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
if (ION_TOKEN) Cesium.Ion.defaultAccessToken = ION_TOKEN;

export const FLY_HEIGHT_M = 2_500_000;

// SEO/country framing zoom. 1 = frame the country box exactly; higher = wider.
export const SEO_ZOOM_PADDING = 1.8;

export const STORM_BG = Cesium.Color.fromCssColorString('#04060d');
export const GRID_GRAY = Cesium.Color.fromCssColorString('#94a3b8');
export const LOCK_COLOR = Cesium.Color.fromCssColorString('#38bdf8'); // game lock highlight

// ── Country borders + labels (crisp vector data) ──────────────────────────
export const COUNTRY_BORDER_COLOR = Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.55);
export const COUNTRY_BORDER_WIDTH = 1.2;
export const COUNTRY_LABEL_COLOR = Cesium.Color.fromCssColorString('#cbd5e1').withAlpha(0.9);
export const COUNTRY_LABEL_FONT = '600 14px sans-serif';

// ── Camera zoom range ──────────────────────────────────────────────────────
export const MIN_ZOOM_DISTANCE_M = 50_000; // ~50 km
export const MAX_ZOOM_DISTANCE_M = 1_000_000;

// ── scene.skyAtmosphere — colour/brightness ONLY. These do NOT change the
//    halo's apparent height (its radius is fixed inside Cesium). Use
//    ATMOSPHERE_GLOW below for height. ───────────────────────────────────────
export const ATMOSPHERE = {
  show: true,            // set false to keep only the custom glow below
  lightIntensity: 10,
  brightnessShift: 0.0,
  saturationShift: 0.0,
  hueShift: 0.0,
  rayleighScaleHeight: 18_000, // colour falloff, not height
  mieScaleHeight: 6_000,
};
export const GROUND_ATMOSPHERE_BRIGHTNESS = -0.1;

// ── Custom glow shell — THIS controls the visible atmosphere height ──────────
export const ATMOSPHERE_GLOW = {
  heightM: 1_000_000,
  color: '#3b82f6',
  strength: 0.35, // brightness — drop toward 0.15 for fainter
  falloff: 3.0,   // higher = thinner rim hugging the limb
};