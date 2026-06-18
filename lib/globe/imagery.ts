// lib/globe/imagery.ts
// Night (Black Marble) + day (Blue Marble) base imagery, toggled via the /live
// HUD store. Country names now come from crisp vector labels (countryBorders),
// so the old blurry raster-label layer is gone.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';

export const OWM_KEY = process.env.NEXT_PUBLIC_OWM_API_KEY;


export function addOwmLayer(
  viewer: Cesium.Viewer,
  layer: string,
  alpha: number,
  label: string,
): Cesium.ImageryLayer {
  const imageryLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
      maximumLevel: 8,
      credit: `OpenWeatherMap — ${label}`,
    }),
  );
  imageryLayer.alpha = alpha;
  return imageryLayer;
}

export function setupImagery(viewer: Cesium.Viewer): () => void {
  const nightLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
      maximumLevel: 8,
      credit: 'NASA EOSDIS GIBS — VIIRS Black Marble',
    }),
  );
  const dayLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
      maximumLevel: 8,
      credit: 'NASA EOSDIS GIBS — Blue Marble',
    }),
  );

  if (!OWM_KEY && typeof window !== 'undefined') {
    console.warn('[imagery] NEXT_PUBLIC_OWM_API_KEY not set — Clouds/Rain layers disabled.');
  }

  const applyMapStyle = (style: 'night' | 'day') => {
    nightLayer.show = style === 'night';
    dayLayer.show = style === 'day';
  };
  applyMapStyle(useLiveStore.getState().mapStyle);
  const unsub = useLiveStore.subscribe((state) => applyMapStyle(state.mapStyle));

  return () => unsub();
}