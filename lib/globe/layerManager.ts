// lib/globe/layerManager.ts
// Applies the toggleable globe layers (lib/globe/layers.ts) to the Cesium
// scene, driven by liveStore.activeLayers.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import { ALL_LAYER_IDS, type GlobeLayerId } from './layers';
import { makeRecentStrikesEffect } from './recentStrikesLayer';

interface LayerEffect {
  enable: () => void;
  disable: () => void;
}

export function attachLayers(viewer: Cesium.Viewer, scene: Cesium.Scene): () => void {
  // ── storm-fog (frontend-only) ─────────────────────────────────────────────
  const baseFogDensity = scene.fog.density;
  const stormFog: LayerEffect = {
    enable: () => {
      scene.fog.enabled = true;
      scene.fog.density = 0.0006;
    },
    disable: () => {
      scene.fog.density = baseFogDensity;
    },
  };

  // ── day-night terminator (frontend-only) ──────────────────────────────────
  const dayNight: LayerEffect = {
    enable: () => {
      scene.globe.enableLighting = true;
      scene.globe.dynamicAtmosphereLighting = true;
      scene.globe.dynamicAtmosphereLightingFromSun = true;
    },
    disable: () => {
      scene.globe.enableLighting = false;
      scene.globe.dynamicAtmosphereLighting = false;
      scene.globe.dynamicAtmosphereLightingFromSun = false;
    },
  };

  // ── backend-driven layers still stubbed ───────────────────────────────────
  const stub = (id: GlobeLayerId): LayerEffect => {
    let primitives: Cesium.PrimitiveCollection | null = null;
    return {
      enable: () => {
        if (primitives) return;
        primitives = scene.primitives.add(new Cesium.PrimitiveCollection());
        //   density-grid   → /api/strikes/by-country/ or zone counts
        //   storm-cells    → /api/stormcells
        //   pulse-type     → /api/lightning (CG/IC)
        //   alert-zones    → /api/alerts
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[layer] "${id}" enabled — backend wiring TODO`);
        }
      },
      disable: () => {
        if (primitives && !scene.isDestroyed()) scene.primitives.remove(primitives);
        primitives = null;
      },
    };
  };

  const effects: Record<GlobeLayerId, LayerEffect> = {
    'recent-strikes': makeRecentStrikesEffect(scene), // real (/api/strikes/recent/), last 30 min
    'storm-fog': stormFog,
    'strike-pulse': stub('strike-pulse'),
    'day-night': dayNight,
    'density-grid': stub('density-grid'),
    'storm-cells': stub('storm-cells'),
    'pulse-type': stub('pulse-type'),
    'alert-zones': stub('alert-zones'),
  };

  let prev: Record<GlobeLayerId, boolean> = Object.fromEntries(
    ALL_LAYER_IDS.map((id) => [id, false]),
  ) as Record<GlobeLayerId, boolean>;

  const apply = (next: Record<GlobeLayerId, boolean>) => {
    if (viewer.isDestroyed()) return;
    for (const id of ALL_LAYER_IDS) {
      if (next[id] === prev[id]) continue;
      if (next[id]) effects[id].enable();
      else effects[id].disable();
    }
    prev = next;
  };

  apply(useLiveStore.getState().activeLayers);
  const unsub = useLiveStore.subscribe((s) => apply(s.activeLayers));

  return () => {
    unsub();
    if (scene.isDestroyed()) return;
    for (const id of ALL_LAYER_IDS) if (prev[id]) effects[id].disable();
  };
}