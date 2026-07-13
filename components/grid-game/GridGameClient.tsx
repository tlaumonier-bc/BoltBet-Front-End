'use client';

/* eslint-disable @next/next/no-img-element -- raw map tiles are external tile images, not app content images. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import GameAccount from '@/components/game/GameAccount';
import {
  clickGridMatchCell,
  getCountryStrikesResult,
  getGridActiveCountries,
  getGridMatchState,
  getProfile,
  registerUsername,
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
const AREA_MIN_TRIGGERED_RATIO = 0.3;
const AREA_MIN_TRIGGERED_CELLS = 3;
const AREA_MIN_STRIKES = 3;

type Phase = 'selecting' | 'finding' | 'preparing' | 'active' | 'settled';
type PlayScope = 'country' | 'area';
type LonLat = [number, number];
type CountryPolygon = LonLat[][];
type OpponentPlay = { id: string; cell: number; at: number };
type PreparedPolygon = { polygon: CountryPolygon; bounds: Bounds; area: number; centerLon: number };
type AreaCandidate = {
  id: string;
  bounds: Bounds;
  strikeCount: number;
  triggeredCells: number;
  boxCells: number;
  triggeredRatio: number;
  score: number;
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
    opacity: fresh ? 0.35 + life * 0.65 : recent ? 0.35 : 0.16,
    scale: fresh ? 0.75 + life * 0.55 : 0.7,
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

function opponentCellFor(matchId: string, score: number, grid: { cols: number; rows: number }) {
  let hash = 2166136261;
  const key = `${matchId}:${score}`;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % (grid.cols * grid.rows);
}

function phaseFor(match: GridMatchState | null): Phase {
  if (!match) return 'selecting';
  if (match.status === 'settled') return 'settled';
  if (Date.now() < new Date(match.timing.startedAt).getTime()) return 'preparing';
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

function PlayerCard({ match }: { match: GridMatchState | null }) {
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
    </div>
  );
}

function GameScopeSwitch({ value, onChange, disabled }: { value: PlayScope; onChange: (value: PlayScope) => void; disabled: boolean }) {
  return (
    <div className="flex items-center rounded-full border border-white/10 bg-white/[0.045] p-1 text-xs font-black text-white/50">
      <button
        type="button"
        onClick={() => onChange('country')}
        disabled={disabled}
        className={`rounded-full px-3.5 py-2 transition disabled:cursor-not-allowed ${
          value === 'country'
            ? 'bg-bolt text-slate-950 shadow-[0_0_24px_rgba(250,204,21,0.18)]'
            : 'hover:bg-white/8 hover:text-white'
        }`}
      >
        Countries
      </button>
      <button
        type="button"
        onClick={() => onChange('area')}
        disabled={disabled}
        title="Play inside the most active storm area"
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 transition disabled:cursor-not-allowed ${
          value === 'area'
            ? 'bg-cyan-200/15 text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.14)]'
            : 'hover:bg-white/8 hover:text-white'
        }`}
      >
        <span>Areas</span>
        <span className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-cyan-100/70">
          Beta
        </span>
      </button>
    </div>
  );
}

function ControlPanel({
  country,
  match,
  phase,
  loading,
  error,
  playScope,
  area,
  onPlay,
}: {
  country: GridActiveCountry;
  match: GridMatchState | null;
  phase: Phase;
  loading: boolean;
  error: string | null;
  playScope: PlayScope;
  area: AreaCandidate | null;
  onPlay: () => void;
}) {
  const name = countryName(country.country);
  const eloDelta = match?.eloDelta ?? null;
  const areaReady = playScope === 'country' || Boolean(area);
  const playDisabled = loading || country.strikes30s <= 0 || !areaReady;
  return (
    <aside className="glass pointer-events-auto z-10 w-full max-w-[360px] rounded-3xl p-4 shadow-2xl">
      <GameAccount variant="inline" />
      <div className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-200/10 p-4">
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

      {phase === 'selecting' && playScope === 'area' && (
        <div className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-200/10 p-3 text-xs leading-relaxed text-cyan-50/75">
          {area
            ? `${area.strikeCount} strikes · ${Math.round(area.triggeredRatio * 100)}% of cells active in the selected storm area`
            : 'Waiting for a storm area where at least 30% of local cells were triggered recently.'}
        </div>
      )}

      <div className="mt-4">
        <PlayerCard match={match} />
      </div>

      {match && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white/70">You</span>
            <span className="font-display text-xl font-black text-electric">{match.player.score}</span>
          </div>
          <div className="my-2 h-px bg-white/10" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white/70">{match.opponent.username}</span>
            <span className="font-display text-xl font-black text-rose-300">{match.opponent.score}</span>
          </div>
          {phase === 'settled' && (
            <div className={`mt-3 rounded-xl px-3 py-2 text-center text-sm font-bold ${eloDelta && eloDelta > 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
              {match.player.score > match.opponent.score ? 'Victory' : match.player.score === match.opponent.score ? 'Draw' : 'Defeat'}
              {eloDelta !== null && ` · ${eloDelta >= 0 ? '+' : ''}${eloDelta} Elo`}
            </div>
          )}
        </div>
      )}

      {phase === 'selecting' && (
        <button
          type="button"
          onClick={onPlay}
          disabled={playDisabled}
          className="btn-glow mt-4 w-full rounded-2xl px-5 py-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? 'Finding match...'
            : country.strikes30s <= 0
              ? 'Waiting for live strikes'
              : playScope === 'area'
                ? area ? 'Play this area' : 'Waiting for active area'
                : 'Play on this country'}
        </button>
      )}
      {phase === 'finding' && (
        <div className="mt-4 rounded-2xl border border-bolt/20 bg-bolt/10 p-4 text-center text-sm font-bold text-bolt">
          Match being found...
        </div>
      )}
      {phase === 'preparing' && match && (
        <div className="mt-4 rounded-2xl border border-bolt/20 bg-bolt/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-bolt/70">Get ready</div>
          <div className="font-display text-5xl font-black text-bolt">{secondsUntil(match.timing.startedAt)}</div>
        </div>
      )}
      {phase === 'active' && match && (
        <div className="mt-4 rounded-2xl border border-electric/20 bg-electric/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-electric/70">Time left</div>
          <div className="font-display text-5xl font-black text-electric">{secondsUntil(match.timing.endsAt)}</div>
        </div>
      )}
      {phase === 'settled' && (
        <button
          type="button"
          onClick={onPlay}
          disabled={loading || country.strikes30s <= 0}
          className="mt-4 w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-base font-black text-white transition hover:bg-white/15 disabled:opacity-50"
        >
          Play again
        </button>
      )}
      {error && <p className="mt-3 text-center text-xs text-rose-300">{error}</p>}
    </aside>
  );
}

function GameLayersPanel({
  country,
  match,
  strikes,
}: {
  country: GridActiveCountry;
  match: GridMatchState | null;
  strikes: CountryStrike[];
}) {
  const visibleStrikes = useMemo(() => {
    if (!match) return [];
    const startedAt = Date.parse(match.timing.startedAt);
    return strikes
      .filter((strike) => {
        const receivedAt = Date.parse(strike.received_at);
        return Number.isFinite(receivedAt) && receivedAt >= startedAt;
      })
      .slice(0, 5);
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
          {['Strike density', 'Multiplier zones', 'Opponent heat', 'Storm movement'].map((label) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3">
              <span className="text-sm font-semibold text-white/70">{label}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/35">Soon</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Strike console</span>
          <span className="text-[10px] text-white/30">last 5</span>
        </div>
        <div className="grid grid-cols-[2.2rem_4.4rem_1fr] gap-2 border-b border-white/10 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">
          <span>Strike</span>
          <span>Time</span>
          <span>Loc</span>
        </div>
        <div className="mt-1 space-y-1">
          {visibleStrikes.length ? visibleStrikes.map((strike, index) => (
            <div key={`${strike.received_at}-${strike.lat}-${strike.lon}`} className="grid grid-cols-[2.2rem_4.4rem_1fr] gap-2 rounded-lg bg-white/[0.035] px-2 py-1.5 text-[11px] text-white/65">
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

function GameBottomHud({ match, phase, country }: { match: GridMatchState | null; phase: Phase; country: GridActiveCountry }) {
  const timeLabel = match
    ? phase === 'preparing'
      ? `${secondsUntil(match.timing.startedAt)}s`
      : phase === 'active'
        ? `${secondsUntil(match.timing.endsAt)}s`
        : 'Done'
    : '...';
  return (
    <div className="pointer-events-auto mx-auto mt-3 max-w-[620px] rounded-3xl border border-white/10 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-xl transition-all duration-700">
      <div className="grid grid-cols-3 items-center gap-3 text-center">
        <div className="rounded-2xl bg-white/[0.055] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/35">You</div>
          <div className="font-display text-2xl font-black text-electric">{match?.player.score ?? 0}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-bolt/70">
            {phase === 'preparing' ? 'Prepare' : phase === 'active' ? 'Live round' : phase === 'settled' ? 'Result' : 'Finding'}
          </div>
          <div className="font-display mt-1 text-3xl font-black text-white">{timeLabel}</div>
          <div className="mt-1 text-[11px] text-white/45">{country.strikes30s.toLocaleString()} strikes · last 30s</div>
        </div>
        <div className="rounded-2xl bg-white/[0.055] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/35">Bot</div>
          <div className="font-display text-2xl font-black text-rose-300">{match?.opponent.score ?? 0}</div>
        </div>
      </div>
      {phase === 'preparing' && (
        <p className="mt-3 text-center text-xs leading-relaxed text-white/55">
          Click cells inside the country to score. Each cell is x1 for now, and your selected zone resets when a new strike appears.
        </p>
      )}
    </div>
  );
}

function SatelliteCountryMap({
  country,
  strikes,
  match,
  phase,
  playScope,
  area,
  now,
  gameStarted,
  opponentPlays,
  selectedCell,
  vanishedCell,
  onCellClick,
}: {
  country: GridActiveCountry;
  strikes: CountryStrike[];
  match: GridMatchState | null;
  phase: Phase;
  playScope: PlayScope;
  area: AreaCandidate | null;
  now: number;
  gameStarted: boolean;
  opponentPlays: OpponentPlay[];
  selectedCell: number | null;
  vanishedCell: number | null;
  onCellClick: (cell: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [polygons, setPolygons] = useState<CountryPolygon[]>([]);
  const baseBounds = useMemo(() => countryBounds(country.country), [country.country]);
  const countryRender = useMemo(
    () => selectCountryRender(polygons, strikes, baseBounds),
    [polygons, strikes, baseBounds],
  );
  const bounds = playScope === 'area' && area ? area.bounds : countryRender.bounds;
  const aspect = size.width / Math.max(1, size.height);
  const tiles = useMemo(() => mapTiles(bounds, aspect), [bounds, aspect]);
  const countryPath = useMemo(
    () => pathForPolygons(countryRender.polygons, bounds, size.width, size.height),
    [countryRender.polygons, bounds, size.width, size.height],
  );
  const grid = playScope === 'area' ? { cols: AREA_GRID_COLS, rows: AREA_GRID_ROWS } : match?.grid ?? { cols: 8, rows: 10 };
  const clipId = `grid-country-clip-${country.country.toLowerCase()}`;
  const outsideMaskId = `grid-country-mask-${country.country.toLowerCase()}`;

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
    let alive = true;
    fetch('/geo/countries.geojson')
      .then((response) => response.json() as Promise<CountryFeatureCollection>)
      .then((data) => {
        if (!alive) return;
        const feature = data.features.find((item) => featureIso(item) === country.country.toUpperCase());
        setPolygons(feature ? featurePolygons(feature) : []);
      })
      .catch(() => {
        if (alive) setPolygons([]);
      });
    return () => {
      alive = false;
    };
  }, [country.country]);

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
              zIndex: visual.fresh ? 14 : 6,
            }}
          >
            {visual.fresh && <span className="grid-strike-bolt" />}
            {visual.fresh && <span className="grid-strike-ring grid-strike-ring-a" />}
            {visual.fresh && <span className="grid-strike-ring grid-strike-ring-b" />}
            <span className={`grid-strike-core ${visual.fresh ? 'grid-strike-core-fresh' : ''}`} />
          </span>
        );
      })}

      {gameStarted && countryPath && (
        <svg
          className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <clipPath id={clipId}>
              <path d={countryPath} fillRule="evenodd" clipRule="evenodd" />
            </clipPath>
            <mask id={outsideMaskId}>
              <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
              <path d={countryPath} fill="black" fillRule="evenodd" />
            </mask>
          </defs>
          <rect x="0" y="0" width={size.width} height={size.height} fill="rgba(0,0,0,0.84)" mask={`url(#${outsideMaskId})`} />
          <g clipPath={`url(#${clipId})`} className="pointer-events-auto">
            {cells.map((cell) => {
              const disabled = phase !== 'active' || vanishedCell === cell.index;
              const selected = selectedCell === cell.index;
              const vanished = vanishedCell === cell.index;
              return (
                <rect
                  key={cell.index}
                  x={(cell.col / grid.cols) * size.width}
                  y={(cell.row / grid.rows) * size.height}
                  width={size.width / grid.cols}
                  height={size.height / grid.rows}
                  rx="0.8"
                  vectorEffect="non-scaling-stroke"
                  className={`transition ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                  fill={selected ? 'rgba(250,204,21,0.26)' : vanished ? 'rgba(0,0,0,0.5)' : 'rgba(148,163,184,0.16)'}
                  stroke={selected ? 'rgba(250,204,21,0.65)' : 'rgba(226,232,240,0.26)'}
                  strokeWidth={selected ? 0.28 : 0.16}
                  opacity={vanished ? 0.25 : 1}
                  onClick={() => {
                    if (!disabled) onCellClick(cell.index);
                  }}
                />
              );
            })}
            {opponentPlays.slice(-12).map((play) => {
              const col = play.cell % grid.cols;
              const row = Math.floor(play.cell / grid.cols);
              return (
                <rect
                  key={play.id}
                  x={(col / grid.cols) * size.width}
                  y={(row / grid.rows) * size.height}
                  width={size.width / grid.cols}
                  height={size.height / grid.rows}
                  rx="0.8"
                  vectorEffect="non-scaling-stroke"
                  fill="rgba(244,63,94,0.24)"
                  stroke="rgba(251,113,133,0.75)"
                  strokeWidth="0.3"
                  className="animate-pulse"
                />
              );
            })}
          </g>
          <path
            d={countryPath}
            fill="rgba(56,189,248,0.045)"
            stroke="rgba(125,211,252,0.92)"
            strokeWidth="0.28"
            vectorEffect="non-scaling-stroke"
            fillRule="evenodd"
            className="drop-shadow-[0_0_14px_rgba(56,189,248,0.65)]"
          />
        </svg>
      )}

      {phase === 'selecting' && (
        <div className="absolute inset-x-6 bottom-6 rounded-3xl border border-white/10 bg-black/45 p-5 backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
            {playScope === 'area' ? 'Area Game · Beta' : 'Grid Game'}
          </div>
          <div className="mt-1 text-lg font-bold text-white sm:text-xl">
            {playScope === 'area'
              ? area
                ? 'A hot storm area is ready. Play the smaller grid.'
                : 'Searching for a storm area with enough active cells.'
              : 'Pick the active country you want and start playing.'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GridGameClient() {
  const [countries, setCountries] = useState<GridActiveCountry[]>(DEFAULT_COUNTRIES);
  const [countryIndex, setCountryIndex] = useState(0);
  const [playScope, setPlayScope] = useState<PlayScope>('country');
  const [match, setMatch] = useState<GridMatchState | null>(null);
  const [strikes, setStrikes] = useState<CountryStrike[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [vanishedCell, setVanishedCell] = useState<number | null>(null);
  const [opponentPlays, setOpponentPlays] = useState<OpponentPlay[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastStrikeRef = useRef<string | null>(null);
  const lastOpponentScoreRef = useRef(0);
  const phase = loading && !match ? 'finding' : phaseFor(match);
  const gameStarted = phase !== 'selecting';
  const matchId = match?.matchId ?? null;
  const matchStatus = match?.status ?? null;
  const selectedCountry = countries[Math.min(countryIndex, countries.length - 1)] ?? DEFAULT_COUNTRIES[0];
  const selectedArea = useMemo(() => {
    if (playScope !== 'area') return null;
    const base = countryBounds(selectedCountry.country);
    return (
      buildAreaCandidates(strikes, base, nowMs, AREA_WINDOW_MS)[0] ??
      buildAreaCandidates(strikes, base, nowMs, AREA_FALLBACK_WINDOW_MS)[0] ??
      null
    );
  }, [playScope, selectedCountry.country, strikes, nowMs]);

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

  useEffect(() => {
    let alive = true;
    const load = () => {
      getCountryStrikesResult(selectedCountry.country, 220)
        .then((data) => {
          if (!alive) return;
          const latest = data.strikes[0]?.received_at ?? null;
          if (latest && lastStrikeRef.current && latest !== lastStrikeRef.current) {
            setVanishedCell(selectedCell);
            setSelectedCell(null);
          }
          lastStrikeRef.current = latest;
          setStrikes(data.strikes);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, phase === 'active' ? 900 : 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [selectedCountry.country, phase, selectedCell]);

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

  useEffect(() => {
    if (!match) {
      lastOpponentScoreRef.current = 0;
      return;
    }
    const previous = lastOpponentScoreRef.current;
    const next = match.opponent.score;
    if (next <= previous) {
      lastOpponentScoreRef.current = next;
      return;
    }
    const plays: OpponentPlay[] = [];
    for (let score = previous + 1; score <= next; score += 1) {
      plays.push({
        id: `${match.matchId}:${score}`,
        cell: opponentCellFor(match.matchId, score, match.grid),
        at: Date.now(),
      });
    }
    lastOpponentScoreRef.current = next;
    setOpponentPlays((current) => [...current, ...plays].slice(-30));
  }, [match]);

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

  const selectPrevious = () => {
    if (phase !== 'selecting') return;
    setCountryIndex((index) => (index - 1 + countries.length) % countries.length);
    setSelectedCell(null);
    setVanishedCell(null);
  };

  const selectNext = () => {
    if (phase !== 'selecting') return;
    setCountryIndex((index) => (index + 1) % countries.length);
    setSelectedCell(null);
    setVanishedCell(null);
  };

  const onPlay = useCallback(() => {
    if (playScope === 'area' && !selectedArea) return;
    setLoading(true);
    setError(null);
    setMatch(null);
    setSelectedCell(null);
    setVanishedCell(null);
    setOpponentPlays([]);
    lastOpponentScoreRef.current = 0;
    window.setTimeout(() => {
      ensureGameSession()
        .then(() => startGridMatch(selectedCountry.country))
        .then((state) => setMatch(state))
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not start match'))
        .finally(() => setLoading(false));
    }, 650);
  }, [playScope, selectedArea, selectedCountry.country]);

  const onCellClick = useCallback((cell: number) => {
    if (!match || phase !== 'active') return;
    setSelectedCell(cell);
    setVanishedCell(null);
    clickGridMatchCell(match.matchId, cell)
      .then((state) => setMatch(state))
      .catch(() => setSelectedCell(null));
  }, [match, phase]);

  const onScopeChange = useCallback((next: PlayScope) => {
    if (phase !== 'selecting') return;
    setPlayScope(next);
    setSelectedCell(null);
    setVanishedCell(null);
  }, [phase]);

  return (
    <main className="min-h-svh overflow-hidden bg-storm px-4 pb-8 pt-24 text-white sm:px-6">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
            Back to globe
          </Link>
          {!gameStarted && (
            <GameScopeSwitch
              value={playScope}
              onChange={onScopeChange}
              disabled={phase !== 'selecting'}
            />
          )}
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
            <GameLayersPanel country={selectedCountry} match={match} strikes={strikes} />
          </div>
        )}

        <div className={`relative min-h-[620px] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${gameStarted ? 'lg:translate-x-2' : ''}`}>
          <SatelliteCountryMap
            country={selectedCountry}
            strikes={strikes}
            match={match}
            phase={phase}
            playScope={playScope}
            area={selectedArea}
            now={nowMs}
            gameStarted={gameStarted}
            opponentPlays={opponentPlays}
            selectedCell={selectedCell}
            vanishedCell={vanishedCell}
            onCellClick={onCellClick}
          />
          {gameStarted && <GameBottomHud match={match} phase={phase} country={selectedCountry} />}
          <button
            type="button"
            onClick={selectPrevious}
            disabled={phase !== 'selecting'}
            className={`absolute left-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35 ${gameStarted ? 'pointer-events-none opacity-0' : ''}`}
            aria-label="Previous active country"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={selectNext}
            disabled={phase !== 'selecting'}
            className={`absolute right-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35 ${gameStarted ? 'pointer-events-none opacity-0' : ''}`}
            aria-label="Next active country"
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
            phase={phase}
            loading={loading}
            error={error}
            playScope={playScope}
            area={selectedArea}
            onPlay={onPlay}
          />
        </div>
      </div>
    </main>
  );
}
