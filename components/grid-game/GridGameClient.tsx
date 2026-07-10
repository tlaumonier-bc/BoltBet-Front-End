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

type Phase = 'selecting' | 'finding' | 'preparing' | 'active' | 'settled';

function clampLat(lat: number) {
  return Math.max(-85, Math.min(85, lat));
}

function paddedBounds(bounds: Bounds): Bounds {
  const lonPad = Math.max(0.8, Math.abs(bounds.maxLon - bounds.minLon) * 0.14);
  const latPad = Math.max(0.5, Math.abs(bounds.maxLat - bounds.minLat) * 0.14);
  return {
    ...bounds,
    minLon: Math.max(-180, bounds.minLon - lonPad),
    maxLon: Math.min(180, bounds.maxLon + lonPad),
    minLat: Math.max(-85, bounds.minLat - latPad),
    maxLat: Math.min(85, bounds.maxLat + latPad),
  };
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

function project(bounds: Bounds, aspect: number, lat: number, lon: number) {
  const view = viewport(bounds, aspect);
  const p = worldPoint(lat, lon, view.zoom);
  return {
    x: ((p.x - view.left) / view.width) * 100,
    y: ((p.y - view.top) / view.height) * 100,
  };
}

function mapTiles(bounds: Bounds, aspect: number) {
  const view = viewport(bounds, aspect);
  const minX = Math.floor(view.left / TILE_SIZE);
  const maxX = Math.floor((view.left + view.width) / TILE_SIZE);
  const minY = Math.floor(view.top / TILE_SIZE);
  const maxY = Math.floor((view.top + view.height) / TILE_SIZE);
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({
        key: `${view.zoom}-${x}-${y}`,
        src: `${ESRI_TILE}/${view.zoom}/${y}/${x}`,
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

function ControlPanel({
  country,
  match,
  phase,
  loading,
  error,
  onPlay,
}: {
  country: GridActiveCountry;
  match: GridMatchState | null;
  phase: Phase;
  loading: boolean;
  error: string | null;
  onPlay: () => void;
}) {
  const name = countryName(country.country);
  const eloDelta = match?.eloDelta ?? null;
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
          disabled={loading || country.strikes30s <= 0}
          className="btn-glow mt-4 w-full rounded-2xl px-5 py-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Finding match...' : country.strikes30s > 0 ? 'Play on this country' : 'Waiting for live strikes'}
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

function SatelliteCountryMap({
  country,
  strikes,
  match,
  phase,
  now,
  selectedCell,
  vanishedCell,
  onCellClick,
}: {
  country: GridActiveCountry;
  strikes: CountryStrike[];
  match: GridMatchState | null;
  phase: Phase;
  now: number;
  selectedCell: number | null;
  vanishedCell: number | null;
  onCellClick: (cell: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const bounds = useMemo(() => countryBounds(country.country), [country.country]);
  const aspect = size.width / Math.max(1, size.height);
  const tiles = useMemo(() => mapTiles(bounds, aspect), [bounds, aspect]);
  const grid = match?.grid ?? { cols: 8, rows: 10 };

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
        const p = project(bounds, aspect, strike.lat, strike.lon);
        if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return null;
        const visual = strikeVisual(strike, now);
        return (
          <span
            key={`${strike.received_at}-${index}`}
            className="grid-strike pointer-events-none absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
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

      {(phase === 'preparing' || phase === 'active') && (
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) => (
            <button
              key={cell.index}
              type="button"
              disabled={phase !== 'active' || vanishedCell === cell.index}
              onClick={() => onCellClick(cell.index)}
              className={`relative border border-white/10 transition ${
                selectedCell === cell.index
                  ? 'bg-bolt/30 shadow-[inset_0_0_22px_rgba(250,204,21,0.35)]'
                  : vanishedCell === cell.index
                    ? 'bg-black/55 opacity-20'
                    : 'bg-white/[0.018] hover:bg-cyan-200/15'
              }`}
              aria-label={`Grid cell ${cell.index + 1}`}
            >
              {phase === 'active' && vanishedCell !== cell.index && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/35 px-1.5 py-0.5 text-[9px] font-black text-white/55">x1</span>
              )}
            </button>
          ))}
        </div>
      )}

      {phase === 'selecting' && (
        <div className="absolute inset-x-6 bottom-6 rounded-3xl border border-white/10 bg-black/45 p-5 backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">Grid Game</div>
          <div className="mt-1 text-lg font-bold text-white sm:text-xl">Pick the active country you want and start playing.</div>
        </div>
      )}
    </div>
  );
}

export default function GridGameClient() {
  const [countries, setCountries] = useState<GridActiveCountry[]>(DEFAULT_COUNTRIES);
  const [countryIndex, setCountryIndex] = useState(0);
  const [match, setMatch] = useState<GridMatchState | null>(null);
  const [strikes, setStrikes] = useState<CountryStrike[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [vanishedCell, setVanishedCell] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastStrikeRef = useRef<string | null>(null);
  const phase = loading && !match ? 'finding' : phaseFor(match);
  const matchId = match?.matchId ?? null;
  const matchStatus = match?.status ?? null;
  const selectedCountry = countries[Math.min(countryIndex, countries.length - 1)] ?? DEFAULT_COUNTRIES[0];

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
    setLoading(true);
    setError(null);
    setMatch(null);
    setSelectedCell(null);
    setVanishedCell(null);
    window.setTimeout(() => {
      ensureGameSession()
        .then(() => startGridMatch(selectedCountry.country))
        .then((state) => setMatch(state))
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not start match'))
        .finally(() => setLoading(false));
    }, 650);
  }, [selectedCountry.country]);

  const onCellClick = useCallback((cell: number) => {
    if (!match || phase !== 'active') return;
    setSelectedCell(cell);
    setVanishedCell(null);
    clickGridMatchCell(match.matchId, cell)
      .then((state) => setMatch(state))
      .catch(() => setSelectedCell(null));
  }, [match, phase]);

  return (
    <main className="min-h-svh overflow-hidden bg-storm px-4 pb-8 pt-24 text-white sm:px-6">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 pb-4">
        <Link href="/" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
          Back to globe
        </Link>
        <div className="hidden text-right sm:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/50">Lightning Map Game</div>
          <div className="font-display text-2xl font-black">Grid Game</div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[1fr_360px]">
        <div className="relative min-h-[620px]">
          <SatelliteCountryMap
            country={selectedCountry}
            strikes={strikes}
            match={match}
            phase={phase}
            now={nowMs}
            selectedCell={selectedCell}
            vanishedCell={vanishedCell}
            onCellClick={onCellClick}
          />
          <button
            type="button"
            onClick={selectPrevious}
            disabled={phase !== 'selecting'}
            className="absolute left-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35"
            aria-label="Previous active country"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={selectNext}
            disabled={phase !== 'selecting'}
            className="absolute right-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35"
            aria-label="Next active country"
          >
            ›
          </button>
        </div>

        <ControlPanel
          country={selectedCountry}
          match={match}
          phase={phase}
          loading={loading}
          error={error}
          onPlay={onPlay}
        />
      </div>
    </main>
  );
}
