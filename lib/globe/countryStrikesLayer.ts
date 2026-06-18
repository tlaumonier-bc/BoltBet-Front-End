// lib/globe/countryStrikesLayer.ts
// "Latest 1000 strikes in <country>" layer. Reacts to liveStore.selectedCountry
// + liveStore.countryStrikesOn: when on and the country has an ISO-2 code, it
// fetches /api/strikes/by-country/ and renders the points in electric cyan
// (distinct from the recent-strikes heat-map). Fetched rows are written back to
// the store so the country panel can show stats from the same data.

import * as Cesium from 'cesium';
import { getCountryStrikes } from '@/lib/api';
import { useLiveStore } from '@/store/liveStore';

const POLL_MS = 30_000;
const LIMIT = 1000;
const COLOR = Cesium.Color.fromCssColorString('#38bdf8'); // electric cyan

export function attachCountryStrikes(scene: Cesium.Scene): () => void {
  let points: Cesium.PointPrimitiveCollection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let currentKey = ''; // iso2 currently loaded, '' = nothing

  const ensure = (): Cesium.PointPrimitiveCollection => {
    if (!points) {
      points = scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT }),
      ) as Cesium.PointPrimitiveCollection;
    }
    return points;
  };
  
  const clear = () => { if (points) points.removeAll(); };

  const render = (rows: { lon: number; lat: number }[]) => {
    const col = ensure();
    col.removeAll();
    for (const s of rows) {
      col.add({
        position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat),
        pixelSize: 6,
        color: COLOR.withAlpha(0.7),
        outlineColor: COLOR.withAlpha(0.15),
        outlineWidth: 4,
        scaleByDistance: new Cesium.NearFarScalar(2.0e6, 1.3, 4.0e7, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(2.0e6, 1.0, 4.0e7, 0.6),
      });
    }
  };

  const refresh = async () => {
    const { selectedCountry, countryStrikesOn } = useLiveStore.getState();
    const iso2 = countryStrikesOn ? selectedCountry?.iso2 ?? null : null;
    if (!iso2 || inFlight) return;
    inFlight = true;
    try {
      const rows = await getCountryStrikes(iso2, LIMIT);
      // Selection may have changed during the await — guard before applying.
      const now = useLiveStore.getState();
      if (now.countryStrikesOn && now.selectedCountry?.iso2 === iso2) {
        render(rows);
        now.setCountryStrikes(rows);
      }
    } catch {
      /* backend hiccup — keep previous render */
    } finally {
      inFlight = false;
    }
  };

  // Re-key whenever the active (iso2 + on) target changes.
  const sync = () => {
    const { selectedCountry, countryStrikesOn } = useLiveStore.getState();
    const key = countryStrikesOn && selectedCountry?.iso2 ? selectedCountry.iso2 : '';
    if (key === currentKey) return;
    currentKey = key;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (!key) {
      clear();
      useLiveStore.getState().setCountryStrikes([]);
      return;
    }
    refresh();
    pollTimer = setInterval(refresh, POLL_MS);
  };

  sync();
  const unsub = useLiveStore.subscribe(sync);

  return () => {
    unsub();
    if (pollTimer) clearInterval(pollTimer);
    if (points && !scene.isDestroyed()) scene.primitives.remove(points);
    points = null;
  };
}