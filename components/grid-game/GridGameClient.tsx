'use client';

/* eslint-disable @next/next/no-img-element -- raw map tiles are external tile images, not app content images. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getCountryStrikesResult,
  getGridActiveCountries,
  getGridMatchState,
  getProfile,
  getStrikesInBounds,
  registerUsername,
  selectGridCell,
  startGridMatch,
  type CountryStrike,
  type GridActiveCountry,
  type GridMatchState,
} from '@/lib/api';
import { flagEmoji } from '@/lib/live/owm';
import { COUNTRY_BOUNDS, WORLD_BOUNDS, type Bounds } from '@/lib/map/countryBounds';
import { useSessionStore } from '@/store/sessionStore';

const TILE_SIZE = 256;
const ESRI_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const DEFAULT_COUNTRIES: GridActiveCountry[] = [
  { country: 'US', strikes30s: 0, strikes5m: 0 },
  { country: 'BR', strikes30s: 0, strikes5m: 0 },
  { country: 'IN', strikes30s: 0, strikes5m: 0 },
  { country: 'FR', strikes30s: 0, strikes5m: 0 },
];
const ACTIVE_COUNTRY_CANDIDATES = [
  'US', 'BR', 'IN', 'ID', 'CD', 'CO', 'VE', 'MX', 'AR', 'AU', 'ZA', 'FR',
  'IT', 'ES', 'DE', 'GB', 'PL', 'RO', 'HR', 'RS',
];
const AREA_GRID_COLS = 10;
const AREA_GRID_ROWS = 8;
const AREA_WINDOW_MS = 30_000;
const AREA_FALLBACK_WINDOW_MS = 2 * 60_000;
const AREA_SCAN_MS = 10_000;   // rescan for active areas every 10s (drives the countdown)
const AREA_TTL_MS = 22_000;    // keep a detected area alive across a couple of scans
const DENSITY_WINDOW_MS = 60_000;   // heatmap reflects strikes from the last 60s (= a round)
const DENSITY_REDRAW_MS = 1_000;    // recompute the heatmap every second
const AREA_MIN_TRIGGERED_RATIO = 0.5;
const AREA_MIN_TRIGGERED_CELLS = 3;
const AREA_MIN_STRIKES = 3;
const CELL_LOCK_MS = 3_000;

type LayerKey = 'density' | 'multiplier' | 'opponent' | 'storm';
const LAYER_DEFS: { key: LayerKey; label: string; available: boolean; hint: string }[] = [
  { key: 'density', label: 'Strike density', available: true, hint: 'Live heatmap of recent strikes' },
  { key: 'opponent', label: 'Opponent heat', available: true, hint: 'Where the bot picks most' },
  { key: 'multiplier', label: 'Multiplier zones', available: false, hint: 'Coming soon' },
  { key: 'storm', label: 'Storm movement', available: false, hint: 'Needs live storm feed' },
];
type LayerState = Record<LayerKey, boolean>;
const DEFAULT_LAYERS: LayerState = { density: true, opponent: true, multiplier: false, storm: false };

type Phase = 'selecting' | 'finding' | 'preparing' | 'active' | 'settled';
type LonLat = [number, number];
type CountryPolygon = LonLat[][];
type SelectedCell = { cell: number; startedAt: number; expiresAt: number } | null;
type PreparedPolygon = { polygon: CountryPolygon; bounds: Bounds; area: number; centerLon: number };
type AreaCandidate = {
  id: string;
  bounds: Bounds;
  strikeCount: number;
  triggeredCells: number;
  boxCells: number;
  triggeredRatio: number;
  score: number;
  expiresAt?: number;
};

interface CountryFeature {
  type: 'Feature';
  properties?: Record<string, string | number | null | undefined>;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: LonLat[][] | LonLat[][][];
  };
}

interface CountryFeatureCollection {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

function clampLat(lat: number) {
  return Math.max(-85, Math.min(85, lat));
}

function paddedBounds(bounds: Bounds): Bounds {
  const lonPad = Math.max(0.8, Math.abs(bounds.maxLon - bounds.minLon) * 0.14);
  const latPad = Math.max(0.5, Math.abs(bounds.maxLat - bounds.minLat) * 0.14);
  return {
    ...bounds,
    minLon: bounds.minLon - lonPad,
    maxLon: bounds.maxLon + lonPad,
    minLat: Math.max(-85, bounds.minLat - latPad),
    maxLat: Math.min(85, bounds.maxLat + latPad),
  };
}

function mod360(lon: number) {
  return ((lon % 360) + 360) % 360;
}

function unwrapStartForRing(ring: LonLat[]) {
  const sorted = ring.map(([lon]) => mod360(lon)).sort((a, b) => a - b);
  if (sorted.length < 2) return 0;
  let bestGap = -1;
  let start = sorted[0];
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1];
    const gap = next - current;
    if (gap > bestGap) {
      bestGap = gap;
      start = i === sorted.length - 1 ? sorted[0] : sorted[i + 1];
    }
  }
  return start;
}

function unwrapLonFromStart(lon: number, start: number) {
  let next = mod360(lon);
  if (next < start) next += 360;
  return next;
}

function unwrapPolygon(polygon: CountryPolygon): CountryPolygon {
  const start = unwrapStartForRing(polygon[0] ?? []);
  return polygon.map((ring) => ring.map(([lon, lat]) => [unwrapLonFromStart(lon, start), lat] as LonLat));
}

function boundsForPolygon(polygon: CountryPolygon, fallbackLabel: string): Bounds {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of polygon) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  if (!Number.isFinite(minLon)) return { ...WORLD_BOUNDS, label: fallbackLabel };
  return { minLon, minLat, maxLon, maxLat, label: fallbackLabel };
}

function normalizeLonToBounds(lon: number, bounds: Bounds) {
  const center = (bounds.minLon + bounds.maxLon) / 2;
  let next = lon;
  while (next - center > 180) next -= 360;
  while (next - center < -180) next += 360;
  return next;
}

function worldPoint(lat: number, lon: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const sin = Math.sin((clampLat(lat) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function viewport(bounds: Bounds, aspect: number) {
  const padded = paddedBounds(bounds);
  let bestZoom = 5;
  for (let zoom = 3; zoom <= 13; zoom += 1) {
    const nw = worldPoint(padded.maxLat, padded.minLon, zoom);
    const se = worldPoint(padded.minLat, padded.maxLon, zoom);
    if (se.x - nw.x <= 2600 && se.y - nw.y <= 1900) bestZoom = zoom;
  }
  const nw = worldPoint(padded.maxLat, padded.minLon, bestZoom);
  const se = worldPoint(padded.minLat, padded.maxLon, bestZoom);
  const width = Math.max(1, se.x - nw.x);
  const height = Math.max(1, se.y - nw.y);
  const targetAspect = Math.max(0.65, Math.min(2.2, aspect || 1.4));
  let viewWidth = width;
  let viewHeight = height;
  if (viewWidth / viewHeight < targetAspect) viewWidth = viewHeight * targetAspect;
  else viewHeight = viewWidth / targetAspect;
  const centerX = (nw.x + se.x) / 2;
  const centerY = (nw.y + se.y) / 2;
  return {
    zoom: bestZoom,
    left: centerX - viewWidth / 2,
    top: centerY - viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
  };
}

function projectPx(bounds: Bounds, width: number, height: number, lat: number, lon: number) {
  const view = viewport(bounds, width / Math.max(1, height));
  const p = worldPoint(lat, normalizeLonToBounds(lon, bounds), view.zoom);
  return {
    x: ((p.x - view.left) / view.width) * width,
    y: ((p.y - view.top) / view.height) * height,
  };
}

function pathForPolygons(polygons: CountryPolygon[], bounds: Bounds, width: number, height: number) {
  return polygons
    .map((polygon) =>
      polygon
        .map((ring) => {
          const points = ring
            .map(([lon, lat], index) => {
              const p = projectPx(bounds, width, height, lat, lon);
              return `${index === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
            })
            .join(' ');
          return `${points} Z`;
        })
        .join(' '),
    )
    .join(' ');
}

function featureIso(feature: CountryFeature) {
  const props = feature.properties ?? {};
  const raw = props.ISO_A2_EH ?? props.ISO_A2 ?? props.iso_a2;
  return typeof raw === 'string' ? raw.toUpperCase() : '';
}

function featurePolygons(feature: CountryFeature): CountryPolygon[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates as CountryPolygon];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as CountryPolygon[];
  return [];
}

function pointInRing(lon: number, lat: number, ring: LonLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, prepared: PreparedPolygon) {
  const normalizedLon = normalizeLonToBounds(lon, prepared.bounds);
  const [outer, ...holes] = prepared.polygon;
  if (!outer || !pointInRing(normalizedLon, lat, outer)) return false;
  return !holes.some((hole) => pointInRing(normalizedLon, lat, hole));
}

function preparePolygons(polygons: CountryPolygon[], label: string): PreparedPolygon[] {
  return polygons.map((polygon) => {
    const unwrapped = unwrapPolygon(polygon);
    const bounds = boundsForPolygon(unwrapped, label);
    return {
      polygon: unwrapped,
      bounds,
      area: Math.max(0, bounds.maxLon - bounds.minLon) * Math.max(0, bounds.maxLat - bounds.minLat),
      centerLon: (bounds.minLon + bounds.maxLon) / 2,
    };
  });
}

function selectCountryRender(polygons: CountryPolygon[], strikes: CountryStrike[], fallback: Bounds) {
  const prepared = preparePolygons(polygons, fallback.label);
  if (!prepared.length) return { polygons: [] as CountryPolygon[], bounds: fallback };

  let best = prepared[0];
  let bestScore = -1;
  for (const candidate of prepared) {
    const score = strikes.reduce((count, strike) => (
      pointInPolygon(strike.lon, strike.lat, candidate) ? count + 1 : count
    ), 0);
    if (score > bestScore || (score === bestScore && candidate.area > best.area)) {
      best = candidate;
      bestScore = score;
    }
  }
  return { polygons: [best.polygon], bounds: best.bounds };
}

type PreparedCountry = {
  iso: string;
  polygons: PreparedPolygon[];
  minLat: number;
  maxLat: number;
};

// Prepare every country polygon once so we can resolve which country any point
// falls into (used to label areas that straddle borders or sit offshore).
function prepareCountries(features: CountryFeature[]): PreparedCountry[] {
  const result: PreparedCountry[] = [];
  for (const feature of features) {
    const iso = featureIso(feature);
    if (!iso) continue;
    const polygons = preparePolygons(featurePolygons(feature), iso);
    if (!polygons.length) continue;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const polygon of polygons) {
      minLat = Math.min(minLat, polygon.bounds.minLat);
      maxLat = Math.max(maxLat, polygon.bounds.maxLat);
    }
    result.push({ iso, polygons, minLat, maxLat });
  }
  return result;
}

function cellCenter(bounds: Bounds, grid: { cols: number; rows: number }, row: number, col: number): LonLat {
  const lon = bounds.minLon + ((col + 0.5) / grid.cols) * (bounds.maxLon - bounds.minLon);
  const lat = bounds.maxLat - ((row + 0.5) / grid.rows) * (bounds.maxLat - bounds.minLat);
  return [lon, lat];
}

function polygonOverlapsBounds(polygon: PreparedPolygon, area: Bounds) {
  if (polygon.bounds.maxLat < area.minLat || polygon.bounds.minLat > area.maxLat) return false;
  const center = normalizeLonToBounds(polygon.centerLon, area);
  const halfWidth = (polygon.bounds.maxLon - polygon.bounds.minLon) / 2;
  return center + halfWidth >= area.minLon && center - halfWidth <= area.maxLon;
}

// Tally which country owns each grid cell center; the country with the most
// cells wins the label. Cells over the ocean simply belong to no country.
function dominantCountryForArea(
  countries: PreparedCountry[],
  bounds: Bounds,
  grid: { cols: number; rows: number },
): { iso: string; count: number; renderPolygons: CountryPolygon[] } | null {
  if (!countries.length) return null;
  const counts = new Map<string, number>();
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const [lon, lat] = cellCenter(bounds, grid, row, col);
      for (const country of countries) {
        if (lat < country.minLat || lat > country.maxLat) continue;
        if (country.polygons.some((polygon) => pointInPolygon(lon, lat, polygon))) {
          counts.set(country.iso, (counts.get(country.iso) ?? 0) + 1);
          break;
        }
      }
    }
  }
  let bestIso = '';
  let bestCount = 0;
  for (const [iso, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestIso = iso;
    }
  }
  if (!bestIso) return null;
  const country = countries.find((item) => item.iso === bestIso)!;
  const overlapping = country.polygons.filter((polygon) => polygonOverlapsBounds(polygon, bounds));
  const source = overlapping.length ? overlapping : country.polygons;
  return { iso: bestIso, count: bestCount, renderPolygons: source.map((polygon) => polygon.polygon) };
}

function mapTiles(bounds: Bounds, aspect: number) {
  const view = viewport(bounds, aspect);
  const tileCount = 2 ** view.zoom;
  const minX = Math.floor(view.left / TILE_SIZE);
  const maxX = Math.floor((view.left + view.width) / TILE_SIZE);
  const minY = Math.floor(view.top / TILE_SIZE);
  const maxY = Math.floor((view.top + view.height) / TILE_SIZE);
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({
        key: `${view.zoom}-${x}-${y}`,
        src: `${ESRI_TILE}/${view.zoom}/${y}/${((x % tileCount) + tileCount) % tileCount}`,
        left: ((x * TILE_SIZE - view.left) / view.width) * 100,
        top: ((y * TILE_SIZE - view.top) / view.height) * 100,
        width: (TILE_SIZE / view.width) * 100,
        height: (TILE_SIZE / view.height) * 100,
      });
    }
  }
  return tiles;
}

function strikeVisual(strike: CountryStrike, now: number) {
  const receivedAt = Date.parse(strike.received_at);
  const age = Number.isFinite(receivedAt) ? Math.max(0, now - receivedAt) : 60_000;
  const fresh = age < 2600;
  const recent = age < 30_000;
  const life = fresh ? Math.max(0, 1 - age / 2600) : 0;
  return {
    age,
    fresh,
    recent,
    opacity: fresh ? 0.4 + life * 0.6 : recent ? 0.7 : 0.4,
    scale: fresh ? 0.75 + life * 0.55 : 0.72,
  };
}

function countryBounds(iso: string): Bounds {
  return COUNTRY_BOUNDS[iso.toLowerCase()] ?? { ...WORLD_BOUNDS, label: iso.toUpperCase() };
}

function countryName(iso: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso.toUpperCase()) ?? iso.toUpperCase();
  } catch {
    return iso.toUpperCase();
  }
}

function msUntil(iso: string) {
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

function secondsUntil(iso: string) {
  return Math.ceil(msUntil(iso) / 1000);
}

function formatMatchOffset(timestamp: string, match: GridMatchState | null) {
  if (!match) return '-';
  const start = Date.parse(match.timing.startedAt);
  const at = Date.parse(timestamp);
  if (!Number.isFinite(start) || !Number.isFinite(at)) return '-';
  const seconds = (at - start) / 1000;
  return `${seconds >= 0 ? '+' : ''}${seconds.toFixed(2)}s`;
}

function phaseFor(match: GridMatchState | null): Phase {
  if (!match) return 'selecting';
  if (match.status === 'settled') return 'settled';
  const now = Date.now();
  if (now < new Date(match.timing.startedAt).getTime()) return 'preparing';
  // End the round on the clock rather than waiting for the backend to flip
  // status: the round is over once endsAt passes. The settle poll then fills in
  // the authoritative Elo a moment later.
  if (now >= new Date(match.timing.endsAt).getTime()) return 'settled';
  return 'active';
}

function strikeCountSince(strikes: CountryStrike[], sinceMs: number) {
  let count = 0;
  for (const strike of strikes) {
    const receivedAt = Date.parse(strike.received_at);
    if (!Number.isFinite(receivedAt)) continue;
    if (receivedAt >= sinceMs) count += 1;
    else break;
  }
  return count;
}

function boundsForAreaCells(bounds: Bounds, minCol: number, maxCol: number, minRow: number, maxRow: number): Bounds {
  const lonStep = (bounds.maxLon - bounds.minLon) / AREA_GRID_COLS;
  const latStep = (bounds.maxLat - bounds.minLat) / AREA_GRID_ROWS;
  const padLon = lonStep * 0.75;
  const padLat = latStep * 0.75;
  return {
    label: `${bounds.label} active area`,
    minLon: Math.max(bounds.minLon, bounds.minLon + minCol * lonStep - padLon),
    maxLon: Math.min(bounds.maxLon, bounds.minLon + (maxCol + 1) * lonStep + padLon),
    minLat: Math.max(bounds.minLat, bounds.maxLat - (maxRow + 1) * latStep - padLat),
    maxLat: Math.min(bounds.maxLat, bounds.maxLat - minRow * latStep + padLat),
  };
}

function buildAreaCandidates(strikes: CountryStrike[], bounds: Bounds, now: number, windowMs = AREA_WINDOW_MS): AreaCandidate[] {
  const since = now - windowMs;
  const counts = Array.from({ length: AREA_GRID_ROWS }, () => Array.from({ length: AREA_GRID_COLS }, () => 0));
  const recentStrikes = strikes.filter((strike) => {
    const receivedAt = Date.parse(strike.received_at);
    if (!Number.isFinite(receivedAt) || receivedAt < since) return false;
    const lon = normalizeLonToBounds(strike.lon, bounds);
    return lon >= bounds.minLon && lon <= bounds.maxLon && strike.lat >= bounds.minLat && strike.lat <= bounds.maxLat;
  });

  for (const strike of recentStrikes) {
    const lon = normalizeLonToBounds(strike.lon, bounds);
    const col = Math.max(0, Math.min(AREA_GRID_COLS - 1, Math.floor(((lon - bounds.minLon) / Math.max(0.0001, bounds.maxLon - bounds.minLon)) * AREA_GRID_COLS)));
    const row = Math.max(0, Math.min(AREA_GRID_ROWS - 1, Math.floor(((bounds.maxLat - strike.lat) / Math.max(0.0001, bounds.maxLat - bounds.minLat)) * AREA_GRID_ROWS)));
    counts[row][col] += 1;
  }

  const visited = Array.from({ length: AREA_GRID_ROWS }, () => Array.from({ length: AREA_GRID_COLS }, () => false));
  const candidates: AreaCandidate[] = [];
  for (let row = 0; row < AREA_GRID_ROWS; row += 1) {
    for (let col = 0; col < AREA_GRID_COLS; col += 1) {
      if (visited[row][col] || counts[row][col] === 0) continue;
      const stack = [{ row, col }];
      const cells: { row: number; col: number }[] = [];
      visited[row][col] = true;
      while (stack.length) {
        const current = stack.pop()!;
        cells.push(current);
        for (const next of [
          { row: current.row - 1, col: current.col },
          { row: current.row + 1, col: current.col },
          { row: current.row, col: current.col - 1 },
          { row: current.row, col: current.col + 1 },
        ]) {
          if (
            next.row < 0 || next.row >= AREA_GRID_ROWS ||
            next.col < 0 || next.col >= AREA_GRID_COLS ||
            visited[next.row][next.col] ||
            counts[next.row][next.col] === 0
          ) continue;
          visited[next.row][next.col] = true;
          stack.push(next);
        }
      }

      const minRow = Math.min(...cells.map((cell) => cell.row));
      const maxRow = Math.max(...cells.map((cell) => cell.row));
      const minCol = Math.min(...cells.map((cell) => cell.col));
      const maxCol = Math.max(...cells.map((cell) => cell.col));
      const boxCells = (maxRow - minRow + 1) * (maxCol - minCol + 1);
      const triggeredCells = cells.length;
      const strikeCount = cells.reduce((sum, cell) => sum + counts[cell.row][cell.col], 0);
      const triggeredRatio = triggeredCells / Math.max(1, boxCells);
      if (
        triggeredRatio < AREA_MIN_TRIGGERED_RATIO ||
        triggeredCells < AREA_MIN_TRIGGERED_CELLS ||
        strikeCount < AREA_MIN_STRIKES
      ) continue;

      candidates.push({
        id: `${minCol}-${minRow}-${maxCol}-${maxRow}`,
        bounds: boundsForAreaCells(bounds, minCol, maxCol, minRow, maxRow),
        strikeCount,
        triggeredCells,
        boxCells,
        triggeredRatio,
        score: strikeCount * 4 + triggeredCells * 2 + triggeredRatio * 10,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// Ratio (0..1) of where a lat/lon lands inside the rendered viewport. The grid,
// the strike markers and the cell hit-testing must all use this same projection
// (Mercator + padding + aspect), otherwise a strike scores in a different cell
// than the one it visually lands in.
function projectRatio(bounds: Bounds, aspect: number, lat: number, lon: number) {
  const view = viewport(bounds, aspect);
  const p = worldPoint(lat, normalizeLonToBounds(lon, bounds), view.zoom);
  return { rx: (p.x - view.left) / view.width, ry: (p.y - view.top) / view.height };
}

function cellForStrike(strike: CountryStrike, bounds: Bounds, grid: { cols: number; rows: number }, aspect: number) {
  const { rx, ry } = projectRatio(bounds, aspect, strike.lat, strike.lon);
  if (rx < 0 || rx >= 1 || ry < 0 || ry >= 1) return null;
  const col = Math.min(grid.cols - 1, Math.floor(rx * grid.cols));
  const row = Math.min(grid.rows - 1, Math.floor(ry * grid.rows));
  return row * grid.cols + col;
}

function cellStrikeCounts(strikes: CountryStrike[], bounds: Bounds, grid: { cols: number; rows: number }, aspect: number, now: number) {
  const counts = Array.from({ length: grid.rows }, () => Array.from({ length: grid.cols }, () => 0));
  for (const strike of strikes) {
    const receivedAt = Date.parse(strike.received_at);
    if (!Number.isFinite(receivedAt) || receivedAt < now - AREA_WINDOW_MS) continue;
    const cell = cellForStrike(strike, bounds, grid, aspect);
    if (cell === null) continue;
    counts[Math.floor(cell / grid.cols)][cell % grid.cols] += 1;
  }
  return counts;
}

function areaRectPx(countryBounds: Bounds, areaBounds: Bounds, width: number, height: number) {
  const nw = projectPx(countryBounds, width, height, areaBounds.maxLat, areaBounds.minLon);
  const se = projectPx(countryBounds, width, height, areaBounds.minLat, areaBounds.maxLon);
  const x = Math.max(0, Math.min(nw.x, se.x));
  const y = Math.max(0, Math.min(nw.y, se.y));
  const w = Math.min(width - x, Math.abs(se.x - nw.x));
  const h = Math.min(height - y, Math.abs(se.y - nw.y));
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

async function activeCountriesFromStrikeFeed(): Promise<GridActiveCountry[]> {
  const rows = await Promise.all(
    ACTIVE_COUNTRY_CANDIDATES.map(async (country) => {
      try {
        const result = await getCountryStrikesResult(country, 5000);
        const now = Date.now();
        return {
          country,
          strikes30s: strikeCountSince(result.strikes, now - 30_000),
          strikes5m: strikeCountSince(result.strikes, now - 5 * 60_000),
        };
      } catch {
        return { country, strikes30s: 0, strikes5m: 0 };
      }
    }),
  );
  return rows
    .filter((row) => row.strikes30s > 0 || row.strikes5m > 0)
    .sort((a, b) => (b.strikes30s - a.strikes30s) || (b.strikes5m - a.strikes5m))
    .slice(0, 10);
}

async function ensureGameSession() {
  const store = useSessionStore.getState();
  if (store.token) {
    try {
      await getProfile();
      return;
    } catch {
      // The saved token can belong to another backend DB (local reset/dev/prod).
    }
  }
  const session = await registerUsername();
  useSessionStore.getState().setGuest(session.username, session.token, session);
}

function PlayerCard({ match, model }: { match: GridMatchState | null; model?: string | null }) {
  const username = useSessionStore((s) => s.username);
  const country = useSessionStore((s) => s.country);
  const [elo, setElo] = useState(1200);

  useEffect(() => {
    getProfile()
      .then((profile) => setElo(profile.gridElo ?? 1200))
      .catch(() => undefined);
  }, [match?.eloDelta]);

  const shownElo = match?.player.eloAfter ?? match?.player.eloBefore ?? elo;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Player</div>
          <div className="mt-1 truncate text-lg font-bold text-white">{username || 'Guest player'}</div>
        </div>
        <span className="text-3xl leading-none">{flagEmoji(country || null)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/35">Grid Elo</div>
          <div className="font-display text-2xl font-black text-bolt">{shownElo}</div>
        </div>
        <div className="rounded-xl bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/35">Score</div>
          <div className="font-display text-2xl font-black text-electric">{match?.player.score ?? 0}</div>
        </div>
      </div>
      {model && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-black/15 px-3 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">Zoning model</span>
          <span className="font-mono text-[11px] font-bold text-cyan-200/80">{model}</span>
        </div>
      )}
    </div>
  );
}

function ControlPanel({
  country,
  match,
  model,
}: {
  country: GridActiveCountry;
  match: GridMatchState | null;
  model?: string | null;
}) {
  const name = countryName(country.country);
  return (
    <aside className="pointer-events-auto z-10 w-full max-w-[360px] space-y-4">
      <div className="glass rounded-3xl border border-cyan-200/15 bg-cyan-200/10 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/60">Selected country</div>
            <h1 className="font-display mt-1 text-2xl font-black text-white">{name}</h1>
          </div>
          <span className="text-4xl">{flagEmoji(country.country)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/35">Last 30s</div>
            <div className="font-display text-2xl font-black text-bolt">{country.strikes30s.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/35">Last 5 min</div>
            <div className="font-display text-2xl font-black text-white">{country.strikes5m.toLocaleString()}</div>
          </div>
        </div>
      </div>
      <PlayerCard match={match} model={model} />
    </aside>
  );
}

function GameLayersPanel({
  country,
  match,
  strikes,
  layers,
  onToggleLayer,
}: {
  country: GridActiveCountry;
  match: GridMatchState | null;
  strikes: CountryStrike[];
  layers: LayerState;
  onToggleLayer: (key: LayerKey) => void;
}) {
  const visibleStrikes = useMemo(() => {
    if (!match) return [];
    const startedAt = Date.parse(match.timing.startedAt);
    return strikes
      .filter((strike) => {
        const receivedAt = Date.parse(strike.received_at);
        return Number.isFinite(receivedAt) && receivedAt >= startedAt;
      })
      .slice(0, 3);
  }, [match, strikes]);

  return (
    <aside className="glass flex min-h-[620px] flex-col rounded-[2rem] p-4 shadow-2xl transition-all duration-700">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/50">Game layers</div>
        <h2 className="font-display mt-2 text-xl font-black text-white">{flagEmoji(country.country)} {countryName(country.country)}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          Tactical layers will appear here: live storm paths, multipliers, strike density and player zones.
        </p>
        <div className="mt-5 space-y-2">
          {LAYER_DEFS.map((layer) => {
            const active = layers[layer.key];
            return (
              <button
                key={layer.key}
                type="button"
                disabled={!layer.available}
                onClick={() => onToggleLayer(layer.key)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  layer.available
                    ? active
                      ? 'border-cyan-300/40 bg-cyan-300/10'
                      : 'border-white/10 bg-white/[0.045] hover:bg-white/[0.07]'
                    : 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-60'
                }`}
              >
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${active && layer.available ? 'text-white' : 'text-white/70'}`}>{layer.label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-white/35">{layer.hint}</span>
                </span>
                {layer.available ? (
                  <span
                    aria-hidden
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${active ? 'bg-cyan-400/80' : 'bg-white/15'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? 'left-[1.15rem]' : 'left-0.5'}`}
                    />
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/35">Soon</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Strike console</span>
          <span className="text-[10px] text-white/30">last 3</span>
        </div>
        <div className="grid grid-cols-[2.2rem_4.4rem_1fr] gap-2 border-b border-white/10 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">
          <span>Strike</span>
          <span>Time</span>
          <span>Loc</span>
        </div>
        <div className="mt-1 space-y-1">
          {visibleStrikes.length ? visibleStrikes.map((strike, index) => (
            <div key={`${strike.received_at}-${strike.lat}-${strike.lon}-${index}`} className="grid grid-cols-[2.2rem_4.4rem_1fr] gap-2 rounded-lg bg-white/[0.035] px-2 py-1.5 text-[11px] text-white/65">
              <span className="font-bold text-bolt">{visibleStrikes.length - index}</span>
              <span className="tabular-nums text-white/75">{formatMatchOffset(strike.received_at, match)}</span>
              <span className="truncate tabular-nums">{strike.lat.toFixed(3)}, {strike.lon.toFixed(3)}</span>
            </div>
          )) : (
            <div className="rounded-lg bg-white/[0.03] px-2 py-2 text-xs text-white/35">Waiting for match strikes...</div>
          )}
        </div>
      </div>
    </aside>
  );
}

// Alpha (0-255) -> RGBA color ramp for the strike-density heatmap. Built lazily
// on the client (no DOM needed) and cached; low density reads cool, high reads hot.
const HEAT_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: 0.0, c: [56, 189, 248] },
  { t: 0.35, c: [34, 197, 94] },
  { t: 0.6, c: [250, 204, 21] },
  { t: 0.82, c: [249, 115, 22] },
  { t: 1.0, c: [239, 68, 68] },
];
const HEAT_GRADIENT_CSS = `linear-gradient(to right, ${HEAT_STOPS.map(
  (stop) => `rgb(${stop.c[0]},${stop.c[1]},${stop.c[2]}) ${Math.round(stop.t * 100)}%`,
).join(', ')})`;
let heatRamp: Uint8ClampedArray | null = null;
function getHeatRamp() {
  if (heatRamp) return heatRamp;
  const ramp = new Uint8ClampedArray(256 * 4);
  for (let a = 0; a < 256; a += 1) {
    const t = a / 255;
    let lo = HEAT_STOPS[0];
    let hi = HEAT_STOPS[HEAT_STOPS.length - 1];
    for (let i = 0; i < HEAT_STOPS.length - 1; i += 1) {
      if (t >= HEAT_STOPS[i].t && t <= HEAT_STOPS[i + 1].t) {
        lo = HEAT_STOPS[i];
        hi = HEAT_STOPS[i + 1];
        break;
      }
    }
    const f = (t - lo.t) / Math.max(1e-6, hi.t - lo.t);
    ramp[a * 4] = lo.c[0] + (hi.c[0] - lo.c[0]) * f;
    ramp[a * 4 + 1] = lo.c[1] + (hi.c[1] - lo.c[1]) * f;
    ramp[a * 4 + 2] = lo.c[2] + (hi.c[2] - lo.c[2]) * f;
    ramp[a * 4 + 3] = Math.min(190, a * 1.7);
  }
  heatRamp = ramp;
  return ramp;
}

// Canvas heatmap of strike density. Accumulates soft alpha blobs (recent strikes
// weigh more), then recolors through the ramp. Kept translucent and layered below
// the grid so cells, selections and bolts stay readable on top of it.
function StrikeDensityLayer({
  strikes,
  bounds,
  width,
  height,
}: {
  strikes: CountryStrike[];
  bounds: Bounds;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Recompute every second so the heat keeps evolving during the round even when
  // the strike feed hasn't changed between polls (this is what stops it freezing
  // and then vanishing mid-game).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), DENSITY_REDRAW_MS);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    if (!strikes.length) return;

    const radius = Math.max(16, Math.min(w, h) * 0.055);
    const now = Date.now();
    for (const strike of strikes) {
      const receivedAt = Date.parse(strike.received_at);
      const age = Number.isFinite(receivedAt) ? now - receivedAt : Infinity;
      if (age >= DENSITY_WINDOW_MS) continue; // only the last DENSITY_WINDOW_MS
      const p = projectPx(bounds, w, h, strike.lat, strike.lon);
      if (p.x < -radius || p.x > w + radius || p.y < -radius || p.y > h + radius) continue;
      // Fade with age inside the window: freshest hottest, ~60s oldest faint.
      const weight = 0.12 + 0.28 * Math.max(0, 1 - age / DENSITY_WINDOW_MS);
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${weight})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const image = ctx.getImageData(0, 0, w, h);
    const data = image.data;
    const ramp = getHeatRamp();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (!a) continue;
      const idx = a * 4;
      data[i] = ramp[idx];
      data[i + 1] = ramp[idx + 1];
      data[i + 2] = ramp[idx + 2];
      data[i + 3] = ramp[idx + 3];
    }
    ctx.putImageData(image, 0, 0);
  }, [strikes, bounds, width, height, nowTick]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      style={{ opacity: 0.72, mixBlendMode: 'screen' }}
      aria-hidden
    />
  );
}

function SatelliteCountryMap({
  country,
  strikes,
  match,
  phase,
  area,
  activeAreaCount,
  secondsToScan,
  loading,
  onPlay,
  playerScore,
  botScore,
  now,
  gameStarted,
  selectedCell,
  botSelectedCell,
  onCellClick,
  onDominantCountry,
  onAspectChange,
  showDensity,
  showOpponentHeat,
  opponentHeat,
}: {
  country: GridActiveCountry;
  strikes: CountryStrike[];
  match: GridMatchState | null;
  phase: Phase;
  area: AreaCandidate | null;
  activeAreaCount: number;
  secondsToScan: number;
  loading: boolean;
  onPlay: () => void;
  playerScore: number;
  botScore: number;
  now: number;
  gameStarted: boolean;
  selectedCell: SelectedCell;
  botSelectedCell: SelectedCell;
  onCellClick: (cell: number) => void;
  onDominantCountry: (iso: string) => void;
  onAspectChange: (aspect: number) => void;
  showDensity: boolean;
  showOpponentHeat: boolean;
  opponentHeat: { cells: number[]; count: number } | null;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [preparedCountries, setPreparedCountries] = useState<PreparedCountry[]>([]);
  const polygons = useMemo(() => {
    const feature = features.find((item) => featureIso(item) === country.country.toUpperCase());
    return feature ? featurePolygons(feature) : [];
  }, [features, country.country]);
  const baseBounds = useMemo(() => countryBounds(country.country), [country.country]);
  const countryRender = useMemo(
    () => selectCountryRender(polygons, strikes, baseBounds),
    [polygons, strikes, baseBounds],
  );
  const zoomToArea = gameStarted && area;
  const bounds = zoomToArea ? area.bounds : countryRender.bounds;
  const aspect = size.width / Math.max(1, size.height);
  const tiles = useMemo(() => mapTiles(bounds, aspect), [bounds, aspect]);
  // Once a match exists, render the server's (adaptive) grid dimensions so the
  // cells the player clicks line up with the cells the server scores. Before a
  // match, use the fixed preview grid.
  const grid = useMemo(
    () => (match?.grid?.cols && match?.grid?.rows
      ? { cols: match.grid.cols, rows: match.grid.rows }
      : { cols: AREA_GRID_COLS, rows: AREA_GRID_ROWS }),
    [match?.grid?.cols, match?.grid?.rows],
  );
  // Once a match is running, the playable rectangle can span the ocean or two
  // countries — label it after whichever country owns the most grid cells.
  const dominant = useMemo(
    () => (gameStarted && area ? dominantCountryForArea(preparedCountries, bounds, grid) : null),
    [gameStarted, area, preparedCountries, bounds, grid],
  );
  const dominantPath = useMemo(
    () => (dominant ? pathForPolygons(dominant.renderPolygons, bounds, size.width, size.height) : ''),
    [dominant, bounds, size.width, size.height],
  );
  const displayIso = dominant?.iso ?? country.country;
  const preparingCounts = useMemo(
    () => (phase === 'preparing' ? cellStrikeCounts(strikes, bounds, grid, aspect, now) : []),
    [phase, strikes, bounds, grid, aspect, now],
  );
  const locatorRect = useMemo(
    () => (!gameStarted && area ? areaRectPx(countryRender.bounds, area.bounds, size.width, size.height) : null),
    [gameStarted, area, countryRender.bounds, size.width, size.height],
  );

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onDominantCountry(displayIso);
  }, [displayIso, onDominantCountry]);

  useEffect(() => {
    onAspectChange(aspect);
  }, [aspect, onAspectChange]);

  useEffect(() => {
    let alive = true;
    fetch('/geo/countries.geojson')
      .then((response) => response.json() as Promise<CountryFeatureCollection>)
      .then((data) => {
        if (!alive) return;
        setFeatures(data.features);
        setPreparedCountries(prepareCountries(data.features));
      })
      .catch(() => {
        if (!alive) return;
        setFeatures([]);
        setPreparedCountries([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const cells = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const index = row * grid.cols + col;
      cells.push({ row, col, index });
    }
  }

  return (
    <div ref={mapRef} className="relative h-full min-h-[620px] flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl">
      <div className="absolute inset-0 opacity-100 saturate-[1.18] contrast-[1.05]">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute select-none"
            style={{ left: `${tile.left}%`, top: `${tile.top}%`, width: `${tile.width}%`, height: `${tile.height}%` }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(250,204,21,0.06),transparent_42%),linear-gradient(to_bottom,rgba(2,6,23,0.02),rgba(2,6,23,0.36))]" />

      {gameStarted && showDensity && (
        <StrikeDensityLayer strikes={strikes} bounds={bounds} width={size.width} height={size.height} />
      )}

      {gameStarted && showDensity && (
        <div className="pointer-events-none absolute left-4 top-4 z-20 w-[168px] rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 shadow-2xl backdrop-blur-md">
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Strike density</div>
          <div className="mt-2 h-2 w-full rounded-full" style={{ background: HEAT_GRADIENT_CSS }} />
          <div className="mt-1 flex justify-between text-[9px] font-semibold text-white/45">
            <span>Low</span>
            <span>High</span>
          </div>
          <div className="mt-1 text-[9px] leading-tight text-white/35">Recent strikes per area</div>
        </div>
      )}

      {gameStarted && (() => {
        const msLeft = match ? Math.max(0, new Date(match.timing.endsAt).getTime() - now) : 0;
        const secondsLeft = Math.ceil(msLeft / 1000);
        const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
        const urgent = phase === 'active' && secondsLeft <= 10;
        return (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-2 shadow-2xl backdrop-blur-md">
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">You</div>
            <div className="font-display text-2xl font-black leading-none text-electric">{playerScore}</div>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">Time</div>
            <div className={`font-display text-2xl font-black leading-none tabular-nums ${urgent ? 'text-amber-300' : 'text-white'}`}>{clock}</div>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">Bot</div>
            <div className="font-display text-2xl font-black leading-none text-rose-300">{botScore}</div>
          </div>
        </div>
        );
      })()}

      {locatorRect && area && (
        <svg
          className="pointer-events-none absolute inset-0 z-[12] h-full w-full"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1={Math.min(size.width - 92, locatorRect.cx + 72)}
            y1={Math.max(46, locatorRect.cy - 70)}
            x2={locatorRect.cx}
            y2={locatorRect.cy}
            stroke="rgba(125,211,252,0.82)"
            strokeWidth="2"
            strokeDasharray="6 6"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={locatorRect.x}
            y={locatorRect.y}
            width={Math.max(18, locatorRect.w)}
            height={Math.max(18, locatorRect.h)}
            rx="8"
            fill="rgba(56,189,248,0.12)"
            stroke="rgba(125,211,252,0.95)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {locatorRect && area && (
        <div
          className="pointer-events-auto absolute z-[18] flex w-[260px] items-center justify-between gap-3 rounded-2xl border border-cyan-200/25 bg-slate-950/80 px-3 py-2 text-xs text-cyan-50 shadow-2xl backdrop-blur"
          style={{
            left: `${Math.min(size.width - 276, locatorRect.cx + 78)}px`,
            top: `${Math.max(18, locatorRect.cy - 94)}px`,
          }}
        >
          <div className="min-w-0">
            <div className="font-black uppercase tracking-[0.18em] text-cyan-100/55">Playable area</div>
            <div className="mt-0.5 font-bold">{activeAreaCount} active now</div>
          </div>
          <button
            type="button"
            onClick={onPlay}
            disabled={loading || !area}
            className="btn-glow shrink-0 rounded-xl px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Finding...' : 'Play this area'}
          </button>
        </div>
      )}

      {strikes.slice(0, 90).map((strike, index) => {
        const p = projectPx(bounds, size.width, size.height, strike.lat, strike.lon);
        if (p.x < 0 || p.x > size.width || p.y < 0 || p.y > size.height) return null;
        const visual = strikeVisual(strike, now);
        return (
          <span
            key={`${strike.received_at}-${index}`}
            className="grid-strike pointer-events-none absolute"
            style={{
              left: `${p.x}px`,
              top: `${p.y}px`,
              opacity: visual.opacity,
              transform: `translate(-50%, -50%) scale(${visual.scale})`,
              // Above the grid-cell overlay (z-12) so recent/older strikes are
              // visible on the grid, not just the brief fresh flashes.
              zIndex: visual.fresh ? 16 : 13,
            }}
          >
            {visual.fresh && <span className="grid-strike-bolt" />}
            {visual.fresh && <span className="grid-strike-ring grid-strike-ring-a" />}
            {visual.fresh && <span className="grid-strike-ring grid-strike-ring-b" />}
            <span className={`grid-strike-core ${visual.fresh ? 'grid-strike-core-fresh' : ''}`} />
          </span>
        );
      })}

      {gameStarted && (
        <svg
          className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <g className="pointer-events-auto">
            {cells.map((cell) => {
              const selected = selectedCell?.cell === cell.index && selectedCell.expiresAt > now;
              const botSelected = phase === 'active' && botSelectedCell?.cell === cell.index && botSelectedCell.expiresAt > now;
              const lockActive = Boolean(selectedCell && selectedCell.expiresAt > now);
              const disabled = phase !== 'active' || (lockActive && !selected);
              const countdown = selectedCell && selected ? Math.max(1, Math.ceil((selectedCell.expiresAt - now) / 1000)) : 0;
              return (
                <g key={cell.index}>
                  <rect
                    x={(cell.col / grid.cols) * size.width}
                    y={(cell.row / grid.rows) * size.height}
                    width={size.width / grid.cols}
                    height={size.height / grid.rows}
                    rx="0.8"
                    vectorEffect="non-scaling-stroke"
                    className={`transition ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                    fill={
                      selected
                        ? 'rgba(148,163,184,0.34)'
                        : botSelected
                          ? 'rgba(244,63,94,0.34)'
                          : 'rgba(148,163,184,0.16)'
                    }
                    stroke={
                      selected
                        ? 'rgba(226,232,240,0.72)'
                        : botSelected
                          ? 'rgba(251,113,133,0.9)'
                          : 'rgba(226,232,240,0.26)'
                    }
                    strokeWidth={selected || botSelected ? 0.28 : 0.16}
                    onClick={() => {
                      if (!disabled) onCellClick(cell.index);
                    }}
                  />
                  {selected && (
                    <text
                      x={((cell.col + 0.5) / grid.cols) * size.width}
                      y={((cell.row + 0.5) / grid.rows) * size.height}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none fill-white/70 text-[22px] font-black"
                    >
                      {countdown}
                    </text>
                  )}
                  {botSelected && !selected && (
                    <text
                      x={((cell.col + 0.5) / grid.cols) * size.width}
                      y={((cell.row + 0.5) / grid.rows) * size.height}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none text-[18px]"
                    >
                      🤖
                    </text>
                  )}
                  {phase === 'preparing' && (preparingCounts[cell.row]?.[cell.col] ?? 0) > 0 && (
                    <text
                      x={((cell.col + 0.5) / grid.cols) * size.width}
                      y={((cell.row + 0.54) / grid.rows) * size.height}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none fill-white text-[10px] font-black"
                    >
                      {preparingCounts[cell.row][cell.col]}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          {showOpponentHeat && opponentHeat && opponentHeat.cells.map((idx) => {
            const col = idx % grid.cols;
            const row = Math.floor(idx / grid.cols);
            return (
              <g key={`opponent-heat-${idx}`} className="pointer-events-none">
                <rect
                  x={(col / grid.cols) * size.width}
                  y={(row / grid.rows) * size.height}
                  width={size.width / grid.cols}
                  height={size.height / grid.rows}
                  rx="0.8"
                  fill="rgba(244,63,94,0.22)"
                  stroke="rgba(251,113,133,0.95)"
                  strokeWidth="0.42"
                  strokeDasharray="2.4 1.6"
                  vectorEffect="non-scaling-stroke"
                  className="grid-opponent-heat"
                />
                <text
                  x={((col + 0.5) / grid.cols) * size.width}
                  y={((row + 0.28) / grid.rows) * size.height}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-rose-100 text-[9px] font-black"
                >
                  🤖 ×{opponentHeat.count}
                </text>
              </g>
            );
          })}
          {dominantPath && (
            <path
              d={dominantPath}
              fill="none"
              stroke="rgba(125,211,252,0.92)"
              strokeWidth="0.28"
              vectorEffect="non-scaling-stroke"
              fillRule="evenodd"
              className="drop-shadow-[0_0_14px_rgba(56,189,248,0.65)]"
            />
          )}
        </svg>
      )}

      {phase === 'settled' && match && (
        <div className="pointer-events-none absolute inset-0 z-[30] grid place-items-center bg-black/25 backdrop-blur-[1px]">
          {(() => {
            const eloBefore = match.player.eloBefore;
            const eloDelta =
              match.eloDelta ??
              (match.player.eloAfter != null
                ? match.player.eloAfter - eloBefore
                : playerScore === botScore
                  ? 0
                  : playerScore > botScore
                    ? 12
                    : -12);
            const eloAfter = match.player.eloAfter ?? eloBefore + eloDelta;
            return (
          <div className={`rounded-[2rem] border px-8 py-7 text-center shadow-2xl ${
            playerScore > botScore
              ? 'border-emerald-300/30 bg-emerald-300/15'
              : 'border-rose-300/30 bg-rose-300/15'
          }`}>
            <div className="text-[11px] font-black uppercase tracking-[0.32em] text-white/55">Match finished</div>
            <div className="font-display mt-2 text-5xl font-black text-white">
              {playerScore > botScore ? 'You WON' : playerScore === botScore ? 'DRAW' : 'You LOST'}
            </div>
            <div className={`mt-3 text-2xl font-black ${eloDelta >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
              {eloDelta >= 0 ? '+' : ''}{eloDelta} Elo
            </div>
            <div className="mt-1 text-sm font-semibold text-white/70">
              Grid Elo <span className="font-black text-white">{eloAfter}</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-white/65">
              {playerScore} - {botScore}
            </div>
          </div>
            );
          })()}
        </div>
      )}

      {phase === 'preparing' && match && (
        <div className="pointer-events-none absolute inset-0 z-[30] grid place-items-center bg-black/20 backdrop-blur-[1px]">
          <div className="rounded-[2rem] border border-bolt/25 bg-slate-950/78 px-8 py-7 text-center shadow-2xl">
            <div className="text-[11px] font-black uppercase tracking-[0.32em] text-bolt/70">Prepare</div>
            <div className="font-display mt-2 text-7xl font-black text-bolt">{secondsUntil(match.timing.startedAt)}</div>
            <p className="mt-4 max-w-sm text-sm font-semibold leading-relaxed text-white/70">
              Pick a cell. It stays selected until you pick another, and every strike landing inside it adds to your score.
            </p>
          </div>
        </div>
      )}

      {phase === 'finding' && (
        <div className="pointer-events-none absolute inset-0 z-[30] grid place-items-center bg-black/20 backdrop-blur-[1px]">
          <div className="rounded-[2rem] border border-cyan-200/25 bg-slate-950/80 px-8 py-7 text-center shadow-2xl">
            <div className="text-[11px] font-black uppercase tracking-[0.32em] text-cyan-100/60">Area Game</div>
            <div className="font-display mt-2 text-4xl font-black text-white">Match being found...</div>
          </div>
        </div>
      )}

      {phase === 'selecting' && activeAreaCount === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[30] grid place-items-center bg-black/25 backdrop-blur-[1px]">
          <div className="glass rounded-[2rem] border border-white/15 bg-slate-950/70 px-8 py-7 text-center shadow-2xl backdrop-blur-md">
            <div className="text-[11px] font-black uppercase tracking-[0.32em] text-white/55">No game available</div>
            <div className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-white/70">
              No active storm has a playable zone right now.
            </div>
            <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">New search in</div>
            <div className="font-display text-5xl font-black tabular-nums text-bolt">{secondsToScan}</div>
          </div>
        </div>
      )}

      {phase === 'selecting' && activeAreaCount > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[30] -translate-x-1/2">
          <div className="glass rounded-full border border-white/12 bg-slate-950/60 px-4 py-1.5 shadow-xl backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">New search in </span>
            <span className="font-display text-sm font-black tabular-nums text-bolt">{secondsToScan}s</span>
          </div>
        </div>
      )}

    </div>
  );
}

export default function GridGameClient() {
  const [countries, setCountries] = useState<GridActiveCountry[]>(DEFAULT_COUNTRIES);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [countryIndex, setCountryIndex] = useState(0);
  const [areaIndex, setAreaIndex] = useState(0);
  const [match, setMatch] = useState<GridMatchState | null>(null);
  const [activeAreas, setActiveAreas] = useState<AreaCandidate[]>([]);
  const [nextScanAt, setNextScanAt] = useState(() => Date.now() + AREA_SCAN_MS);
  const areasCountryRef = useRef<string | null>(null);
  const strikesRef = useRef<CountryStrike[]>([]);
  const countedStrikeRef = useRef(new Set<string>());
  const [matchArea, setMatchArea] = useState<AreaCandidate | null>(null);
  const [strikes, setStrikes] = useState<CountryStrike[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [botSelectedCell, setBotSelectedCell] = useState<SelectedCell>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dominantIso, setDominantIso] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [botCellCounts, setBotCellCounts] = useState<number[]>([]);
  const lastStrikeRef = useRef<string | null>(null);
  const phase = loading && !match ? 'finding' : phaseFor(match);
  const gameStarted = phase !== 'selecting';
  const matchId = match?.matchId ?? null;
  const matchStatus = match?.status ?? null;
  const selectedCountry = countries[Math.min(countryIndex, countries.length - 1)] ?? DEFAULT_COUNTRIES[0];
  const safeAreaIndex = activeAreas.length ? areaIndex % activeAreas.length : 0;
  const selectedArea = activeAreas[safeAreaIndex] ?? null;
  // Once the backend returns the EAGZ-1 zone, render on ITS bounds so the grid
  // the player taps is exactly the grid the server scores.
  const displayedArea = gameStarted
    ? (match?.grid.bounds && matchArea
        ? { ...matchArea, bounds: { ...match.grid.bounds, label: matchArea.bounds.label } }
        : matchArea)
    : selectedArea;
  const handleDominantCountry = useCallback((iso: string) => setDominantIso(iso), []);
  const handleAspectChange = useCallback(() => {}, []);
  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }, []);
  const opponentHeat = useMemo(() => {
    let count = 0;
    let cells: number[] = [];
    botCellCounts.forEach((value, index) => {
      if (value > count) {
        count = value;
        cells = [index];
      } else if (value === count && value > 0) {
        cells.push(index);
      }
    });
    return count > 0 ? { cells, count } : null;
  }, [botCellCounts]);
  const displayCountry = useMemo(
    () => (gameStarted && dominantIso ? { ...selectedCountry, country: dominantIso } : selectedCountry),
    [gameStarted, dominantIso, selectedCountry],
  );

  strikesRef.current = strikes;

  const scanForAreas = useCallback(() => {
    const now = Date.now();
    const src = strikesRef.current;
    // Areas are country-scoped; drop the previous country's areas on switch so
    // stale/cross-country candidates (and colliding ids) never linger.
    const countryChanged = areasCountryRef.current !== selectedCountry.country;
    areasCountryRef.current = selectedCountry.country;
    if (countryChanged) setAreaIndex(0);
    const base = countryBounds(selectedCountry.country);
    const fresh = buildAreaCandidates(src, base, now, AREA_WINDOW_MS);
    const candidates = fresh.length ? fresh : buildAreaCandidates(src, base, now, AREA_FALLBACK_WINDOW_MS);
    setActiveAreas((current) => {
      const prior = countryChanged ? [] : current;
      const byId = new Map(prior.filter((area) => (area.expiresAt ?? 0) > now).map((area) => [area.id, area]));
      for (const candidate of candidates) {
        byId.set(candidate.id, { ...candidate, expiresAt: now + AREA_TTL_MS });
      }
      return [...byId.values()].sort((a, b) => b.score - a.score);
    });
    setNextScanAt(now + AREA_SCAN_MS);
  }, [selectedCountry.country]);

  // The real search: a STABLE 10s timer that reads the latest strikes via a ref.
  // It used to have `strikes` as a dependency, so every feed update (~2.5s) tore
  // the effect down and re-scanned immediately — which is why the countdown kept
  // snapping back to 10 and never hit 0. Now it fires exactly every AREA_SCAN_MS.
  useEffect(() => {
    if (phase !== 'selecting') return;
    scanForAreas();
    const timer = window.setInterval(scanForAreas, AREA_SCAN_MS);
    return () => window.clearInterval(timer);
  }, [phase, scanForAreas]);

  // One extra scan the moment the feed first has data (or on a country switch),
  // so areas appear without waiting up to 10s. The dep only flips on the
  // empty<->non-empty transition, so it never resets the countdown mid-cycle.
  const hasStrikes = strikes.length > 0;
  useEffect(() => {
    if (phase === 'selecting' && hasStrikes) scanForAreas();
  }, [phase, hasStrikes, scanForAreas]);

  useEffect(() => {
    const init = useSessionStore.getState().init;
    if (useSessionStore.getState().status === 'loading') init();
    ensureGameSession().catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      let supported: GridActiveCountry[] = [];
      try {
        const data = await getGridActiveCountries(10);
        supported = data.countries;
        if (alive && data.model) setActiveModel(data.model);
      } catch {
        supported = [];
      }
      if (!supported.some((country) => country.strikes30s > 0 || country.strikes5m > 0)) {
        supported = await activeCountriesFromStrikeFeed();
      }
      if (!alive) return;
      setCountries(supported.length ? supported : DEFAULT_COUNTRIES);
      setCountryIndex((index) => Math.min(index, Math.max(0, (supported.length || DEFAULT_COUNTRIES.length) - 1)));
    };
    load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  // Once a match is running, feed strikes from ITS zone bbox (the source the
  // server scores on) instead of the country-wide last-220 feed, which badly
  // under-feeds a small box in an active country. zoneKey is a stable string so
  // the effect only resets when the box actually changes.
  const zb = match?.grid?.bounds;
  const zoneKey = zb ? `${zb.minLat}|${zb.maxLat}|${zb.minLon}|${zb.maxLon}` : null;

  useEffect(() => {
    let alive = true;
    const bounds = zoneKey
      ? (() => {
          const [minLat, maxLat, minLon, maxLon] = zoneKey.split('|').map(Number);
          return { minLat, maxLat, minLon, maxLon };
        })()
      : null;
    const load = () => {
      const fetchStrikes = bounds
        ? getStrikesInBounds(bounds, 90, 800)
        : getCountryStrikesResult(selectedCountry.country, 220).then((d) => d.strikes);
      fetchStrikes
        .then((list) => {
          if (!alive) return;
          lastStrikeRef.current = list[0]?.received_at ?? null;
          setStrikes(list);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, phase === 'active' ? 900 : 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [selectedCountry.country, phase, zoneKey]);

  useEffect(() => {
    if (!match || match.status === 'settled') return;
    let alive = true;
    const poll = () => {
      getGridMatchState(match.matchId)
        .then((state) => {
          if (alive) setMatch(state);
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(poll, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [match, matchId, matchStatus]);

  // Bot score + bot cell come from the server. The player's score is scored
  // OPTIMISTICALLY on the client for instant feedback (effect below), using the
  // same equirectangular cell mapping + 3s window the server uses, so it agrees
  // with the server's authoritative value applied at settle.
  useEffect(() => {
    if (!match) return;
    setBotScore(match.opponent.score ?? 0);
    if (match.status === 'settled') setPlayerScore(match.player.score ?? 0);
    const bc = match.opponent.selectedCell ?? null;
    setBotSelectedCell(
      bc != null ? { cell: bc, startedAt: 0, expiresAt: Number.MAX_SAFE_INTEGER } : null,
    );
  }, [match]);

  // Instant player scoring: the moment a strike lands in the selected cell within
  // its 3s lock, bump the score locally (don't wait for the ~1s server poll).
  useEffect(() => {
    if (phase !== 'active' || !selectedCell || nowMs >= selectedCell.expiresAt) return;
    const b = match?.grid?.bounds;
    if (!b) return;
    const cols = match.grid.cols;
    const rows = match.grid.rows;
    const spanLon = b.maxLon - b.minLon;
    const spanLat = b.maxLat - b.minLat;
    if (spanLon <= 0 || spanLat <= 0) return;
    let gained = 0;
    for (const s of strikes) {
      const t = Date.parse(s.received_at);
      if (!Number.isFinite(t) || t < selectedCell.startedAt || t > selectedCell.expiresAt) continue;
      const key = `${s.received_at}:${s.lat}:${s.lon}`;
      if (countedStrikeRef.current.has(key)) continue;
      const rx = (s.lon - b.minLon) / spanLon;
      const ry = (b.maxLat - s.lat) / spanLat;
      if (rx < 0 || rx >= 1 || ry < 0 || ry >= 1) continue;
      const col = Math.min(cols - 1, Math.floor(rx * cols));
      const row = Math.min(rows - 1, Math.floor(ry * rows));
      if (row * cols + col !== selectedCell.cell) continue;
      countedStrikeRef.current.add(key);
      gained += 1;
    }
    if (gained) setPlayerScore((score) => score + gained);
  }, [nowMs, selectedCell, phase, strikes, match?.grid?.bounds, match?.grid?.cols, match?.grid?.rows]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!match || match.status === 'settled') return;
    if (Date.now() >= new Date(match.timing.endsAt).getTime()) {
      getGridMatchState(match.matchId).then(setMatch).catch(() => undefined);
    }
  }, [nowMs, match]);

  useEffect(() => {
    if (!selectedCell) return;
    const timeout = window.setTimeout(() => setSelectedCell(null), Math.max(0, selectedCell.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [selectedCell]);

  const selectPrevious = () => {
    if (phase !== 'selecting' || !activeAreas.length) return;
    setAreaIndex((index) => (index - 1 + activeAreas.length) % activeAreas.length);
    setSelectedCell(null);
  };

  const selectNext = () => {
    if (phase !== 'selecting' || !activeAreas.length) return;
    setAreaIndex((index) => (index + 1) % activeAreas.length);
    setSelectedCell(null);
  };

  const onPlay = useCallback(() => {
    if (!selectedArea) return;
    setLoading(true);
    setError(null);
    setMatch(null);
    setMatchArea(selectedArea);
    setSelectedCell(null);
    setBotSelectedCell(null);
    setPlayerScore(0);
    setBotScore(0);
    setDominantIso(null);
    setBotCellCounts([]);
    countedStrikeRef.current = new Set();
    window.setTimeout(() => {
      ensureGameSession()
        .then(() => startGridMatch(selectedCountry.country))
        .then((state) => setMatch(state))
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not start match'))
        .finally(() => setLoading(false));
    }, 650);
  }, [selectedArea, selectedCountry.country]);

  const onCellClick = useCallback((cell: number) => {
    if (!match || phase !== 'active') return;
    const now = Date.now();
    // Committed for a 3s lock (with the in-cell 3-2-1 countdown); optimistic
    // local highlight, the server records + scores it.
    setSelectedCell({ cell, startedAt: now, expiresAt: now + CELL_LOCK_MS });
    selectGridCell(match.matchId, cell).then(setMatch).catch(() => undefined);
  }, [match, phase]);

  return (
    <main className="min-h-svh overflow-hidden bg-storm px-4 pb-8 pt-24 text-white sm:px-6">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
            Back to globe
          </Link>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/50">Lightning Map Game</div>
          <div className="font-display text-2xl font-black">Grid Game</div>
        </div>
      </div>

      <div
        className={`mx-auto grid max-w-[1500px] gap-4 transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          gameStarted ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_360px]'
        }`}
      >
        {gameStarted && (
          <div className="animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]">
            <GameLayersPanel country={displayCountry} match={match} strikes={strikes} layers={layers} onToggleLayer={toggleLayer} />
          </div>
        )}

        <div className={`relative min-h-[620px] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${gameStarted ? 'lg:translate-x-2' : ''}`}>
          <SatelliteCountryMap
            country={selectedCountry}
            strikes={strikes}
            match={match}
            phase={phase}
            area={displayedArea}
            activeAreaCount={activeAreas.length}
            secondsToScan={Math.max(0, Math.min(10, Math.floor((nextScanAt - nowMs) / 1000)))}
            loading={loading}
            onPlay={onPlay}
            playerScore={playerScore}
            botScore={botScore}
            now={nowMs}
            gameStarted={gameStarted}
            selectedCell={selectedCell}
            botSelectedCell={botSelectedCell}
            onCellClick={onCellClick}
            onDominantCountry={handleDominantCountry}
            onAspectChange={handleAspectChange}
            showDensity={layers.density}
            showOpponentHeat={layers.opponent}
            opponentHeat={opponentHeat}
          />
          <button
            type="button"
            onClick={selectPrevious}
            disabled={phase !== 'selecting'}
            className={`absolute left-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35 ${gameStarted ? 'pointer-events-none opacity-0' : ''}`}
            aria-label="Previous active area"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={selectNext}
            disabled={phase !== 'selecting'}
            className={`absolute right-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35 ${gameStarted ? 'pointer-events-none opacity-0' : ''}`}
            aria-label="Next active area"
          >
            ›
          </button>
        </div>

        <div
          className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            gameStarted
              ? 'pointer-events-none fixed right-4 top-24 z-40 w-[360px] translate-x-[125%] opacity-0'
              : 'opacity-100'
          }`}
        >
          <ControlPanel
            country={selectedCountry}
            match={match}
            model={match?.model ?? activeModel}
          />
          {error && <p className="mt-3 text-center text-xs text-rose-300">{error}</p>}
        </div>
      </div>
    </main>
  );
}
