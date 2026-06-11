'use client';
// components/map/LightningMapGL.tsx
// High-quality, Google-Earth-style interactive map (MapLibre GL JS v5).
//
//  - Globe projection zoomed out, seamless zoom to satellite imagery (Esri, no key).
//  - ADAPTIVE NESTED GRID: each square splits into 4 sub-squares as you zoom in
//    (20° → 10° → 5° → 2.5° → 1.25° → 0.625°), snapped so children nest perfectly.
//  - BOLD multiplier chips: glowing glass badge + big colour-coded number per cell.
//  - Live lightning strikes as electric pings.
//
// Betting contract: BetModal reads the selected cell from store.cells, which is
// the backend's fixed 20° grid. So a click always resolves to its PARENT 20° cell
// (`lon_{lonMin}_lat_{latMin}`) — the sub-squares are a visual drill-down. The
// store's 20° multipliers are seeded from the SAME field the map draws, so the
// chip number and the modal number match. When the backend grid gains resolution,
// swap multiplierAt() for live strike-density and let bets target sub-cells.

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useGameStore } from '@/store/gameStore';
import { allCells, cellCenter, cellId } from '@/lib/grid';
import type { GridCell } from '@/types';

// ---- Tiles -----------------------------------------------------------------
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
// 'satellite' = Esri imagery, darkened to a control-room look (default — no API
// key, safe to push to dev/prod). 'dark' = vector dark style (needs a key for
// production). Override with NEXT_PUBLIC_MAP_STYLE.
const BASE_STYLE: 'dark' | 'satellite' =
  process.env.NEXT_PUBLIC_MAP_STYLE === 'dark' ? 'dark' : 'satellite';

const MAX_CELLS = 2400;
const MAX_CHIPS = 500;

// Polished dark vector basemap with clear country borders + city/country labels
// (control-room look, legible). Stadia is keyless on localhost; for production
// add a free Stadia/MapTiler key. MapTiler dark is used automatically if a key
// is present.
const STADIA_DARK = 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json';
const maptilerDark = (k: string) => `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${k}`;

// Light touch on the zoomed-in satellite — keep it crisp (Google-Maps-grade),
// just slightly toned so it sits with the dark UI. The control-room darkness
// lives on the orbital globe, not here.
const DARK_EARTH: maplibregl.RasterLayerSpecification['paint'] = {
  'raster-brightness-max': 0.92,
  'raster-saturation': -0.12,
  'raster-contrast': 0.05,
};

// Muted colour ramp by multiplier: hot (low payout) → calm (high payout).
// Soft, desaturated tones so a tinted number reads cleanly on dark glass.
const RAMP_STOPS: [number, [number, number, number]][] = [
  [1.1, [255, 138, 128]], // soft coral (hot)
  [3, [247, 196, 112]], // soft amber
  [5, [210, 214, 205]], // warm neutral
  [7, [125, 178, 255]], // soft blue
  [9, [181, 160, 255]], // soft violet (very calm)
];

// Interpolated colour for the multiplier chips.
function colorForMultiplier(m: number): string {
  const s = RAMP_STOPS;
  if (m <= s[0][0]) return `rgb(${s[0][1].join(',')})`;
  if (m >= s[s.length - 1][0]) return `rgb(${s[s.length - 1][1].join(',')})`;
  for (let i = 0; i < s.length - 1; i++) {
    const [m0, c0] = s[i];
    const [m1, c1] = s[i + 1];
    if (m >= m0 && m <= m1) {
      const t = (m - m0) / (m1 - m0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return `rgb(${s[s.length - 1][1].join(',')})`;
}

// ---- Multiplier field ------------------------------------------------------
// Resolution-independent smooth field, so zooming reveals finer detail of the
// same "storm systems" instead of a random reshuffle. 1.1 (hot) .. 9.0 (calm).
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function multiplierAt(lat: number, lon: number): number {
  const a = Math.sin(lat * 0.13 + lon * 0.07);
  const b = Math.sin(lat * 0.37 - lon * 0.21 + 1.7);
  const c = Math.sin(lat * 0.9 + lon * 0.6 + 4.2);
  const n = 0.5 + 0.3 * a + 0.13 * b + 0.07 * c;
  return Math.round((1.1 + clamp01(n) * 7.9) * 10) / 10;
}

function resForZoom(z: number): number {
  if (z < 2.5) return 20;
  if (z < 4) return 10;
  if (z < 5.5) return 5;
  if (z < 7) return 2.5;
  if (z < 8.5) return 1.25;
  return 0.625;
}

// Parent 20° cell id (matches store.cells + backend grid_for clamping).
function parentCellId(lat: number, lon: number): string {
  const plon = Math.max(-180, Math.min(160, Math.floor((lon + 180) / 20) * 20 - 180));
  const plat = Math.max(-90, Math.min(70, Math.floor((lat + 90) / 20) * 20 - 90));
  return cellId(plon, plat);
}

function ringFor(lon: number, lat: number, res: number): [number, number][] {
  const seg = res >= 20 ? 8 : res >= 10 ? 4 : res >= 5 ? 2 : 1;
  const ring: [number, number][] = [];
  for (let i = 0; i <= seg; i++) ring.push([lon + (i / seg) * res, lat]);
  for (let i = 1; i <= seg; i++) ring.push([lon + res, lat + (i / seg) * res]);
  for (let i = 1; i <= seg; i++) ring.push([lon + res - (i / seg) * res, lat + res]);
  for (let i = 1; i <= seg; i++) ring.push([lon, lat + res - (i / seg) * res]);
  ring.push([lon, lat]);
  return ring;
}

interface GridData {
  res: number;
  polys: GeoJSON.FeatureCollection;
  pts: GeoJSON.FeatureCollection;
}

// Build the grid for the current viewport at the zoom-appropriate resolution.
function buildVisibleGrid(map: maplibregl.Map): GridData {
  let res = resForZoom(map.getZoom());
  const b = map.getBounds();
  let w = b.getWest();
  let e = b.getEast();
  let s = b.getSouth();
  let n = b.getNorth();

  // Globe can report a wrapped / full-world box — normalise.
  if (e - w >= 360 || e < w) {
    w = -180;
    e = 180;
  }
  const padLon = (e - w) * 0.12;
  const padLat = (n - s) * 0.12;
  w = Math.max(-180, w - padLon);
  e = Math.min(180, e + padLon);
  s = Math.max(-90, s - padLat);
  n = Math.min(90, n + padLat);

  // Never exceed the cell cap (coarsen if the globe hands us too wide a box).
  while (((e - w) / res) * ((n - s) / res) > MAX_CELLS && res < 20) res *= 2;

  const startLon = Math.floor(w / res) * res;
  const startLat = Math.floor(s / res) * res;
  const polys: GeoJSON.Feature[] = [];
  const pts: GeoJSON.Feature[] = [];

  for (let lon = startLon; lon < e; lon += res) {
    for (let lat = startLat; lat < n; lat += res) {
      if (lat < -90 || lat + res > 90.0001) continue;
      const cLat = lat + res / 2;
      const cLon = lon + res / 2;
      const multiplier = multiplierAt(cLat, cLon);
      const parentId = parentCellId(cLat, cLon);
      polys.push({
        type: 'Feature',
        properties: { multiplier, parentId, res },
        geometry: { type: 'Polygon', coordinates: [ringFor(lon, lat, res)] },
      });
      pts.push({
        type: 'Feature',
        properties: { multiplier, label: `${multiplier.toFixed(1)}x`, parentId },
        geometry: { type: 'Point', coordinates: [cLon, cLat] },
      });
    }
  }
  return {
    res,
    polys: { type: 'FeatureCollection', features: polys },
    pts: { type: 'FeatureCollection', features: pts },
  };
}

// Default style: Esri satellite darkened to a control-room earth, with Esri's
// boundary + place labels that fade in as you zoom (so countries/cities stay
// legible). All no-key, safe to push to dev/prod.
function buildSatelliteStyle(): maplibregl.StyleSpecification {
  const sources: maplibregl.StyleSpecification['sources'] = {};
  const layers: maplibregl.LayerSpecification[] = [
    { id: 'bg', type: 'background', paint: { 'background-color': '#02040c' } },
  ];

  if (MAPTILER_KEY) {
    sources.base = {
      type: 'raster',
      tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`],
      tileSize: 256,
      attribution: '© MapTiler © OpenStreetMap contributors',
      maxzoom: 20,
    };
  } else {
    sources.base = {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    };
  }
  layers.push({ id: 'base', type: 'raster', source: 'base', paint: DARK_EARTH });

  // Boundaries + place labels (Esri reference, no key). Hidden at world view,
  // fade in as you zoom into a region so it never clutters the globe.
  sources.labels = {
    type: 'raster',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    ],
    tileSize: 256,
    maxzoom: 19,
  };
  layers.push({
    id: 'labels',
    type: 'raster',
    source: 'labels',
    paint: {
      'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3.5, 0, 6, 0.7],
      'raster-saturation': -0.3,
    },
  });

  return { version: 8, projection: { type: 'globe' }, sources, layers };
}

// The map's style: a legible dark vector basemap (countries + cities) by default,
// photographic satellite when opted in.
function resolveStyle(): string | maplibregl.StyleSpecification {
  if (BASE_STYLE === 'satellite') return buildSatelliteStyle();
  return MAPTILER_KEY ? maptilerDark(MAPTILER_KEY) : STADIA_DARK;
}

// Show ONLY country/continent labels until you zoom into a country. Cities,
// towns, states, POIs and road labels are hidden below this zoom to keep the
// world view clean and low-clutter. Works on any OpenMapTiles-based dark style.
const LABEL_MIN_ZOOM = 6;
function gateLabels(map: maplibregl.Map) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const l of style.layers) {
    if (l.type !== 'symbol') continue;
    const sl = (l as { 'source-layer'?: string })['source-layer'] ?? '';
    const id = l.id.toLowerCase();
    const isCountry = id.includes('country') || id.includes('continent');
    const settlement = sl === 'place' && !isCountry; // states, cities, towns, …
    const heavy = sl === 'poi' || sl === 'transportation_name' || sl === 'aerodrome_label';
    if (settlement || heavy) {
      const curMin = typeof l.minzoom === 'number' ? l.minzoom : 0;
      try {
        map.setLayerZoomRange(l.id, Math.max(curMin, LABEL_MIN_ZOOM), l.maxzoom ?? 24);
      } catch {
        /* layer may not accept range — ignore */
      }
    }
  }
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    /* elegant multiplier chip — tinted number on dark glass, no glow */
    .mult-chip{display:flex;align-items:baseline;justify-content:center;height:21px;padding:0 8px;border-radius:7px;
      font-family:var(--font-unbounded),system-ui,sans-serif;font-weight:700;font-size:11.5px;line-height:1;
      letter-spacing:-.01em;white-space:nowrap;color:var(--c);pointer-events:none;
      background:rgba(7,10,17,.82);
      border:1px solid rgba(255,255,255,.10);box-shadow:0 1px 4px rgba(0,0,0,.45);
      text-shadow:0 1px 2px rgba(0,0,0,.55);will-change:transform}
    .mult-chip .x{opacity:.4;font-size:8.5px;margin-left:1px;font-weight:600;color:#c8d2e0}
  `;
  document.head.appendChild(el);
}
function makeChipEl(multiplier: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'mult-chip';
  el.style.setProperty('--c', colorForMultiplier(multiplier));
  el.innerHTML = `<b>${multiplier.toFixed(1)}</b><span class="x">x</span>`;
  return el;
}

// Seed the store's 20° grid from the same field, so chip ↔ modal numbers match.
function seedStoreCells(): GridCell[] {
  return allCells().map(({ id, lonMin, latMin }) => {
    const c = cellCenter(lonMin, latMin);
    const m = multiplierAt(c.lat, c.lon);
    return {
      id,
      lonMin,
      latMin,
      multiplier: m,
      strikeCount24h: Math.round((9 - m) * 45),
      activeBets: 0,
      isHot: m < 1.5,
    };
  });
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

interface LightningMapGLProps {
  viewOnly?: boolean;
  initialView?: { center: [number, number]; zoom: number };
  onZoomOutToGlobe?: () => void;
}

export default function LightningMapGL({
  viewOnly = false,
  initialView,
  onZoomOutToGlobe,
}: LightningMapGLProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const chipMarkers = useRef<maplibregl.Marker[]>([]);
  const hoveredId = useRef<number | string | null>(null);
  const selectCell = useGameStore((s) => s.selectCell);

  useEffect(() => {
    if (!containerRef.current) return;
    injectStyles();

    if (Object.keys(useGameStore.getState().cells).length === 0) {
      useGameStore.getState().setCells(seedStoreCells());
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle(),
      center: initialView?.center ?? [10, 25],
      zoom: initialView?.zoom ?? 1.7,
      minZoom: 0,
      maxZoom: 19,
      attributionControl: { compact: true },
      dragRotate: false,
      maxPitch: 0,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const refreshGrid = () => {
      const gridSrc = map.getSource('grid') as maplibregl.GeoJSONSource | undefined;
      if (!gridSrc) return;
      if (hoveredId.current !== null) {
        map.setFeatureState({ source: 'grid', id: hoveredId.current }, { hover: false });
        hoveredId.current = null;
      }
      const g = buildVisibleGrid(map);
      gridSrc.setData(g.polys);

      // Rebuild the bold multiplier chips for the visible cells.
      for (const mk of chipMarkers.current) mk.remove();
      chipMarkers.current = [];
      const feats = g.pts.features;
      if (feats.length <= MAX_CHIPS) {
        for (const f of feats) {
          if (f.geometry.type !== 'Point') continue;
          const [lon, lat] = f.geometry.coordinates;
          const mult = f.properties?.multiplier as number;
          chipMarkers.current.push(
            new maplibregl.Marker({ element: makeChipEl(mult), anchor: 'center' })
              .setLngLat([lon, lat])
              .addTo(map)
          );
        }
      }
    };

    map.on('load', () => {
      try {
        map.setProjection({ type: 'globe' });
      } catch {
        /* style projection already set */
      }

      gateLabels(map); // countries only until you zoom in

      // Storm-canopy atmosphere shell wrapping the globe (the layer the bolts
      // fall from). Wrapped in try/catch in case the sky spec differs by version.
      try {
        map.setSky({
          'sky-color': '#0a1726',
          'horizon-color': '#16263c',
          'fog-color': '#070d16',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.6,
          'fog-ground-blend': 0.4,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 7, 0.25, 12, 0],
        });
      } catch {
        /* default globe atmosphere remains */
      }

      map.addSource('grid', { type: 'geojson', data: EMPTY_FC, generateId: true });
      map.addSource('selection', { type: 'geojson', data: EMPTY_FC });

      // Cell fill — invisible until hover, then a faint cool wash. Clean.
      map.addLayer({
        id: 'grid-fill',
        type: 'fill',
        source: 'grid',
        paint: {
          'fill-color': '#aebfd4',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.12,
            0,
          ],
        },
      });
      // Thin hairline grid — restrained, no glow.
      map.addLayer({
        id: 'grid-line',
        type: 'line',
        source: 'grid',
        paint: {
          'line-color': 'rgba(120,190,225,0.16)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1],
        },
      });
      // Selected cell — bright pulsing ring (pulse driven by RAF below).
      map.addLayer({
        id: 'selection-line',
        type: 'line',
        source: 'selection',
        paint: {
          'line-color': '#fde047',
          'line-width': 3,
          'line-opacity': 1,
          'line-blur': 1,
        },
      });
      // Bold multiplier numbers are DOM chips (see refreshGrid) — crisp, on-brand,
      // and free of any remote glyph dependency.

      const setHover = (id: number | string | null) => {
        if (hoveredId.current !== null) {
          map.setFeatureState({ source: 'grid', id: hoveredId.current }, { hover: false });
        }
        hoveredId.current = id;
        if (id !== null) map.setFeatureState({ source: 'grid', id }, { hover: true });
      };

      map.on('mousemove', 'grid-fill', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (f && f.id != null && f.id !== hoveredId.current) setHover(f.id);
      });
      map.on('mouseleave', 'grid-fill', () => {
        map.getCanvas().style.cursor = '';
        setHover(null);
      });

      map.on('click', 'grid-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        // Highlight the clicked sub-cell.
        (map.getSource('selection') as maplibregl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: f.geometry }],
        });
        // Bet resolves to the parent 20° cell the store/backend understands.
        if (!viewOnly) {
          const parentId = f.properties?.parentId as string | undefined;
          if (parentId) selectCell(parentId);
        }
      });

      refreshGrid();
    });

    map.on('moveend', () => {
      refreshGrid();
      // Zoom out far enough → hand back to the orbital globe.
      if (onZoomOutToGlobe && map.getZoom() <= 2.2) onZoomOutToGlobe();
    });

    // Pulse the selection ring — only while a cell is selected, so the map can
    // idle (no forced per-frame repaint) the rest of the time.
    let raf = 0;
    const pulse = () => {
      raf = 0;
      if (!useGameStore.getState().selectedCellId) return; // stop when nothing selected
      if (map.getLayer('selection-line')) {
        const t = (Math.sin(performance.now() / 360) + 1) / 2; // 0..1
        map.setPaintProperty('selection-line', 'line-width', 1.5 + t * 1.5);
        map.setPaintProperty('selection-line', 'line-opacity', 0.5 + t * 0.4);
      }
      raf = requestAnimationFrame(pulse);
    };
    const startPulse = () => {
      if (!raf) raf = requestAnimationFrame(pulse);
    };
    const stopPulse = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    // Restart the pulse whenever a selection appears/clears.
    const unsubSel = useGameStore.subscribe((s, p) => {
      if (s.selectedCellId !== p.selectedCellId) {
        if (s.selectedCellId) startPulse();
        else stopPulse();
      }
    });

    const onResize = () => map.resize();
    window.addEventListener('resize', onResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      unsubSel();
      window.removeEventListener('resize', onResize);
      for (const mk of chipMarkers.current) mk.remove();
      chipMarkers.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOnly]);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={containerRef} className="h-full w-full" />
      {/* cinematic vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,2,10,0.55) 100%)',
        }}
      />
    </div>
  );
}
