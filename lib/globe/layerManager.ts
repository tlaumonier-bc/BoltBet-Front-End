// lib/globe/layerManager.ts
import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import { ALL_LAYER_IDS, type GlobeLayerId } from './layers';
import { makeRecentStrikesEffect } from './recentStrikesLayer';
import { OWM_KEY, addOwmLayer } from './imagery';

interface LayerEffect {
  enable: () => void;
  disable: () => void;
}

export function attachLayers(viewer: Cesium.Viewer, scene: Cesium.Scene): () => void {
  // ── storm-fog → cloud cover (OWM), haze fallback ──
  const baseFogDensity = scene.fog.density;
  let cloudsLayer: Cesium.ImageryLayer | null = null;
  const stormFog: LayerEffect = {
    enable: () => {
      if (OWM_KEY) {
        if (!cloudsLayer) cloudsLayer = addOwmLayer(viewer, 'clouds_new', 0.6, 'clouds');
      } else {
        scene.fog.enabled = true;
        scene.fog.density = 0.0006;
      }
    },
    disable: () => {
      if (cloudsLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(cloudsLayer);
        cloudsLayer = null;
      }
      scene.fog.density = baseFogDensity;
    },
  };

  // ── precipitation → rain radar ──
  let rainLayer: Cesium.ImageryLayer | null = null;
  const precipitation: LayerEffect = {
    enable: () => {
      if (!OWM_KEY || rainLayer) return;
      rainLayer = addOwmLayer(viewer, 'precipitation_new', 1.0, 'precipitation');
      rainLayer.saturation = 2.2;
      rainLayer.contrast = 1.4;
      rainLayer.brightness = 1.1;
    },
    disable: () => {
      if (rainLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(rainLayer);
        rainLayer = null;
      }
    },
  };

  // ── temperature ──
  let tempLayer: Cesium.ImageryLayer | null = null;
  const temperature: LayerEffect = {
    enable: () => {
      if (!OWM_KEY || tempLayer) return;
      tempLayer = addOwmLayer(viewer, 'temp_new', 0.5, 'temperature');
    },
    disable: () => {
      if (tempLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(tempLayer);
        tempLayer = null;
      }
    },
  };

  // ── wind ──
  let windLayer: Cesium.ImageryLayer | null = null;
  const wind: LayerEffect = {
    enable: () => {
      if (!OWM_KEY || windLayer) return;
      windLayer = addOwmLayer(viewer, 'wind_new', 0.5, 'wind');
    },
    disable: () => {
      if (windLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(windLayer);
        windLayer = null;
      }
    },
  };

  const effects: Record<GlobeLayerId, LayerEffect> = {
    'recent-strikes-1h': makeRecentStrikesEffect(scene, {
      minutes: 60, olderThan: 0,
      color: Cesium.Color.fromCssColorString('#ef4444'),   // rouge
    }),
    'recent-strikes-6h': makeRecentStrikesEffect(scene, {
      minutes: 360, olderThan: 60,
      color: Cesium.Color.fromCssColorString('#fbbf24'),   // ambre
    }),
    'recent-strikes-24h': makeRecentStrikesEffect(scene, {
      minutes: 1440, olderThan: 360,
      color: Cesium.Color.fromCssColorString('#60a5fa'),   // bleu
    }),
    'storm-fog': stormFog,
    'precipitation': precipitation,
    'temperature': temperature,
    'wind': wind,
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