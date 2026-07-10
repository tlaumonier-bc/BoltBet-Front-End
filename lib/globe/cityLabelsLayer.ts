import * as Cesium from 'cesium';
import { getCountryMapStats, type CountryMapCity } from '@/lib/api';
import { useLiveStore } from '@/store/liveStore';
import { COUNTRY_BOUNDS, type Bounds } from '@/lib/map/countryBounds';

const MAX_CITIES = 5;
const SELECTED_SHOW_BELOW_HEIGHT_M = 12_000_000;
const FREE_ZOOM_SHOW_BELOW_HEIGHT_M = 1_500_000;
const LABEL_HEIGHT_M = 8_000;

export function attachCityLabels(scene: Cesium.Scene): () => void {
  let labels: Cesium.LabelCollection | null = null;
  let currentIso = '';
  let inFlight = false;
  let requestedIso = '';
  let queuedIso = '';

  const ensure = (): Cesium.LabelCollection => {
    if (!labels) {
      labels = scene.primitives.add(
        new Cesium.LabelCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT }),
      ) as Cesium.LabelCollection;
    }
    return labels;
  };

  const clear = () => {
    if (labels) labels.removeAll();
  };

  const cameraHeight = () => scene.camera.positionCartographic.height;

  const normalizeLon = (lon: number) => {
    const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
    return Object.is(wrapped, -0) ? 0 : wrapped;
  };

  const boundsContains = (bounds: Bounds, lon: number, lat: number) =>
    lon >= bounds.minLon && lon <= bounds.maxLon && lat >= bounds.minLat && lat <= bounds.maxLat;

  const inferCountryFromCamera = (): string => {
    if (cameraHeight() > FREE_ZOOM_SHOW_BELOW_HEIGHT_M) return '';
    const cartographic = scene.camera.positionCartographic;
    const lon = normalizeLon(Cesium.Math.toDegrees(cartographic.longitude));
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const match = Object.entries(COUNTRY_BOUNDS).find(([, bounds]) => boundsContains(bounds, lon, lat));
    return match ? match[0].toUpperCase() : '';
  };

  const targetIso = () => {
    const selectedIso = useLiveStore.getState().selectedCountry?.iso2;
    return selectedIso ? selectedIso.toUpperCase() : inferCountryFromCamera();
  };

  const updateVisibility = () => {
    if (!labels) return;
    const selected = Boolean(useLiveStore.getState().selectedCountry?.iso2);
    const limit = selected ? SELECTED_SHOW_BELOW_HEIGHT_M : FREE_ZOOM_SHOW_BELOW_HEIGHT_M;
    labels.show = Boolean(currentIso) && cameraHeight() <= limit;
  };

  const render = (cities: CountryMapCity[]) => {
    const col = ensure();
    col.removeAll();

    for (const city of cities.slice(0, MAX_CITIES)) {
      col.add({
        text: city.city_name,
        position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat, LABEL_HEIGHT_M),
        font: '600 15px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fillColor: Cesium.Color.WHITE.withAlpha(0.94),
        style: Cesium.LabelStyle.FILL,
        outlineWidth: 0,
        showBackground: false,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -8),
        scaleByDistance: new Cesium.NearFarScalar(120_000, 1.15, SELECTED_SHOW_BELOW_HEIGHT_M, 0.45),
        translucencyByDistance: new Cesium.NearFarScalar(120_000, 1.0, SELECTED_SHOW_BELOW_HEIGHT_M, 0.0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }

    updateVisibility();
  };

  const load = async (iso2: string) => {
    if (inFlight) {
      queuedIso = iso2;
      return;
    }
    inFlight = true;
    requestedIso = iso2;
    try {
      const stats = await getCountryMapStats({ country: iso2, strikeLimit: 1, period: 'all' });
      if (targetIso() === iso2) {
        render(stats.cities);
      }
    } catch {
      /* Keep the globe usable if city stats are temporarily unavailable. */
    } finally {
      inFlight = false;
      const nextIso = queuedIso;
      queuedIso = '';
      if (nextIso && nextIso !== requestedIso && targetIso() === nextIso) {
        load(nextIso);
      }
    }
  };

  const sync = () => {
    const iso2 = targetIso();
    if (iso2 === currentIso) {
      updateVisibility();
      return;
    }

    currentIso = iso2;
    clear();
    if (iso2) load(iso2);
    updateVisibility();
  };

  sync();
  scene.camera.changed.addEventListener(sync);
  const unsub = useLiveStore.subscribe(sync);

  return () => {
    unsub();
    scene.camera.changed.removeEventListener(sync);
    if (labels && !scene.isDestroyed()) scene.primitives.remove(labels);
    labels = null;
  };
}
