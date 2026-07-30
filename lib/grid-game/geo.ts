// lib/grid-game/geo.ts
// Shared, pure geometry for the Grid Game (map projection, grid/cell mapping,
// area detection, country polygons). Extracted verbatim from the v1 client so
// the v2 game renders on the EXACT same projection as the satellite tiles and
// scores strikes into the same cells. No React, no side effects — safe to unit
// test and reuse. v1 keeps its own inline copies; this module is used by v2.

import { COUNTRY_BOUNDS, WORLD_BOUNDS, type Bounds } from '@/lib/map/countryBounds';
import type { CountryStrike } from '@/lib/api';

export const TILE_SIZE = 256;
export const ESRI_TILE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

// Preview grid used before a match; a live match uses the server zone's cols/rows.
export const AREA_GRID_COLS = 10;
export const AREA_GRID_ROWS = 8;
export const AREA_WINDOW_MS = 30_000;
export const AREA_FALLBACK_WINDOW_MS = 2 * 60_000;
export const AREA_MIN_TRIGGERED_RATIO = 0.5;
export const AREA_MIN_TRIGGERED_CELLS = 3;
export const AREA_MIN_STRIKES = 3;

export type LonLat = [number, number];
export type CountryPolygon = LonLat[][];
export type Grid = { cols: number; rows: number };
export type PreparedPolygon = { polygon: CountryPolygon; bounds: Bounds; area: number; centerLon: number };
export type PreparedCountry = { iso: string; polygons: PreparedPolygon[]; minLat: number; maxLat: number };
export type AreaCandidate = {
  id: string;
  bounds: Bounds;
  strikeCount: number;
  triggeredCells: number;
  boxCells: number;
  triggeredRatio: number;
  score: number;
  expiresAt?: number;
};

export interface CountryFeature {
  type: 'Feature';
  properties?: Record<string, string | number | null | undefined>;
  geometry?: { type: 'Polygon' | 'MultiPolygon'; coordinates: LonLat[][] | LonLat[][][] };
}
export interface CountryFeatureCollection {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

export function clampLat(lat: number) {
  return Math.max(-85, Math.min(85, lat));
}

export function paddedBounds(bounds: Bounds): Bounds {
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

export function normalizeLonToBounds(lon: number, bounds: Bounds) {
  const center = (bounds.minLon + bounds.maxLon) / 2;
  let next = lon;
  while (next - center > 180) next -= 360;
  while (next - center < -180) next += 360;
  return next;
}

export function worldPoint(lat: number, lon: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const sin = Math.sin((clampLat(lat) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function viewport(bounds: Bounds, aspect: number) {
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

export function projectPx(bounds: Bounds, width: number, height: number, lat: number, lon: number) {
  const view = viewport(bounds, width / Math.max(1, height));
  const p = worldPoint(lat, normalizeLonToBounds(lon, bounds), view.zoom);
  return { x: ((p.x - view.left) / view.width) * width, y: ((p.y - view.top) / view.height) * height };
}

// Equirectangular (linear lat/lon) projection — MUST be used for anything that
// has to line up with the grid cells (drawn at linear col/row fractions) and the
// scoring (server + client both map strikes to cells equirectangularly).
export function projectEqui(bounds: Bounds, width: number, height: number, lat: number, lon: number) {
  const spanLon = Math.max(1e-6, bounds.maxLon - bounds.minLon);
  const spanLat = Math.max(1e-6, bounds.maxLat - bounds.minLat);
  const nlon = normalizeLonToBounds(lon, bounds);
  return { x: ((nlon - bounds.minLon) / spanLon) * width, y: ((bounds.maxLat - lat) / spanLat) * height };
}

export function pathForPolygons(polygons: CountryPolygon[], bounds: Bounds, width: number, height: number) {
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

export function featureIso(feature: CountryFeature) {
  const props = feature.properties ?? {};
  const raw = props.ISO_A2_EH ?? props.ISO_A2 ?? props.iso_a2;
  return typeof raw === 'string' ? raw.toUpperCase() : '';
}

export function featurePolygons(feature: CountryFeature): CountryPolygon[] {
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

export function pointInPolygon(lon: number, lat: number, prepared: PreparedPolygon) {
  const normalizedLon = normalizeLonToBounds(lon, prepared.bounds);
  const [outer, ...holes] = prepared.polygon;
  if (!outer || !pointInRing(normalizedLon, lat, outer)) return false;
  return !holes.some((hole) => pointInRing(normalizedLon, lat, hole));
}

export function preparePolygons(polygons: CountryPolygon[], label: string): PreparedPolygon[] {
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

export function selectCountryRender(polygons: CountryPolygon[], strikes: CountryStrike[], fallback: Bounds) {
  const prepared = preparePolygons(polygons, fallback.label);
  if (!prepared.length) return { polygons: [] as CountryPolygon[], bounds: fallback };
  let best = prepared[0];
  let bestScore = -1;
  for (const candidate of prepared) {
    const score = strikes.reduce(
      (count, strike) => (pointInPolygon(strike.lon, strike.lat, candidate) ? count + 1 : count),
      0,
    );
    if (score > bestScore || (score === bestScore && candidate.area > best.area)) {
      best = candidate;
      bestScore = score;
    }
  }
  return { polygons: [best.polygon], bounds: best.bounds };
}

export function prepareCountries(features: CountryFeature[]): PreparedCountry[] {
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

export function cellCenter(bounds: Bounds, grid: Grid, row: number, col: number): LonLat {
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

export function dominantCountryForArea(
  countries: PreparedCountry[],
  bounds: Bounds,
  grid: Grid,
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

export function mapTiles(bounds: Bounds, aspect: number) {
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

export interface RadarFrame {
  host: string; // e.g. https://tilecache.rainviewer.com
  path: string; // e.g. /v2/radar/<id>
  size: number; // 256 | 512
  color: number; // RainViewer colour scheme id
  options: string; // "{smooth}_{snow}", e.g. "0_0"
}

// RainViewer's radar tiles only exist up to zoom 7; requesting higher returns a
// "Zoom level not supported" placeholder. Zone views zoom in further, so we render
// radar at min(viewZoom, 7) and scale those tiles into the current viewport.
export const MAX_RADAR_ZOOM = 7;

/**
 * Radar reflectivity tiles for a frame, positioned to overlay the satellite view.
 * URL pattern: {host}{path}/{size}/{z}/{x}/{y}/{color}/{options}.png
 * When the view zoom exceeds the radar's max zoom, we use the radar's max zoom and
 * scale each tile up into the viewport (a target tile spans `worldTile` px in the
 * view's world-pixel space). Tile images load straight from the radar host; only
 * the frame index comes through our backend.
 */
export function radarTiles(bounds: Bounds, aspect: number, frame: RadarFrame) {
  const view = viewport(bounds, aspect);
  const zoom = Math.min(view.zoom, MAX_RADAR_ZOOM);
  const scale = 2 ** (view.zoom - zoom); // view-zoom px per radar-tile px
  const worldTile = TILE_SIZE * scale; // a radar tile's size in the view's world px
  const tileCount = 2 ** zoom;
  const minX = Math.floor(view.left / worldTile);
  const maxX = Math.floor((view.left + view.width) / worldTile);
  const minY = Math.floor(view.top / worldTile);
  const maxY = Math.floor((view.top + view.height) / worldTile);
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      if (y < 0 || y >= tileCount) continue; // no radar tiles past the poles
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${frame.path}-${zoom}-${x}-${y}`,
        src: `${frame.host}${frame.path}/${frame.size}/${zoom}/${wrappedX}/${y}/${frame.color}/${frame.options}.png`,
        left: ((x * worldTile - view.left) / view.width) * 100,
        top: ((y * worldTile - view.top) / view.height) * 100,
        width: (worldTile / view.width) * 100,
        height: (worldTile / view.height) * 100,
      });
    }
  }
  return tiles;
}

export function strikeVisual(strike: CountryStrike, now: number) {
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

export function countryBounds(iso: string): Bounds {
  return COUNTRY_BOUNDS[iso.toLowerCase()] ?? { ...WORLD_BOUNDS, label: iso.toUpperCase() };
}

export function countryName(iso: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso.toUpperCase()) ?? iso.toUpperCase();
  } catch {
    return iso.toUpperCase();
  }
}

export function strikeCountSince(strikes: CountryStrike[], sinceMs: number) {
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

export function buildAreaCandidates(
  strikes: CountryStrike[],
  bounds: Bounds,
  now: number,
  windowMs = AREA_WINDOW_MS,
): AreaCandidate[] {
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

export function areaRectPx(base: Bounds, areaBounds: Bounds, width: number, height: number) {
  const nw = projectPx(base, width, height, areaBounds.maxLat, areaBounds.minLon);
  const se = projectPx(base, width, height, areaBounds.minLat, areaBounds.maxLon);
  const x = Math.max(0, Math.min(nw.x, se.x));
  const y = Math.max(0, Math.min(nw.y, se.y));
  const w = Math.min(width - x, Math.abs(se.x - nw.x));
  const h = Math.min(height - y, Math.abs(se.y - nw.y));
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

// Equirectangular cell index for a strike (matches the server's cell_for_point).
// Used by both pricing (bin strikes per cell) and scoring (resolve a staked cell).
export function cellForStrikeEqui(lat: number, lon: number, bounds: Bounds, grid: Grid): number | null {
  const spanLon = bounds.maxLon - bounds.minLon;
  const spanLat = bounds.maxLat - bounds.minLat;
  if (spanLon <= 0 || spanLat <= 0) return null;
  const rx = (normalizeLonToBounds(lon, bounds) - bounds.minLon) / spanLon;
  const ry = (bounds.maxLat - lat) / spanLat;
  if (rx < 0 || rx >= 1 || ry < 0 || ry >= 1) return null;
  const col = Math.min(grid.cols - 1, Math.floor(rx * grid.cols));
  const row = Math.min(grid.rows - 1, Math.floor(ry * grid.rows));
  return row * grid.cols + col;
}
