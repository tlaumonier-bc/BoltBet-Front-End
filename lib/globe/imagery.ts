// lib/globe/imagery.ts
// Night (Black Marble) + day (Blue Marble) base imagery, toggled via the /live
// HUD store. Country names now come from crisp vector labels (countryBorders).
//
// OWM weather tiles are now proxied through OUR backend
// (/api/weather/tiles/<layer>/{z}/{x}/{y}.png) so the OpenWeatherMap key stays
// server-side and is never shipped in the client bundle.

import * as Cesium from 'cesium';
import { useLiveStore, type GlobeMapStyle } from '@/store/liveStore';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const DEFAULT_SCREEN_SPACE_ERROR = 2;
const HIGH_DETAIL_SCREEN_SPACE_ERROR = 0.5;
const DEFAULT_TILE_CACHE_SIZE = 100;
const HIGH_DETAIL_TILE_CACHE_SIZE = 1000;

// Tuning knobs for the NASA -> Esri automatic switch:
// - ESRI_MAX_LEVEL: increase to 24/25 to test deeper Esri requests. Avoid very
//   high values because Cesium will request many non-existent tiles.
// - ESRI_SWITCH_HEIGHT_M: lower = stay on NASA longer, higher = switch to Esri
//   sooner while zooming in.
const ESRI_MAX_LEVEL = 23;
const ESRI_SWITCH_HEIGHT_M = 2_500_000;

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
  const esriLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: ESRI_MAX_LEVEL,
      credit: 'Esri World Imagery',
    }),
  );

  const applyBaseImagery = (style: GlobeMapStyle) => {
    const useEsri = viewer.camera.positionCartographic.height <= ESRI_SWITCH_HEIGHT_M;

    nightLayer.show = !useEsri && style === 'night';
    dayLayer.show = !useEsri && style === 'day';
    esriLayer.show = useEsri;

    viewer.scene.globe.maximumScreenSpaceError = useEsri
      ? HIGH_DETAIL_SCREEN_SPACE_ERROR
      : DEFAULT_SCREEN_SPACE_ERROR;
    viewer.scene.globe.tileCacheSize = useEsri ? HIGH_DETAIL_TILE_CACHE_SIZE : DEFAULT_TILE_CACHE_SIZE;
    viewer.scene.globe.preloadAncestors = useEsri;
    viewer.scene.globe.preloadSiblings = useEsri;
  };

  const initial = useLiveStore.getState();
  applyBaseImagery(initial.mapStyle);
  const onCameraChanged = () => applyBaseImagery(useLiveStore.getState().mapStyle);
  viewer.camera.changed.addEventListener(onCameraChanged);
  const unsub = useLiveStore.subscribe((state) => applyBaseImagery(state.mapStyle));

  return () => {
    viewer.camera.changed.removeEventListener(onCameraChanged);
    unsub();
  };
}