// lib/globe/layerManager.ts
// Applies the toggleable globe layers (lib/globe/layers.ts) to the Cesium
// scene, driven by liveStore.activeLayers. Each layer is an { enable, disable }
// pair; the manager diffs the store on every change and calls the right side.
//
// Two layers are FRONTEND-ONLY and implemented for real here (storm-fog,
// day-night) so the toggle pipeline is demonstrably wired end-to-end. The rest
// need backend data (historical strikes, density, storm cells, pulse polarity,
// alerts) — they're stubbed with clear hooks: drop your Cesium primitives into
// the matching enable()/disable() once the endpoints exist. The toggle UI,
// state and lifecycle are already done, so wiring a layer later is local.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import { ALL_LAYER_IDS, type GlobeLayerId } from './layers';

interface LayerEffect {
  enable: () => void;
  disable: () => void;
}

export function attachLayers(viewer: Cesium.Viewer, scene: Cesium.Scene): () => void {
  // ── storm-fog (frontend-only) ─────────────────────────────────────────────
  // Thickens Cesium's distance fog for a hazy, stormy limb. We remember the
  // base density so disabling restores whatever the quality preset set.
  const baseFogDensity = scene.fog.density;
  const stormFog: LayerEffect = {
    enable: () => {
      scene.fog.enabled = true;
      scene.fog.density = 0.0006; // ~3–4× the default; visible haze near the limb
    },
    disable: () => {
      scene.fog.density = baseFogDensity;
    },
  };

  // ── day-night terminator (frontend-only) ──────────────────────────────────
  // Turns on sun lighting so the globe gets a real day/night terminator from
  // the current sun position. Pairs best with the Day (Blue Marble) map style.
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

  // ── backend-driven layers (stubs) ─────────────────────────────────────────
  // Replace the bodies below with real primitives once the data is available.
  // Each gets its own scratch container so cleanup is a single remove().
  const stub = (id: GlobeLayerId): LayerEffect => {
    let primitives: Cesium.PrimitiveCollection | null = null;
    return {
      enable: () => {
        if (primitives) return;
        primitives = scene.primitives.add(new Cesium.PrimitiveCollection());
        // TODO(backend): fetch data for `id` and add primitives to `primitives`.
        //   recent-strikes → /api/strikes/recent?minutes=X  (heat / point glow)
        //   density-grid   → /api/strikes/zone-counts        (zone choropleth)
        //   storm-cells    → /api/stormcells                 (movement arrows)
        //   pulse-type     → /api/lightning (CG/IC)           (tint strikes)
        //   alert-zones    → /api/alerts                      (shaded polygons)
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
    'recent-strikes': stub('recent-strikes'),
    'storm-fog': stormFog,
    'strike-pulse': stub('strike-pulse'), // frontend-only later: ripple on each new store strike
    'day-night': dayNight,
    'density-grid': stub('density-grid'),
    'storm-cells': stub('storm-cells'),
    'pulse-type': stub('pulse-type'),
    'alert-zones': stub('alert-zones'),
  };

  // Diff the store and toggle whatever changed. Start from "all off" so the
  // initial apply enables any layer that's already active in the store.
  let prev: Record<GlobeLayerId, boolean> = Object.fromEntries(
    ALL_LAYER_IDS.map((id) => [id, false]),
  ) as Record<GlobeLayerId, boolean>;

  const apply = (next: Record<GlobeLayerId, boolean>) => {
    if (viewer.isDestroyed()) return;
    for (const id of ALL_LAYER_IDS) {
      if (next[id] !== prev[id]) (next[id] ? effects[id].enable() : effects[id].disable());
    }
    prev = next;
  };

  apply(useLiveStore.getState().activeLayers);
  const unsub = useLiveStore.subscribe((s) => apply(s.activeLayers));

  return () => {
    unsub();
    if (scene.isDestroyed()) return;
    // Restore the scene: disable anything still on.
    for (const id of ALL_LAYER_IDS) if (prev[id]) effects[id].disable();
  };
}
