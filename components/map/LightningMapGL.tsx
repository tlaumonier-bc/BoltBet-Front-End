'use client';
// components/map/LightningMapGL.tsx

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useGameStore } from '@/store/gameStore';
import { useLiveStore } from '@/store/liveStore';
import { useLightningSocket } from '@/lib/socket';
import { HANDOFF, type Focus } from '@/lib/globeHandoff';

const STRIKE_FADE_MS = 8000;

const NIGHT_STYLE = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    sat: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#04060d' } },
    {
      id: 'sat',
      type: 'raster',
      source: 'sat',
      paint: {
        'raster-brightness-max': 0.45,
        'raster-saturation': -0.55,
        'raster-contrast': 0.1,
        'raster-opacity': 0.92,
      },
    },
    {
      id: 'night-tint',
      type: 'background',
      paint: { 'background-color': 'rgba(4,8,20,0.5)' },
    },
  ],
  sky: {
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  },
} as unknown as maplibregl.StyleSpecification;

export default function LightningMapGL({
  viewOnly = false,
  fill = false,
  initialFocus,
  onZoomBelow,
}: {
  viewOnly?: boolean;
  fill?: boolean;
  initialFocus?: Focus;
  onZoomBelow?: (f: Focus) => void;
}) {
  useLightningSocket();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const returnedRef = useRef(false);
  const [ready, setReady] = useState(false);

  const onZoomBelowRef = useRef(onZoomBelow);
  useEffect(() => {
    onZoomBelowRef.current = onZoomBelow;
  }, [onZoomBelow]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: NIGHT_STYLE,
        // style: 'https://demotiles.maplibre.org/style.json',
        center: [initialFocus?.lon ?? 0, initialFocus?.lat ?? 20],
        zoom: HANDOFF.mapStartZoom,
        attributionControl: { compact: true },
        scrollZoom: !fill,
      });
    } catch (err) {
      console.log('[map] constructor threw (WebGL context?):', err);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('error', (e) =>
      console.log('[maplibre error]', e?.error?.message ?? e, 'source:', (e as { sourceId?: string })?.sourceId ?? '-')
    );
    map.on('load', () => {
      console.log('[map] load fired, size:', container.clientWidth, 'x', container.clientHeight);
      map.resize();
    });
    map.on('idle', () => {
      console.log('[map] idle — tiles loaded:', map.areTilesLoaded());
      setReady(true);
    });

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
      map.addSource('strikes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'strike-glow', type: 'circle', source: 'strikes',
        paint: {
          'circle-radius': ['*', ['get', 'life'], 22],
          'circle-color': '#fde047', 'circle-blur': 1,
          'circle-opacity': ['*', ['get', 'life'], 0.35],
        },
      });
      map.addLayer({
        id: 'strike-core', type: 'circle', source: 'strikes',
        paint: {
          'circle-radius': ['+', 1.5, ['*', ['get', 'life'], 3]],
          'circle-color': '#eaf4ff', 'circle-opacity': ['get', 'life'],
        },
      });
    });

    map.on('zoom', () => {
      if (returnedRef.current) return;
      if (map.getZoom() <= HANDOFF.toGlobeZoom) {
        returnedRef.current = true;
        const c = map.getCenter();
        onZoomBelowRef.current?.({ lat: c.lat, lon: c.lng });
      }
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const src = mapRef.current?.getSource('strikes') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const now = Date.now();
      const features = useGameStore.getState().strikes
        .filter((s) => now - s.receivedAt < STRIKE_FADE_MS)
        .map((s) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
          properties: { life: 1 - (now - s.receivedAt) / STRIKE_FADE_MS },
        }));
      src.setData({ type: 'FeatureCollection', features });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const orbitTarget = useLiveStore((s) => s.orbitTarget);
  useEffect(() => {
    const map = mapRef.current;
    if (!orbitTarget || !map) return;
    map.flyTo({ center: [orbitTarget.lon, orbitTarget.lat], zoom: Math.max(HANDOFF.mapStartZoom, map.getZoom()), duration: 1600 });
  }, [orbitTarget]);

  return (
    <div className={`${fill ? 'absolute' : 'fixed'} inset-0 bg-storm`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-storm transition-opacity">
          <div className="h-40 w-40 animate-pulse rounded-full bg-linear-to-br from-blue-900 via-slate-900 to-black shadow-[0_0_90px_25px_rgba(59,130,246,0.25)]" />
          <span className="absolute bottom-16 text-xs tracking-[0.3em] text-blue-300/60">
            LOADING SATELLITE…
          </span>
        </div>
      )}
    </div>
  );
}