// lib/globe/scene.ts
// Dark "storm" look & feel: background, sky/ground atmosphere, bloom, and the
// anti-aliasing setup (MSAA on, FXAA off) that keeps borders and labels crisp.

import * as Cesium from 'cesium';
import { ATMOSPHERE, GROUND_ATMOSPHERE_BRIGHTNESS, STORM_BG } from './config';

export function configureScene(scene: Cesium.Scene): void {
  scene.backgroundColor = STORM_BG;
  if (scene.skyBox) scene.skyBox.show = false;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;

  // Built-in sky atmosphere — colour/brightness only (its radius is fixed in
  // Cesium). The taller halo comes from attachAtmosphereGlow. Set show=false
  // here if you want to tune a single atmosphere source.
  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = ATMOSPHERE.show;
    scene.skyAtmosphere.atmosphereLightIntensity = ATMOSPHERE.lightIntensity;
    scene.skyAtmosphere.brightnessShift = ATMOSPHERE.brightnessShift;
    scene.skyAtmosphere.saturationShift = ATMOSPHERE.saturationShift;
    scene.skyAtmosphere.hueShift = ATMOSPHERE.hueShift;
    scene.skyAtmosphere.perFragmentAtmosphere = true;
    scene.skyAtmosphere.atmosphereRayleighScaleHeight = ATMOSPHERE.rayleighScaleHeight;
    scene.skyAtmosphere.atmosphereMieScaleHeight = ATMOSPHERE.mieScaleHeight;
  }

  // Ground atmosphere: STATIC lighting (camera-relative) so the rim glows evenly.
  scene.globe.showGroundAtmosphere = true;
  scene.globe.dynamicAtmosphereLighting = false;
  scene.globe.dynamicAtmosphereLightingFromSun = false;
  scene.globe.atmosphereBrightnessShift = GROUND_ATMOSPHERE_BRIGHTNESS;
  scene.globe.enableLighting = false; // city lights shown uniformly, no terminator
  scene.globe.baseColor = STORM_BG;
  scene.fog.enabled = true;

  // ── Anti-aliasing: crisp borders + labels ─────────────────────────────────
  // FXAA is a blur-based AA that softens thin lines and text — the cause of the
  // blurry borders/labels. Turn it off and use hardware MSAA instead, which
  // anti-aliases edges without smearing.
  scene.postProcessStages.fxaa.enabled = false;
  scene.msaaSamples = 4; // 2 / 4 / 8 — higher = smoother, slightly costlier

  // Bloom: makes lightning strikes glow. It also adds a soft halo to any bright
  // pixel, so if labels still look slightly fuzzy, lower contrast/brightness or
  // disable it here.
  if (scene.postProcessStages?.bloom) {
    const bloom = scene.postProcessStages.bloom;
    bloom.enabled = true;
    bloom.uniforms.glowOnly = false;
    bloom.uniforms.contrast = 120;
    bloom.uniforms.brightness = -0.2;
    bloom.uniforms.delta = 1.2;
    bloom.uniforms.sigma = 2.5;
    bloom.uniforms.stepSize = 1.0;
  }
  scene.highDynamicRange = false; // HDR over-brightened the night side / atmosphere
}