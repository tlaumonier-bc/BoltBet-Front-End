// lib/globe/imagery.ts
// Night (Black Marble) + day (Blue Marble) base imagery, toggled via the /live
// HUD store. Country names now come from crisp vector labels (countryBorders).
//
// OWM weather tiles are now proxied through OUR backend
// (/api/weather/tiles/<layer>/{z}/{x}/{y}.png) so the OpenWeatherMap key stays
// server-side and is never shipped in the client bundle.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export function addOwmLayer(
  viewer: Cesium.Viewer,
  layer: string,
  alpha: number,
  label: string,
): Cesium.ImageryLayer {
  const imageryLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      // No appid here — the backend appends the key.
      url: `${API}/api/weather/tiles/${layer}/{z}/{x}/{y}.png`,
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

  const applyMapStyle = (style: 'night' | 'day') => {
    nightLayer.show = style === 'night';
    dayLayer.show = style === 'day';
  };
  applyMapStyle(useLiveStore.getState().mapStyle);
  const unsub = useLiveStore.subscribe((state) => applyMapStyle(state.mapStyle));

  return () => unsub();
}