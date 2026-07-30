'use client';

/* eslint-disable @next/next/no-img-element -- raw map tiles are external tile images, not app content images. */
// GridGameClient — continuous credit betting on a live storm grid.
//
// Search: every few seconds we scan ALL recent strikes worldwide and surface the
// hottest well-dispersed storm cells as playable zones (lib/grid-game/zones.ts —
// backtested to ~5 zones on average; see test/RESULTS.md). Pick one to play.
//
// Play: you have a credit balance. Click any cell to open a bet popup, choose a
// stake, and confirm. The stake is deducted and the cell starts a counting window
// (BET_WINDOW_MS); every real strike that lands there pays multiplier × stake,
// credited live. Multipliers are the inverse of a cell's expected strike count
// (lib/grid-game/pricing.ts) — cold cells pay big, hot pay little; the edge is
// betting where the storm is heading. Reach 0 credits and it's game over.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getCitiesInBounds,
  getProfile,
  getRecentStrikes,
  getRadarFrames,
  getStormTrack,
  getStrikesInBounds,
  getTotalLightning,
  getZoneWeather,
  registerUsername,
  type CityLabel,
  type CountryStrike,
  type RadarIndex,
  type StormTrack,
  type TotalLightning,
  type ZoneWeather,
} from '@/lib/api';
import { flagEmoji } from '@/lib/live/owm';
import { WORLD_BOUNDS, type Bounds } from '@/lib/map/countryBounds';
import { useSessionStore } from '@/store/sessionStore';
import {
  areaRectPx,
  cellForStrikeEqui,
  countryName,
  dominantCountryForArea,
  mapTiles,
  pathForPolygons,
  prepareCountries,
  projectEqui,
  radarTiles,
  type CountryFeatureCollection,
  type Grid,
  type PreparedCountry,
  type RadarFrame,
} from '@/lib/grid-game/geo';
import { HEAT_GRADIENT_CSS, StrikeDensityLayer } from '@/lib/grid-game/heatmap';
import { priceCells, PRICING_CONFIG, type CellPrice } from '@/lib/grid-game/pricing';
import { detectZones, ZONE_CONFIG, type PlayableZone } from '@/lib/grid-game/zones';
import { pickBotBet, nextBotDelay, BOT_CONFIG } from '@/lib/grid-game/bot';
import GridGameDemo from '@/components/grid-game/GridGameDemo';

const DEMO_SEEN_KEY = 'grid-game-demo-seen';

// ── Game config (tunable) ────────────────────────────────────────────────────
const START_CREDITS = 100;
const BET_WINDOW_MS = PRICING_CONFIG.windowMs; // strikes count for this long after a bet
const BET_REVEAL_MS = 1400; // keep a resolved bet on the grid this long after it ends
const MIN_BET = 1;
const BET_CHIPS = [1, 5, 10, 25];
// How long a just-landed strike flashes on the map before it's gone (and only
// lives on in the density heatmap). Sized to cover feed latency + ~1-2s visible.
const STRIKE_FLASH_MS = 2500;
const SCAN_MS = 3_000; // re-scan the world for playable zones every 3s
const SEARCH_MINUTES = Math.ceil(ZONE_CONFIG.obsMs / 60_000) + 1; // global feed window (~8 min)
const GAME_DURATION_MS = 60_000; // a round lasts 60s, then it's over
const MAX_ZONES_SHOWN = 3; // only surface the 3 hottest zones (most strikes / last 60s)

type Mode = 'selecting' | 'playing' | 'over';

// Everything the map needs to draw + control the radar layer, in one prop.
// Radar is live-by-default: it always loops through the recent frames while the
// layer is on (no play/pause, fixed opacity — toggle it off in the panel to stop).
const RADAR_OPACITY = 0.6;
interface RadarLayer {
  on: boolean;
  frame: RadarFrame | null; // current animation frame's tile params (null = no data)
  unavailable: boolean;
  frameTime: number | null; // epoch seconds of the current frame
}

interface Bet {
  id: number;
  cell: number;
  credits: number;
  mult: number; // frozen at placement
  startedAt: number;
  expiresAt: number;
  strikes: number;
  earned: number;
  countedKeys: Set<string>;
}

const strikeKey = (s: CountryStrike) => `${s.received_at}:${s.lat}:${s.lon}`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// CAPE (J/kg) → storm-risk band. Standard convective thresholds.
function capeBand(cape: number): { key: string; label: string; rgb: string } {
  if (cape < 1000) return { key: 'low', label: 'Low', rgb: '34,197,94' };
  if (cape < 2000) return { key: 'mod', label: 'Moderate', rgb: '250,204,21' };
  if (cape < 3000) return { key: 'high', label: 'High', rgb: '249,115,22' };
  return { key: 'ext', label: 'Extreme', rgb: '239,68,68' };
}

// Padded framing box around a small zone so it's visible in context while selecting.
function contextBounds(b: Bounds): Bounds {
  const cLat = (b.minLat + b.maxLat) / 2;
  const cLon = (b.minLon + b.maxLon) / 2;
  const hLat = (b.maxLat - b.minLat) / 2;
  const hLon = (b.maxLon - b.minLon) / 2;
  const k = 4.5;
  return {
    minLat: Math.max(-85, cLat - hLat * k),
    maxLat: Math.min(85, cLat + hLat * k),
    minLon: cLon - hLon * k,
    maxLon: cLon + hLon * k,
    label: '',
  };
}

async function ensureGameSession() {
  const store = useSessionStore.getState();
  if (store.token) {
    try {
      await getProfile();
      return;
    } catch {
      /* saved token may belong to another backend DB */
    }
  }
  const session = await registerUsername();
  useSessionStore.getState().setGuest(session.username, session.token, session);
}

// Map layers. Only "density" is wired up today; the rest are placeholders for
// upcoming data feeds (storm-cell motion, precipitation, CAPE, wind).
const SIDE_LAYERS: { key: string; label: string; hint: string; ready: boolean; desc: string }[] = [
  { key: 'density', label: 'Strike density', hint: 'Live heatmap of recent strikes', ready: true, desc: 'Heatmap of where lightning has struck lately. Hot cells strike often but pay LOW multipliers — hunt the cooler cells the storm is drifting into for bigger payouts.' },
  { key: 'radar', label: 'Radar', hint: 'Reflectivity cores (dBZ)', ready: true, desc: 'Weather-radar rainfall intensity. The brightest cores are the heaviest storms and the strongest short-term clue to where the next strikes will land.' },
  { key: 'total', label: 'Total lightning', hint: 'Intracloud + CG (MTG-LI)', ready: true, desc: 'Satellite total lightning (incl. in-cloud flashes that come minutes before ground strikes). ▲ = a cell is intensifying, ▼ = fading. Bet ▲ cells before they heat up.' },
  { key: 'wind', label: 'Wind', hint: 'Wind speed & direction', ready: true, desc: 'Wind arrows show which way each cell is being pushed. Storms travel downwind — bet the cells the arrows point toward.' },
  { key: 'rain', label: 'Rain', hint: 'Live precipitation', ready: true, desc: 'Live precipitation. Heavy rain usually sits with the most active storm cores, so it marks where strikes cluster.' },
  { key: 'risk', label: 'Storm risk', hint: 'CAPE instability index', ready: true, desc: 'CAPE (storm fuel) per cell in J/kg. Higher = more explosive potential. A high-CAPE cell that is NOT striking yet is a prime incoming bet.' },
  { key: 'tracks', label: 'Storm tracks', hint: 'Cell trajectory & speed', ready: true, desc: 'The storm cell’s heading and speed from its recent drift. The arrow points where it is going next — bet the cells along that path.' },
];

// Fake all-time leaderboard (best balance reached in a single game). Placeholder
// until the backend records grid-game runs.
const FAKE_LEADERBOARD: { name: string; score: number }[] = [
  { name: 'StormChaser', score: 9420 },
  { name: 'bolt_bandit', score: 7880 },
  { name: 'Zeus99', score: 6635 },
  { name: 'nimbus', score: 5410 },
  { name: 'voltage', score: 4290 },
  { name: 'raiden', score: 3125 },
];
const MEDALS = ['🥇', '🥈', '🥉'];

// ── Left panel ────────────────────────────────────────────────────────────────
function SidePanel({
  countryIso,
  credits,
  peak,
  activeBets,
  strikes,
  layers,
  onToggleLayer,
}: {
  countryIso: string;
  credits: number;
  peak: number;
  activeBets: number;
  strikes: CountryStrike[];
  layers: Record<string, boolean>;
  onToggleLayer: (key: string) => void;
}) {
  const recent = useMemo(() => strikes.slice(0, 3), [strikes]);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  return (
    <aside className="glass flex min-h-[620px] flex-col gap-3 rounded-[2rem] p-4 shadow-2xl">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/50">Live storm</div>
        <h2 className="font-display mt-1 text-xl font-black text-white">
          {flagEmoji(countryIso)} {countryIso ? countryName(countryIso) : 'Open water'}
        </h2>
      </div>

      {/* Compact credits card — the balance stays the biggest number on the page */}
      <div className="flex items-end justify-between rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] px-3 py-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">Credits</div>
          <div className="font-display text-4xl font-black leading-none text-bolt tabular-nums">{fmt(credits)}</div>
        </div>
        <div className="text-right text-[10px] font-semibold leading-tight text-white/45">
          <div>Peak {fmt(peak)}</div>
          <div>{activeBets} live bet{activeBets === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* Layers */}
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Layers</div>
        <div className="space-y-1.5">
          {SIDE_LAYERS.map((layer) => {
            const active = layer.ready && !!layers[layer.key];
            const info = openInfo === layer.key;
            return (
              <div
                key={layer.key}
                className={`relative rounded-xl border transition ${
                  layer.ready
                    ? active
                      ? 'border-cyan-300/40 bg-cyan-300/10'
                      : 'border-white/10 bg-white/[0.045] hover:bg-white/[0.07]'
                    : 'border-white/8 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-1.5 px-3 py-2">
                  <button
                    type="button"
                    disabled={!layer.ready}
                    onClick={layer.ready ? () => onToggleLayer(layer.key) : undefined}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left disabled:cursor-not-allowed"
                  >
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-semibold ${layer.ready ? 'text-white/85' : 'text-white/45'}`}>{layer.label}</span>
                      <span className="block truncate text-[10px] text-white/35">{layer.hint}</span>
                    </span>
                    {layer.ready ? (
                      <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition ${active ? 'bg-cyan-400/80' : 'bg-white/15'}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? 'left-[1.15rem]' : 'left-0.5'}`} />
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/35">Soon</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenInfo(info ? null : layer.key)}
                    className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-black transition ${info ? 'border-cyan-300/60 bg-cyan-300/20 text-cyan-100' : 'border-white/20 text-white/45 hover:text-white/80'}`}
                    aria-label={`About the ${layer.label} layer`}
                    title="What is this?"
                  >
                    i
                  </button>
                </div>
                {info && (
                  <div className="border-t border-white/10 px-3 py-2 text-[11px] leading-relaxed text-white/60">{layer.desc}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* All-time leaderboard (best single-game balance) */}
      <div className="mt-auto rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">All-time best runs</span>
          <span className="text-[10px] text-white/30">peak credits</span>
        </div>
        <div className="space-y-1">
          {FAKE_LEADERBOARD.map((row, i) => (
            <div key={row.name} className="flex items-center gap-2 rounded-lg bg-white/[0.035] px-2 py-1.5 text-[12px]">
              <span className="w-5 shrink-0 text-center">{MEDALS[i] ?? <span className="text-white/35">{i + 1}</span>}</span>
              <span className="flex-1 truncate font-semibold text-white/75">{row.name}</span>
              <span className="font-display font-black tabular-nums text-bolt">{row.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="mt-2 flex items-center justify-between border-t border-white/8 pt-2 text-[10px] text-white/35">
            <span>Last strike</span>
            <span className="tabular-nums">{recent[0].lat.toFixed(1)}, {recent[0].lon.toFixed(1)}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── The map + grid ──────────────────────────────────────────────────────────
function ZoneMap({
  strikes,
  mode,
  area,
  grid,
  cities,
  activeAreaCount,
  zoneIndex,
  secondsToScan,
  secondsLeft,
  botCredits,
  botBets,
  radar,
  loading,
  onPlay,
  now,
  credits,
  peak,
  bets,
  livePrices,
  pendingCell,
  pendingAmount,
  showDensity,
  showWind,
  showRain,
  showRisk,
  showTracks,
  showTotal,
  totalLx,
  totalLxUnavailable,
  weather,
  stormTrack,
  hitPulse,
  onCellClick,
  onSetAmount,
  onPlaceBet,
  onCancelBet,
  onPlayAgain,
  onNewStorm,
  onDominantCountry,
}: {
  strikes: CountryStrike[];
  mode: Mode;
  area: PlayableZone | null;
  grid: Grid;
  cities: CityLabel[];
  activeAreaCount: number;
  zoneIndex: number;
  secondsToScan: number;
  secondsLeft: number;
  botCredits: number;
  botBets: Bet[];
  radar: RadarLayer;
  loading: boolean;
  onPlay: () => void;
  now: number;
  credits: number;
  peak: number;
  bets: Bet[];
  livePrices: CellPrice[];
  pendingCell: number | null;
  pendingAmount: number;
  showDensity: boolean;
  showWind: boolean;
  showRain: boolean;
  showRisk: boolean;
  showTracks: boolean;
  showTotal: boolean;
  totalLx: TotalLightning | null;
  totalLxUnavailable: boolean;
  weather: ZoneWeather | null;
  stormTrack: StormTrack | null;
  hitPulse: Set<number>;
  onCellClick: (cell: number) => void;
  onSetAmount: (amount: number) => void;
  onPlaceBet: () => void;
  onCancelBet: () => void;
  onPlayAgain: () => void;
  onNewStorm: () => void;
  onDominantCountry: (iso: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [preparedCountries, setPreparedCountries] = useState<PreparedCountry[]>([]);

  const gameStarted = mode === 'playing' || mode === 'over';
  // While selecting, frame a wide context box around the zone so you see where it
  // is; while playing, frame the zone itself.
  const bounds: Bounds = useMemo(
    () => (area ? (gameStarted ? area.bounds : contextBounds(area.bounds)) : { ...WORLD_BOUNDS }),
    [area, gameStarted],
  );
  const aspect = size.width / Math.max(1, size.height);
  const tiles = useMemo(() => mapTiles(bounds, aspect), [bounds, aspect]);
  const radarTileList = useMemo(
    () => (radar.on && radar.frame ? radarTiles(bounds, aspect, radar.frame) : []),
    [radar.on, radar.frame, bounds, aspect],
  );

  const dominant = useMemo(
    () => (area ? dominantCountryForArea(preparedCountries, area.bounds, area.grid) : null),
    [area, preparedCountries],
  );
  const dominantPath = useMemo(
    () => (gameStarted && dominant ? pathForPolygons(dominant.renderPolygons, bounds, size.width, size.height) : ''),
    [gameStarted, dominant, bounds, size.width, size.height],
  );
  const displayIso = dominant?.iso ?? '';
  const locatorRect = useMemo(
    () => (!gameStarted && area ? areaRectPx(bounds, area.bounds, size.width, size.height) : null),
    [gameStarted, area, bounds, size.width, size.height],
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
    let alive = true;
    fetch('/geo/countries.geojson')
      .then((r) => r.json() as Promise<CountryFeatureCollection>)
      .then((data) => {
        if (!alive) return;
        setPreparedCountries(prepareCountries(data.features));
      })
      .catch(() => {
        if (!alive) return;
        setPreparedCountries([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const betByCell = useMemo(() => {
    const m = new Map<number, Bet>();
    for (const b of bets) m.set(b.cell, b);
    return m;
  }, [bets]);

  const cellW = size.width / grid.cols;
  const cellH = size.height / grid.rows;

  const popup = useMemo(() => {
    if (pendingCell == null) return null;
    const col = pendingCell % grid.cols;
    const row = Math.floor(pendingCell / grid.cols);
    const cx = (col + 0.5) * cellW;
    const cy = (row + 0.5) * cellH;
    const W = 232;
    const H = 176;
    const left = Math.max(8, Math.min(size.width - W - 8, cx - W / 2));
    const below = cy + cellH / 2 + 8;
    const top = below + H <= size.height ? below : Math.max(8, cy - cellH / 2 - H - 8);
    const mult = livePrices[pendingCell]?.multiplier ?? 0;
    return { left, top, W, mult };
  }, [pendingCell, grid.cols, cellW, cellH, size.width, size.height, livePrices]);

  const cells = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      cells.push({ row, col, index: row * grid.cols + col });
    }
  }
  const maxBet = Math.floor(credits);

  return (
    <div ref={mapRef} className="relative h-full min-h-[620px] flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl">
      <div className="absolute inset-0 opacity-100 brightness-[1.08] saturate-[1.18] contrast-[1.05]">
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

      {/* Radar reflectivity raster — above the satellite, below our own layers.
          Tiles load straight from the radar host; index comes from the backend. */}
      {gameStarted && radar.on && radarTileList.length > 0 && (
        <div className="pointer-events-none absolute inset-0" style={{ opacity: RADAR_OPACITY }}>
          {radarTileList.map((tile) => (
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
      )}

      {gameStarted && showDensity && <StrikeDensityLayer strikes={strikes} bounds={bounds} width={size.width} height={size.height} />}

      {/* Rain: soft blue precipitation blobs at Open-Meteo sample points (mm/h). */}
      {gameStarted && showRain && weather && (() => {
        const wet = weather.points.filter((p) => (p.precip ?? 0) > 0.05);
        const wxN = Math.max(2, Math.round(Math.sqrt(weather.points.length)));
        const spacing = Math.max(size.width, size.height) / wxN;
        return (
          <>
            <svg className="pointer-events-none absolute inset-0 z-[6] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
              <defs>
                <radialGradient id="rainblob">
                  <stop offset="0%" stopColor="rgba(37,99,235,0.85)" />
                  <stop offset="100%" stopColor="rgba(37,99,235,0)" />
                </radialGradient>
              </defs>
              {wet.map((pt, i) => {
                const p = projectEqui(bounds, size.width, size.height, pt.lat, pt.lon);
                const intensity = Math.max(0, Math.min(1, (pt.precip ?? 0) / 6)); // ~6 mm/h = heavy
                return <circle key={i} cx={p.x} cy={p.y} r={spacing * (0.55 + intensity * 0.55)} fill="url(#rainblob)" opacity={0.28 + intensity * 0.5} />;
              })}
            </svg>
          </>
        );
      })()}

      {/* Storm risk: CAPE field (J/kg) → green→amber→orange→red instability blobs. */}
      {gameStarted && showRisk && weather && weather.points.some((p) => p.cape != null) && (() => {
        const wxN = Math.max(2, Math.round(Math.sqrt(weather.points.length)));
        const spacing = Math.max(size.width, size.height) / wxN;
        const BANDS = [
          { key: 'low', rgb: '34,197,94' },
          { key: 'mod', rgb: '250,204,21' },
          { key: 'high', rgb: '249,115,22' },
          { key: 'ext', rgb: '239,68,68' },
        ];
        // Bilinearly interpolate the CAPE field to each cell centre so every cell
        // gets its own score (the blob heatmap alone reads as uniform because CAPE
        // varies slowly across a zone).
        const n = Math.max(2, Math.round(Math.sqrt(weather.points.length)));
        const spanLat = bounds.maxLat - bounds.minLat;
        const spanLon = bounds.maxLon - bounds.minLon;
        const sampleAt = (sr: number, sc: number) => weather.points[Math.min(n - 1, Math.max(0, sr)) * n + Math.min(n - 1, Math.max(0, sc))];
        const capeAt = (lat: number, lon: number) => {
          const fr = ((lat - bounds.minLat) / spanLat) * n - 0.5;
          const fc = ((lon - bounds.minLon) / spanLon) * n - 0.5;
          const r0 = Math.floor(fr);
          const c0 = Math.floor(fc);
          const tr = fr - r0;
          const tc = fc - c0;
          let acc = 0;
          let wsum = 0;
          for (const [dr, dc, wt] of [[0, 0, (1 - tr) * (1 - tc)], [0, 1, (1 - tr) * tc], [1, 0, tr * (1 - tc)], [1, 1, tr * tc]] as const) {
            const s = sampleAt(r0 + dr, c0 + dc);
            if (!s || s.cape == null) continue;
            acc += wt * s.cape;
            wsum += wt;
          }
          return wsum > 0 ? acc / wsum : null;
        };
        return (
          <>
            <svg className="pointer-events-none absolute inset-0 z-[6] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
              <defs>
                {BANDS.map((b) => (
                  <radialGradient key={b.key} id={`risk-${b.key}`}>
                    <stop offset="0%" stopColor={`rgba(${b.rgb},0.85)`} />
                    <stop offset="100%" stopColor={`rgba(${b.rgb},0)`} />
                  </radialGradient>
                ))}
              </defs>
              {weather.points.map((pt, i) => {
                if (pt.cape == null) return null;
                const p = projectEqui(bounds, size.width, size.height, pt.lat, pt.lon);
                const intensity = Math.max(0, Math.min(1, pt.cape / 3000));
                return <circle key={i} cx={p.x} cy={p.y} r={spacing * (0.6 + intensity * 0.5)} fill={`url(#risk-${capeBand(pt.cape).key})`} opacity={0.14 + intensity * 0.36} />;
              })}
            </svg>
            {/* Per-cell CAPE score, bottom-right of each cell, coloured by band. */}
            <svg className="pointer-events-none absolute inset-0 z-[9] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
              {cells.map((cell) => {
                const lat = bounds.maxLat - ((cell.row + 0.5) / grid.rows) * spanLat;
                const lon = bounds.minLon + ((cell.col + 0.5) / grid.cols) * spanLon;
                const cape = capeAt(lat, lon);
                if (cape == null) return null;
                return (
                  <text
                    key={cell.index}
                    x={(cell.col + 1) * cellW - cellW * 0.07}
                    y={(cell.row + 1) * cellH - cellH * 0.09}
                    textAnchor="end"
                    className="font-black"
                    fill={`rgb(${capeBand(cape).rgb})`}
                    style={{ fontSize: Math.max(8, cellH * 0.17), paintOrder: 'stroke', stroke: 'rgba(2,6,23,0.85)', strokeWidth: 2.4, strokeLinejoin: 'round' }}
                  >
                    {Math.round(cape)}
                  </text>
                );
              })}
            </svg>
          </>
        );
      })()}

      {/* Total lightning (IC+CG, MTG-LI): a small ▲/▼ in each cell's bottom-left —
          ▲ = flash rate rising (intensifying), ▼ = fading. Kept tiny + corner-pinned
          so it never blocks the other layers or the bet UI. */}
      {gameStarted && showTotal && totalLx && !totalLxUnavailable && (() => {
        const tn = Math.max(2, Math.round(Math.sqrt(totalLx.points.length)));
        const spanLat = bounds.maxLat - bounds.minLat;
        const spanLon = bounds.maxLon - bounds.minLon;
        const trendAt = (lat: number, lon: number) => {
          const r = Math.min(tn - 1, Math.max(0, Math.round(((lat - bounds.minLat) / spanLat) * tn - 0.5)));
          const c = Math.min(tn - 1, Math.max(0, Math.round(((lon - bounds.minLon) / spanLon) * tn - 0.5)));
          return totalLx.points[r * tn + c] ?? null;
        };
        return (
          <svg className="pointer-events-none absolute inset-0 z-[9] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
            {cells.map((cell) => {
              const lat = bounds.maxLat - ((cell.row + 0.5) / grid.rows) * spanLat;
              const lon = bounds.minLon + ((cell.col + 0.5) / grid.cols) * spanLon;
              const s = trendAt(lat, lon);
              if (!s || s.flashes <= 0 || s.trend === 0) return null;
              return (
                <text
                  key={cell.index}
                  x={cell.col * cellW + cellW * 0.1}
                  y={(cell.row + 1) * cellH - cellH * 0.1}
                  textAnchor="start"
                  className="font-black"
                  fill={s.trend > 0 ? 'rgba(240,171,252,1)' : 'rgba(148,163,184,0.95)'}
                  style={{ fontSize: Math.max(8, cellH * 0.18), paintOrder: 'stroke', stroke: 'rgba(2,6,23,0.85)', strokeWidth: 2.4, strokeLinejoin: 'round' }}
                >
                  {s.trend > 0 ? '▲' : '▼'}
                </text>
              );
            })}
          </svg>
        );
      })()}

      {/* Wind arrows: one per Open-Meteo sample point; arrow points where the wind
          blows TO (meteorological dir + 180°), length/opacity scale with speed. */}
      {gameStarted && showWind && weather && weather.points.length > 0 && (() => {
        // One arrow per grid CELL: bilinearly interpolate wind (as u/v vectors)
        // from the n×n Open-Meteo sample field to each cell centre.
        const n = Math.max(2, Math.round(Math.sqrt(weather.points.length)));
        const spanLat = bounds.maxLat - bounds.minLat;
        const spanLon = bounds.maxLon - bounds.minLon;
        const sampleAt = (sr: number, sc: number) => weather.points[Math.min(n - 1, Math.max(0, sr)) * n + Math.min(n - 1, Math.max(0, sc))];
        const windAt = (lat: number, lon: number) => {
          const fr = ((lat - bounds.minLat) / spanLat) * n - 0.5;
          const fc = ((lon - bounds.minLon) / spanLon) * n - 0.5;
          const r0 = Math.floor(fr);
          const c0 = Math.floor(fc);
          const tr = fr - r0;
          const tc = fc - c0;
          let u = 0;
          let v = 0;
          let wsum = 0;
          for (const [dr, dc, wt] of [[0, 0, (1 - tr) * (1 - tc)], [0, 1, (1 - tr) * tc], [1, 0, tr * (1 - tc)], [1, 1, tr * tc]] as const) {
            const s = sampleAt(r0 + dr, c0 + dc);
            if (!s || s.windDir == null || s.windSpeed == null) continue;
            const rad = (s.windDir * Math.PI) / 180;
            u += wt * s.windSpeed * Math.sin(rad);
            v += wt * s.windSpeed * Math.cos(rad);
            wsum += wt;
          }
          if (wsum <= 0) return null;
          u /= wsum;
          v /= wsum;
          return { spd: Math.hypot(u, v), dir: (Math.atan2(u, v) * 180) / Math.PI };
        };
        return (
          <svg className="pointer-events-none absolute inset-0 z-[7] h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
            {cells.map((cell) => {
              const lat = bounds.maxLat - ((cell.row + 0.5) / grid.rows) * spanLat;
              const lon = bounds.minLon + ((cell.col + 0.5) / grid.cols) * spanLon;
              const w = windAt(lat, lon);
              if (!w) return null;
              const cx = (cell.col + 0.5) * cellW;
              const cy = (cell.row + 0.5) * cellH;
              const len = Math.min(Math.min(cellW, cellH) * 0.82, 12 + Math.min(1, w.spd / 60) * 28);
              const blowTo = (w.dir + 180) % 360;
              const op = 0.7 + Math.min(1, w.spd / 50) * 0.3;
              return (
                <g key={cell.index} transform={`translate(${cx} ${cy}) rotate(${blowTo})`} style={{ opacity: op }}>
                  <line x1="0" y1={len / 2} x2="0" y2={-len / 2} stroke="rgba(224,242,254,1)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path d={`M 0 ${-len / 2 - 1.5} l -4.5 7 l 4.5 -2.6 l 4.5 2.6 z`} fill="rgba(224,242,254,1)" />
                </g>
              );
            })}
          </svg>
        );
      })()}

      {/* Storm track: faint trail (past→now) + bold arrow (now→projected), from
          our own strike-centroid drift. Sits above the grid so it's clearly read. */}
      {gameStarted && showTracks && stormTrack && stormTrack.speedKmh >= 1 && (() => {
        const past = projectEqui(bounds, size.width, size.height, stormTrack.from.lat, stormTrack.from.lon);
        const nowC = projectEqui(bounds, size.width, size.height, stormTrack.to.lat, stormTrack.to.lon);
        const tip = projectEqui(bounds, size.width, size.height, stormTrack.projected.lat, stormTrack.projected.lon);
        const ang = (Math.atan2(tip.y - nowC.y, tip.x - nowC.x) * 180) / Math.PI;
        return (
          <>
            <svg className="pointer-events-none absolute inset-0 z-[9] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
              <line x1={past.x} y1={past.y} x2={nowC.x} y2={nowC.y} stroke="rgba(56,189,248,0.5)" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
              <line x1={nowC.x} y1={nowC.y} x2={tip.x} y2={tip.y} stroke="rgba(125,211,252,0.98)" strokeWidth="3.5" vectorEffect="non-scaling-stroke" className="drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              <g transform={`translate(${tip.x} ${tip.y}) rotate(${ang})`}>
                <path d="M 0 0 L -13 -7 L -9 0 L -13 7 Z" fill="rgba(125,211,252,0.98)" />
              </g>
              <circle cx={nowC.x} cy={nowC.y} r="4" fill="rgba(226,232,240,0.95)" stroke="rgba(56,189,248,0.9)" strokeWidth="2" />
            </svg>
          </>
        );
      })()}

      {/* Unified legend — one box for every enabled layer (top-left). */}
      {gameStarted && (showDensity || radar.on || showTotal || showWind || showRain || showRisk || showTracks) && (
        <div className="pointer-events-none absolute left-4 top-4 z-20 w-[188px] space-y-2 rounded-2xl border border-white/10 bg-slate-950/75 px-3 py-2.5 shadow-2xl backdrop-blur-md">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Active layers</div>

          {showDensity && (
            <div>
              <div className="text-[10px] font-bold text-white/75">Strike density</div>
              <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: HEAT_GRADIENT_CSS }} />
            </div>
          )}

          {radar.on && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/75">Radar · dBZ</span>
                {!radar.unavailable && radar.frameTime != null && (
                  <span className="text-[9px] tabular-nums text-white/40">{new Date(radar.frameTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
              {radar.unavailable ? (
                <div className="text-[10px] font-semibold text-amber-200/80">Data unavailable</div>
              ) : (
                <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: 'linear-gradient(to right, rgba(34,197,94,0.9), rgba(250,204,21,0.95), rgba(249,115,22,0.95), rgba(239,68,68,1), rgba(217,70,239,1))' }} />
              )}
            </div>
          )}

          {showTotal && (totalLx || totalLxUnavailable) && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-fuchsia-200/85">Total lightning</span>
                {!totalLxUnavailable && <span className="text-[9px] text-white/40"><span className="text-fuchsia-300">▲</span>rising <span className="text-slate-400">▼</span>fading</span>}
              </div>
              {totalLxUnavailable ? (
                <div className="text-[10px] font-semibold text-amber-200/80">Data unavailable</div>
              ) : (
                <div className="text-[9px] text-white/50">{totalLx?.summary.flashTotal ?? 0} flashes · {totalLx?.summary.trend}{totalLx?.source?.includes('mock') ? ' · est.' : ''}</div>
              )}
            </div>
          )}

          {showWind && weather?.summary.windDir != null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-bold text-white/75"><span className="text-sky-200" style={{ display: 'inline-block', transform: `rotate(${((weather.summary.windDir ?? 0) + 180) % 360}deg)` }}>↑</span>Wind</span>
              <span className="text-[9px] text-white/50">{weather.summary.windAvg ?? '—'} km/h</span>
            </div>
          )}

          {showRain && weather && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white/75">Rain</span>
              <span className="text-[9px] text-white/50">{(weather.summary.precipMax ?? 0).toFixed(1)} mm/h</span>
            </div>
          )}

          {showRisk && weather?.summary.capeMax != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white/75">Storm risk</span>
              <span className="text-[9px] font-semibold" style={{ color: `rgb(${capeBand(weather.summary.capeMax).rgb})` }}>CAPE {Math.round(weather.summary.capeMax)}</span>
            </div>
          )}

          {showTracks && stormTrack && stormTrack.speedKmh >= 1 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white/75">Storm cell</span>
              <span className="text-[9px] font-semibold text-cyan-200">{stormTrack.compass ?? '—'} · {Math.round(stormTrack.speedKmh)} km/h</span>
            </div>
          )}
        </div>
      )}

      {/* Credit balance HUD */}
      {gameStarted && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-2 text-center shadow-2xl backdrop-blur-md">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-bolt/70">You</div>
              <div key={Math.round(credits)} className="credit-pop font-display text-3xl font-black leading-none text-bolt tabular-nums">{fmt(credits)}</div>
            </div>
            <div className="h-8 w-px bg-white/15" />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">🤖 Bot</div>
              <div className={`font-display text-2xl font-black leading-none tabular-nums transition-colors ${botCredits >= credits ? 'text-rose-300' : 'text-white/70'}`}>{fmt(botCredits)}</div>
            </div>
            {mode === 'playing' && (
              <>
                <div className="h-8 w-px bg-white/15" />
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">Time</div>
                  <div className={`font-display text-xl font-black leading-none tabular-nums transition-colors ${secondsLeft <= 10 ? 'text-rose-400' : 'text-white/70'}`}>{secondsLeft}s</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pre-play locator + play button */}
      {locatorRect && area && (
        <svg className="pointer-events-none absolute inset-0 z-[12] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
          <rect x={locatorRect.x} y={locatorRect.y} width={Math.max(18, locatorRect.w)} height={Math.max(18, locatorRect.h)} rx="8" fill="rgba(56,189,248,0.12)" stroke="rgba(125,211,252,0.95)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {locatorRect && area && (
        <div
          className="pointer-events-auto absolute z-[18] flex w-[280px] items-center justify-between gap-3 rounded-2xl border border-cyan-200/25 bg-slate-950/80 px-3 py-2 text-xs text-cyan-50 shadow-2xl backdrop-blur"
          style={{ left: `${Math.min(size.width - 296, Math.max(16, locatorRect.cx + 78))}px`, top: `${Math.max(18, locatorRect.cy - 94)}px` }}
        >
          <div className="min-w-0">
            <div className="font-black uppercase tracking-[0.18em] text-cyan-100/55">
              {displayIso ? `${flagEmoji(displayIso)} ${countryName(displayIso)}` : 'Open water'}
            </div>
            <div className="mt-0.5 font-bold">Zone {zoneIndex + 1} of {activeAreaCount} · {area.roundStrikes} strikes/min</div>
          </div>
          <button type="button" onClick={onPlay} disabled={loading} className="btn-glow shrink-0 rounded-xl px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">
            Play
          </button>
        </div>
      )}

      {/* Strikes: only the JUST-LANDED ones flash brightly for ~STRIKE_FLASH_MS,
          then they disappear — the accumulated history lives in the heatmap. No
          persistent dots, so a fresh strike is easy to read. */}
      {gameStarted && strikes.map((strike, index) => {
        const t = Date.parse(strike.received_at);
        const age = now - t;
        if (!Number.isFinite(t) || age < 0 || age > STRIKE_FLASH_MS) return null;
        const p = projectEqui(bounds, size.width, size.height, strike.lat, strike.lon);
        if (p.x < 0 || p.x > size.width || p.y < 0 || p.y > size.height) return null;
        const life = Math.max(0, 1 - age / STRIKE_FLASH_MS); // 1 → 0 fade-out
        return (
          <span
            key={`${strike.received_at}-${strike.lat}-${strike.lon}-${index}`}
            className="grid-strike pointer-events-none absolute"
            style={{ left: `${p.x}px`, top: `${p.y}px`, opacity: 0.55 + life * 0.45, transform: `translate(-50%, -50%) scale(${0.85 + life * 0.7})`, zIndex: 16 }}
          >
            <span className="grid-strike-bolt" />
            <span className="grid-strike-ring grid-strike-ring-a" />
            <span className="grid-strike-ring grid-strike-ring-b" />
            <span className="grid-strike-core grid-strike-core-fresh" />
          </span>
        );
      })}

      {/* City labels */}
      {gameStarted && cities.map((city, index) => {
        const p = projectEqui(bounds, size.width, size.height, city.lat, city.lon);
        if (p.x < 6 || p.x > size.width - 6 || p.y < 6 || p.y > size.height - 6) return null;
        return (
          <div key={`${city.name}-${index}`} className="pointer-events-none absolute z-[15] -translate-y-1/2" style={{ left: `${p.x}px`, top: `${p.y}px` }}>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/85 ring-1 ring-black/40" />
              <span className="whitespace-nowrap text-[11px] font-semibold text-white [text-shadow:_0_1px_4px_rgba(0,0,0,0.95)]">{city.name}</span>
            </div>
          </div>
        );
      })}

      {/* Grid + prices + bets */}
      {gameStarted && (
        <svg className="pointer-events-none absolute inset-0 z-[8] h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden>
          <g className="pointer-events-auto">
            {cells.map((cell) => {
              const bet = betByCell.get(cell.index);
              const price = livePrices[cell.index];
              const mult = bet ? bet.mult : price?.multiplier ?? 0;
              const x = cell.col * cellW;
              const y = cell.row * cellH;
              const active = bet && now <= bet.expiresAt;
              const resolved = bet && now > bet.expiresAt;
              const pending = pendingCell === cell.index;
              const progress = bet && active ? Math.max(0, Math.min(1, (bet.expiresAt - now) / BET_WINDOW_MS)) : 0;

              let fill = 'rgba(148,163,184,0.015)';
              let stroke = 'rgba(226,232,240,0.34)';
              let strokeW = 0.14;
              if (bet) {
                if (resolved) {
                  fill = bet.strikes > 0 ? 'rgba(16,185,129,0.30)' : 'rgba(244,63,94,0.24)';
                  stroke = bet.strikes > 0 ? 'rgba(52,211,153,0.9)' : 'rgba(251,113,133,0.85)';
                } else {
                  fill = 'rgba(56,189,248,0.20)';
                  stroke = 'rgba(125,211,252,0.9)';
                }
                strokeW = 0.4;
              }
              if (pending) {
                stroke = 'rgba(250,204,21,0.95)';
                strokeW = 0.5;
              }
              return (
                <g key={cell.index} className={hitPulse.has(cell.index) ? 'grid-cell-hit' : undefined}>
                  <rect
                    x={x}
                    y={y}
                    width={cellW}
                    height={cellH}
                    rx="0.8"
                    vectorEffect="non-scaling-stroke"
                    className={mode === 'playing' && !bet ? 'cursor-pointer' : 'cursor-default'}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeW}
                    onClick={() => onCellClick(cell.index)}
                  />
                  {mult > 0 && (
                    <text
                      x={x + cellW * 0.5}
                      y={y + (bet ? cellH * 0.24 : cellH * 0.42)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(226,232,240,0.5)"
                      className="pointer-events-none font-bold"
                      style={{ fontSize: Math.max(8, cellH * (bet ? 0.17 : 0.2)) }}
                    >
                      {mult.toFixed(mult >= 10 ? 0 : 1)}×
                    </text>
                  )}
                  {bet && (
                    <text x={x + cellW * 0.5} y={y + cellH * 0.52} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none fill-white font-black" style={{ fontSize: Math.max(11, cellH * 0.26) }}>
                      {bet.credits}
                    </text>
                  )}
                  {bet && (bet.earned > 0 || resolved) && (
                    <text
                      x={x + cellW * 0.5}
                      y={y + cellH * 0.8}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`pointer-events-none font-black ${bet.strikes > 0 ? 'fill-emerald-200' : 'fill-rose-200'}`}
                      style={{ fontSize: Math.max(8, cellH * 0.16) }}
                    >
                      {bet.strikes > 0 ? `+${fmt(bet.earned)}` : `−${bet.credits}`}
                    </text>
                  )}
                  {bet && active && (
                    <rect x={x + cellW * 0.12} y={y + cellH * 0.9} width={cellW * 0.76 * progress} height={Math.max(1.5, cellH * 0.04)} rx="1" fill="rgba(125,211,252,0.9)" className="pointer-events-none" />
                  )}
                </g>
              );
            })}
          </g>
          {/* Bot's per-cell countdown — top edge (player's is on the bottom, so both
              fit on the same cell when player and bot bet it together). */}
          {botBets.map((b) => {
            if (now > b.expiresAt) return null;
            const col = b.cell % grid.cols;
            const row = Math.floor(b.cell / grid.cols);
            const x = col * cellW;
            const y = row * cellH;
            const progress = Math.max(0, Math.min(1, (b.expiresAt - now) / BET_WINDOW_MS));
            return (
              <rect key={`botbar-${b.id}`} x={x + cellW * 0.12} y={y + cellH * 0.06} width={cellW * 0.76 * progress} height={Math.max(1.5, cellH * 0.04)} rx="1" fill="rgba(244,63,94,0.9)" className="pointer-events-none" />
            );
          })}
          {dominantPath && (
            <path d={dominantPath} fill="none" stroke="rgba(125,211,252,0.92)" strokeWidth="0.28" vectorEffect="non-scaling-stroke" fillRule="evenodd" className="drop-shadow-[0_0_14px_rgba(56,189,248,0.65)]" />
          )}
        </svg>
      )}

      {/* Bet popup */}
      {popup && pendingCell != null && (
        <div
          className="pointer-events-auto absolute z-[25] rounded-2xl border border-bolt/30 bg-slate-950/92 p-3 shadow-2xl backdrop-blur-md"
          style={{ left: `${popup.left}px`, top: `${popup.top}px`, width: `${popup.W}px` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Place a bet</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-black text-cyan-200">{popup.mult.toFixed(popup.mult >= 10 ? 0 : 1)}×</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => onSetAmount(pendingAmount - 1)} className="grid size-8 place-items-center rounded-lg border border-white/15 text-lg font-black text-white/80 transition hover:bg-white/10 disabled:opacity-30" disabled={pendingAmount <= MIN_BET}>−</button>
            <div className="flex-1 rounded-lg bg-white/8 py-1.5 text-center font-display text-2xl font-black tabular-nums text-white">{pendingAmount}</div>
            <button type="button" onClick={() => onSetAmount(pendingAmount + 1)} className="grid size-8 place-items-center rounded-lg border border-white/15 text-lg font-black text-white/80 transition hover:bg-white/10 disabled:opacity-30" disabled={pendingAmount >= maxBet}>+</button>
          </div>
          <div className="mt-2 flex gap-1.5">
            {BET_CHIPS.filter((c) => c <= maxBet).map((c) => (
              <button key={c} type="button" onClick={() => onSetAmount(c)} className="flex-1 rounded-lg border border-white/12 py-1 text-[11px] font-bold text-white/70 transition hover:bg-white/10">{c}</button>
            ))}
            <button type="button" onClick={() => onSetAmount(maxBet)} className="flex-1 rounded-lg border border-white/12 py-1 text-[11px] font-bold text-white/70 transition hover:bg-white/10">Max</button>
          </div>
          <div className="mt-2 text-center text-[10px] text-white/45">each strike here pays <span className="font-bold text-emerald-200">+{fmt(popup.mult * pendingAmount)}</span></div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onCancelBet} className="flex-1 rounded-lg border border-white/12 py-2 text-xs font-bold text-white/60 transition hover:bg-white/10">Cancel</button>
            <button type="button" onClick={onPlaceBet} disabled={pendingAmount < MIN_BET || pendingAmount > maxBet} className="btn-glow flex-1 rounded-lg py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40">Bet {pendingAmount}</button>
          </div>
        </div>
      )}

      {/* Bot's live bets — small robot chips so you can see the opponent playing */}
      {mode === 'playing' && botBets.map((b) => {
        if (now > b.expiresAt + BET_REVEAL_MS) return null;
        const col = b.cell % grid.cols;
        const row = Math.floor(b.cell / grid.cols);
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        const resolved = now > b.expiresAt;
        const hit = b.strikes > 0;
        return (
          <div
            key={`bot-${b.id}`}
            className="pointer-events-none absolute z-[14] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${cx}px`, top: `${cy + cellH * 0.32}px` }}
          >
            <div className={`flex items-center gap-0.5 rounded-md border px-1 py-px text-[9px] font-black leading-none tabular-nums shadow-lg backdrop-blur-sm ${resolved ? (hit ? 'border-emerald-300/60 bg-emerald-500/25 text-emerald-100' : 'border-rose-300/60 bg-rose-500/25 text-rose-100') : 'border-rose-400/80 bg-rose-500/30 text-rose-50'}`}>
              <span>🤖</span>
              <span>{resolved ? (hit ? `+${fmt(b.earned)}` : `−${b.credits}`) : b.credits}</span>
            </div>
          </div>
        );
      })}

      {/* Selecting overlays */}
      {mode === 'selecting' && activeAreaCount === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[30] grid place-items-center bg-black/25 backdrop-blur-[1px]">
          <div className="glass rounded-[2rem] border border-white/15 bg-slate-950/70 px-8 py-7 text-center shadow-2xl backdrop-blur-md">
            <div className="text-[11px] font-black uppercase tracking-[0.32em] text-white/55">Scanning the globe…</div>
            <div className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-white/70">Looking for active storms with a playable grid.</div>
            <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">Next scan in</div>
            <div className="font-display text-5xl font-black tabular-nums text-bolt">{secondsToScan}</div>
          </div>
        </div>
      )}
      {mode === 'selecting' && activeAreaCount > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[30] -translate-x-1/2">
          <div className="glass rounded-full border border-white/12 bg-slate-950/60 px-4 py-1.5 shadow-xl backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">{activeAreaCount} live zones · rescans in </span>
            <span className="font-display text-sm font-black tabular-nums text-bolt">{secondsToScan}s</span>
          </div>
        </div>
      )}

      {/* Game over */}
      {mode === 'over' && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-sm">
          <div className="rounded-[2rem] border border-rose-300/25 bg-slate-950/85 px-8 py-7 text-center shadow-2xl">
            <div className="text-[11px] font-black uppercase tracking-[0.32em] text-white/55">{credits >= MIN_BET ? "Time's up" : 'Out of credits'}</div>
            {(() => {
              const won = credits > botCredits;
              const tie = credits === botCredits;
              return (
                <div className={`font-display mt-2 text-5xl font-black ${won ? 'text-emerald-300' : tie ? 'text-white' : 'text-rose-300'}`}>
                  {tie ? 'Dead heat' : won ? 'You win!' : 'Bot wins'}
                </div>
              );
            })()}
            <div className="mt-4 flex items-center justify-center gap-4 text-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-bolt/70">You</div>
                <div className="font-display text-3xl font-black text-bolt tabular-nums">{fmt(credits)}</div>
              </div>
              <div className="text-white/30">vs</div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">🤖 Bot</div>
                <div className="font-display text-3xl font-black text-white/70 tabular-nums">{fmt(botCredits)}</div>
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-white/45">
              Peak balance <span className="font-display text-base font-black text-bolt">{fmt(peak)}</span>
            </div>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" onClick={onPlayAgain} className="btn-glow rounded-xl px-5 py-2.5 text-sm font-black">Play again</button>
              <button type="button" onClick={onNewStorm} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10">New storm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GridGameClient() {
  const [activeAreas, setActiveAreas] = useState<PlayableZone[]>([]);
  const [zoneIndex, setZoneIndex] = useState(0);
  const [activeZone, setActiveZone] = useState<PlayableZone | null>(null);
  const [strikes, setStrikes] = useState<CountryStrike[]>([]);
  const [cities, setCities] = useState<CityLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  const [nextScanAt, setNextScanAt] = useState(() => Date.now() + SCAN_MS);
  const [dominantIso, setDominantIso] = useState<string>('');
  const [layers, setLayers] = useState<Record<string, boolean>>({ density: true, radar: false, total: false, wind: false, rain: false, risk: false, tracks: false });
  const [totalLx, setTotalLx] = useState<TotalLightning | null>(null);
  const [totalLxUnavailable, setTotalLxUnavailable] = useState(false);
  const [radarIndex, setRadarIndex] = useState<RadarIndex | null>(null);
  const [radarUnavailable, setRadarUnavailable] = useState(false);
  const [radarFrameIdx, setRadarFrameIdx] = useState(0);
  const [weather, setWeather] = useState<ZoneWeather | null>(null);
  const [stormTrack, setStormTrack] = useState<StormTrack | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);
  const toggleLayer = useCallback((key: string) => setLayers((l) => ({ ...l, [key]: !l[key] })), []);

  // ── continuous betting state ──────────────────────────────────────────────
  const [credits, setCredits] = useState(START_CREDITS);
  const [peak, setPeak] = useState(START_CREDITS);
  const [bets, setBets] = useState<Bet[]>([]);
  const [pendingCell, setPendingCell] = useState<number | null>(null);
  const [pendingAmount, setPendingAmount] = useState(MIN_BET);
  const [gameOver, setGameOver] = useState(false);
  const [roundEndsAt, setRoundEndsAt] = useState<number | null>(null);
  const [hitPulse, setHitPulse] = useState<Set<number>>(new Set());
  const betIdRef = useRef(0);

  // ── bot opponent ──────────────────────────────────────────────────────────
  const [botCredits, setBotCredits] = useState(START_CREDITS);
  const [botBets, setBotBets] = useState<Bet[]>([]);
  const botBetIdRef = useRef(0);
  const botNextAtRef = useRef(0); // wall-clock ms of the bot's next bet attempt

  const strikesRef = useRef<CountryStrike[]>([]);
  const betsRef = useRef<Bet[]>([]);
  const botBetsRef = useRef<Bet[]>([]);
  const botCreditsRef = useRef(START_CREDITS);
  const livePricesRef = useRef<CellPrice[]>([]);
  strikesRef.current = strikes;
  betsRef.current = bets;
  botBetsRef.current = botBets;
  botCreditsRef.current = botCredits;

  const mode: Mode = gameOver ? 'over' : activeZone ? 'playing' : 'selecting';
  const gameStarted = mode === 'playing' || mode === 'over';

  const zoneBounds: Bounds | null = activeZone ? activeZone.bounds : null;
  const grid: Grid = useMemo(() => (activeZone ? activeZone.grid : { cols: 10, rows: 8 }), [activeZone]);
  const selectedZone = activeAreas.length ? activeAreas[zoneIndex % activeAreas.length] : null;
  const displayedArea: PlayableZone | null = gameStarted ? activeZone : selectedZone;

  const livePrices = useMemo(() => {
    if (!zoneBounds) return [];
    return priceCells(strikes, zoneBounds, grid, nowMs);
  }, [strikes, zoneBounds, grid, nowMs]);
  livePricesRef.current = livePrices;

  const handleDominantCountry = useCallback((iso: string) => setDominantIso(iso), []);

  // ── selecting: scan the globe every SCAN_MS ─────────────────────────────────
  useEffect(() => {
    if (mode !== 'selecting') return;
    let alive = true;
    const scan = () => {
      getRecentStrikes(SEARCH_MINUTES, 20000)
        .then((res) => {
          if (!alive) return;
          const list = res.strikes as CountryStrike[];
          setStrikes(list);
          // Only the 3 hottest zones — most strikes in the last 60s (roundStrikes).
          const zones = detectZones(list, Date.now(), ZONE_CONFIG)
            .sort((a, b) => b.roundStrikes - a.roundStrikes)
            .slice(0, MAX_ZONES_SHOWN);
          setActiveAreas(zones);
          setZoneIndex((i) => (zones.length ? i % zones.length : 0));
          setNextScanAt(Date.now() + SCAN_MS);
        })
        .catch(() => undefined);
    };
    scan();
    const timer = window.setInterval(scan, SCAN_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [mode]);

  // ── session ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = useSessionStore.getState().init;
    if (useSessionStore.getState().status === 'loading') init();
    ensureGameSession().catch(() => undefined);
  }, []);

  // ── strike feed while playing: the active zone's bbox ───────────────────────
  const zb = activeZone?.bounds ?? null;
  const zoneKey = zb ? `${zb.minLat}|${zb.maxLat}|${zb.minLon}|${zb.maxLon}` : null;
  useEffect(() => {
    if (!zoneKey) return;
    const [minLat, maxLat, minLon, maxLon] = zoneKey.split('|').map(Number);
    const b = { minLat, maxLat, minLon, maxLon };
    let alive = true;
    const load = () => getStrikesInBounds(b, 90, 800).then((l) => alive && setStrikes(l)).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 900);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [zoneKey]);

  useEffect(() => {
    if (!zoneKey) {
      setCities([]);
      return;
    }
    const [minLat, maxLat, minLon, maxLon] = zoneKey.split('|').map(Number);
    let alive = true;
    getCitiesInBounds({ minLat, maxLat, minLon, maxLon }, 8).then((l) => alive && setCities(l)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [zoneKey]);

  // Per-zone weather (wind now; rain/CAPE at M3/M4). Cached server-side ~15 min,
  // so a 2-min client poll is cheap; refetches when the active zone changes.
  useEffect(() => {
    if (!zoneKey) {
      setWeather(null);
      return;
    }
    const [minLat, maxLat, minLon, maxLon] = zoneKey.split('|').map(Number);
    let alive = true;
    const load = () => getZoneWeather({ minLat, maxLat, minLon, maxLon }, 5).then((w) => alive && setWeather(w)).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 120_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [zoneKey]);

  // Storm-cell trajectory from our strike store (drift over the last ~10 min).
  useEffect(() => {
    if (!zoneKey) {
      setStormTrack(null);
      return;
    }
    const [minLat, maxLat, minLon, maxLon] = zoneKey.split('|').map(Number);
    let alive = true;
    const load = () => getStormTrack({ minLat, maxLat, minLon, maxLon }, 10).then((t) => alive && setStormTrack(t)).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [zoneKey]);

  // Radar reflectivity frame index (RainViewer via backend). Only polled while the
  // Radar layer is on; refreshes every 60s (frames update ~every 5-10 min). Tile
  // IMAGES load straight from the radar host (see radarTiles). Degrades to a
  // "data unavailable" state on provider/backend failure — game keeps working.
  useEffect(() => {
    if (!gameStarted || !layers.radar) return;
    let alive = true;
    const load = () =>
      getRadarFrames().then((idx) => {
        if (!alive) return;
        setRadarIndex(idx);
        setRadarUnavailable(!idx);
        setRadarFrameIdx((i) => (idx && idx.frames.length ? Math.min(i, idx.frames.length - 1) : 0));
      });
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [gameStarted, layers.radar]);

  // Total lightning (IC+CG, MTG-LI via backend). Polled while the layer is on and
  // a zone is active; ~30s cadence (leading indicator, updates fast). Degrades to
  // "data unavailable" on failure.
  useEffect(() => {
    if (!zoneKey || !layers.total) {
      setTotalLx(null);
      setTotalLxUnavailable(false);
      return;
    }
    const [minLat, maxLat, minLon, maxLon] = zoneKey.split('|').map(Number);
    let alive = true;
    const load = () =>
      getTotalLightning({ minLat, maxLat, minLon, maxLon }, 6).then((d) => {
        if (!alive) return;
        setTotalLx(d);
        setTotalLxUnavailable(!d);
      });
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [zoneKey, layers.total]);

  // Radar animation: always loop the recent frames while the layer is on.
  useEffect(() => {
    if (!layers.radar || !radarIndex || radarIndex.frames.length < 2) return;
    const timer = window.setInterval(() => {
      setRadarFrameIdx((i) => (i + 1) % radarIndex.frames.length);
    }, 550);
    return () => window.clearInterval(timer);
  }, [layers.radar, radarIndex]);

  // ── clock ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const timer = window.setInterval(() => setNowMs(Date.now()), 120);
    return () => window.clearInterval(timer);
  }, []);

  // First visit: offer the demo (once).
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(DEMO_SEEN_KEY)) setShowDemoPrompt(true);
    } catch {
      /* no storage */
    }
  }, []);
  const markDemoSeen = useCallback(() => {
    try {
      window.localStorage.setItem(DEMO_SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);
  const openDemo = useCallback(() => {
    setShowDemoPrompt(false);
    setShowDemo(true);
    markDemoSeen();
  }, [markDemoSeen]);
  const dismissPrompt = useCallback(() => {
    setShowDemoPrompt(false);
    markDemoSeen();
  }, [markDemoSeen]);

  // ── continuous strike counting: credit each new strike in a live bet's cell ──
  useEffect(() => {
    if (mode !== 'playing' || !zoneBounds || !betsRef.current.length) return;
    const now = nowMs;
    let creditDelta = 0;
    const hits = new Set<number>();
    let changed = false;
    const next = betsRef.current.map((bet) => {
      const windowEnd = Math.min(now, bet.expiresAt);
      if (now < bet.startedAt) return bet;
      let strikeCount = bet.strikes;
      let earned = bet.earned;
      for (const s of strikesRef.current) {
        const t = Date.parse(s.received_at);
        if (!Number.isFinite(t) || t < bet.startedAt || t > windowEnd) continue;
        const key = strikeKey(s);
        if (bet.countedKeys.has(key)) continue;
        if (cellForStrikeEqui(s.lat, s.lon, zoneBounds, grid) !== bet.cell) continue;
        bet.countedKeys.add(key);
        strikeCount += 1;
        const pay = bet.mult * bet.credits;
        earned += pay;
        creditDelta += pay;
        hits.add(bet.cell);
        changed = true;
      }
      return strikeCount !== bet.strikes ? { ...bet, strikes: strikeCount, earned } : bet;
    });
    if (changed) {
      setBets(next);
      setCredits((c) => c + creditDelta);
      setHitPulse(hits);
      window.setTimeout(() => setHitPulse(new Set()), 700);
    }
  }, [nowMs, mode, zoneBounds, grid]);

  useEffect(() => {
    if (!bets.length) return;
    const now = nowMs;
    const alive = bets.filter((b) => now <= b.expiresAt + BET_REVEAL_MS);
    if (alive.length !== bets.length) setBets(alive);
  }, [nowMs, bets]);

  // ── bot: open a bet every ~1.5–2.6s from the live prices (lib/grid-game/bot) ─
  useEffect(() => {
    if (mode !== 'playing') return;
    if (nowMs < botNextAtRef.current) return;
    const balance = botCreditsRef.current;
    const live = botBetsRef.current.filter((b) => nowMs <= b.expiresAt);
    const retry = () => {
      botNextAtRef.current = nowMs + 800;
    };
    if (balance < MIN_BET || live.length >= BOT_CONFIG.maxConcurrent || !livePricesRef.current.length) {
      retry();
      return;
    }
    const occupied = new Set(live.map((b) => b.cell));
    const dec = pickBotBet(livePricesRef.current, balance, live.length, BOT_CONFIG, undefined, occupied);
    if (!dec) {
      retry();
      return;
    }
    const mult = livePricesRef.current[dec.cell]?.multiplier ?? PRICING_CONFIG.multMin;
    const t = Date.now();
    botBetIdRef.current += 1;
    const bet: Bet = {
      id: botBetIdRef.current,
      cell: dec.cell,
      credits: dec.credits,
      mult,
      startedAt: t,
      expiresAt: t + BET_WINDOW_MS,
      strikes: 0,
      earned: 0,
      countedKeys: new Set(),
    };
    setBotBets((cur) => [...cur, bet]);
    setBotCredits((c) => c - dec.credits);
    botNextAtRef.current = nowMs + nextBotDelay(BOT_CONFIG);
  }, [nowMs, mode]);

  // ── bot: credit each new strike landing in one of its live bets' cells ──────
  useEffect(() => {
    if (mode !== 'playing' || !zoneBounds || !botBetsRef.current.length) return;
    const now = nowMs;
    let delta = 0;
    let changed = false;
    const next = botBetsRef.current.map((bet) => {
      const windowEnd = Math.min(now, bet.expiresAt);
      if (now < bet.startedAt) return bet;
      let strikeCount = bet.strikes;
      let earned = bet.earned;
      for (const s of strikesRef.current) {
        const t = Date.parse(s.received_at);
        if (!Number.isFinite(t) || t < bet.startedAt || t > windowEnd) continue;
        const key = strikeKey(s);
        if (bet.countedKeys.has(key)) continue;
        if (cellForStrikeEqui(s.lat, s.lon, zoneBounds, grid) !== bet.cell) continue;
        bet.countedKeys.add(key);
        strikeCount += 1;
        const pay = bet.mult * bet.credits;
        earned += pay;
        delta += pay;
        changed = true;
      }
      return strikeCount !== bet.strikes ? { ...bet, strikes: strikeCount, earned } : bet;
    });
    if (changed) {
      setBotBets(next);
      setBotCredits((c) => c + delta);
    }
  }, [nowMs, mode, zoneBounds, grid]);

  useEffect(() => {
    if (!botBets.length) return;
    const now = nowMs;
    const alive = botBets.filter((b) => now <= b.expiresAt + BET_REVEAL_MS);
    if (alive.length !== botBets.length) setBotBets(alive);
  }, [nowMs, botBets]);

  useEffect(() => {
    setPeak((p) => Math.max(p, credits));
  }, [credits]);
  useEffect(() => {
    if (gameOver || mode !== 'playing') return;
    // Hard 60s limit: the round ends when the clock runs out …
    if (roundEndsAt != null && nowMs >= roundEndsAt) {
      setGameOver(true);
      return;
    }
    // … or earlier if the player runs out of credits with no live bet left.
    const hasLive = bets.some((b) => nowMs <= b.expiresAt);
    if (credits < MIN_BET && !hasLive) setGameOver(true);
  }, [nowMs, credits, bets, mode, gameOver, roundEndsAt]);

  // ── bet actions ──────────────────────────────────────────────────────────────
  const onCellClick = useCallback(
    (cell: number) => {
      if (mode !== 'playing') return;
      if (betsRef.current.some((b) => b.cell === cell)) return;
      if (credits < MIN_BET) return;
      setPendingCell(cell);
      setPendingAmount(Math.min(Math.max(MIN_BET, 1), Math.floor(credits)));
    },
    [mode, credits],
  );
  const setAmount = useCallback(
    (amount: number) => setPendingAmount(Math.max(MIN_BET, Math.min(Math.floor(credits), Math.round(amount)))),
    [credits],
  );
  const placeBet = useCallback(() => {
    if (pendingCell == null) return;
    const amount = Math.max(MIN_BET, Math.min(Math.floor(credits), pendingAmount));
    if (amount < MIN_BET || amount > credits) return;
    const mult = livePrices[pendingCell]?.multiplier ?? PRICING_CONFIG.multMin;
    const now = Date.now();
    betIdRef.current += 1;
    const bet: Bet = {
      id: betIdRef.current,
      cell: pendingCell,
      credits: amount,
      mult,
      startedAt: now,
      expiresAt: now + BET_WINDOW_MS,
      strikes: 0,
      earned: 0,
      countedKeys: new Set(),
    };
    setBets((cur) => [...cur, bet]);
    setCredits((c) => c - amount);
    setPendingCell(null);
  }, [pendingCell, pendingAmount, credits, livePrices]);
  const cancelBet = useCallback(() => setPendingCell(null), []);

  const resetGame = useCallback(() => {
    setCredits(START_CREDITS);
    setPeak(START_CREDITS);
    setBets([]);
    setPendingCell(null);
    setGameOver(false);
    setRoundEndsAt(Date.now() + GAME_DURATION_MS); // start the 60s clock
    setHitPulse(new Set());
    // reset the bot opponent and stagger its first bet a beat after the start
    setBotCredits(START_CREDITS);
    setBotBets([]);
    botCreditsRef.current = START_CREDITS;
    botBetsRef.current = [];
    botNextAtRef.current = Date.now() + nextBotDelay(BOT_CONFIG);
  }, []);

  const onPlay = useCallback(() => {
    if (!selectedZone) return;
    setLoading(true);
    resetGame();
    setDominantIso('');
    ensureGameSession().catch(() => undefined);
    setActiveZone(selectedZone);
    setLoading(false);
  }, [selectedZone, resetGame]);

  const playAgain = useCallback(() => resetGame(), [resetGame]);
  const newStorm = useCallback(() => {
    setActiveZone(null);
    setDominantIso('');
    resetGame();
  }, [resetGame]);

  const selectPrevious = () => {
    if (mode !== 'selecting' || !activeAreas.length) return;
    setZoneIndex((i) => (i - 1 + activeAreas.length) % activeAreas.length);
  };
  const selectNext = () => {
    if (mode !== 'selecting' || !activeAreas.length) return;
    setZoneIndex((i) => (i + 1) % activeAreas.length);
  };

  const secondsToScan = mounted ? Math.max(0, Math.min(SCAN_MS / 1000, Math.ceil((nextScanAt - nowMs) / 1000))) : SCAN_MS / 1000;
  const activeBetCount = bets.filter((b) => nowMs <= b.expiresAt).length;
  const secondsLeft = roundEndsAt != null
    ? Math.max(0, Math.ceil((roundEndsAt - nowMs) / 1000))
    : GAME_DURATION_MS / 1000;

  const radarFrames = radarIndex?.frames ?? [];
  const curRadarFrame = radarFrames.length ? radarFrames[Math.min(radarFrameIdx, radarFrames.length - 1)] : null;
  const radar: RadarLayer = {
    on: !!layers.radar,
    frame: radarIndex && curRadarFrame ? { host: radarIndex.host, path: curRadarFrame.path, size: radarIndex.size, color: radarIndex.color, options: radarIndex.options } : null,
    unavailable: radarUnavailable,
    frameTime: curRadarFrame?.time ?? null,
  };

  return (
    <main className="min-h-svh overflow-hidden bg-storm px-4 pb-8 pt-24 text-white sm:px-6">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
            Back to globe
          </Link>
          <button type="button" onClick={() => setShowDemo(true)} className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20">
            How to play
          </button>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/50">Lightning Map Game</div>
          <div className="font-display text-2xl font-black">Grid Game</div>
        </div>
      </div>

      {showDemoPrompt && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={dismissPrompt}>
          <div className="glass w-full max-w-[380px] rounded-3xl border border-white/12 bg-slate-950/85 p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl">⚡</div>
            <div className="font-display mt-2 text-xl font-black text-white">New to the Grid Game?</div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">Bet credits on where lightning strikes next. Take a quick 5-step tour before you play.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={openDemo} className="btn-glow rounded-xl px-4 py-2.5 text-sm font-black">Watch the demo</button>
              <button type="button" onClick={dismissPrompt} className="rounded-xl px-4 py-2 text-sm font-semibold text-white/50 transition hover:text-white">Skip, I&apos;ll figure it out</button>
            </div>
          </div>
        </div>
      )}

      {showDemo && <GridGameDemo onClose={() => setShowDemo(false)} />}

      <div className={`mx-auto grid max-w-[1500px] gap-4 transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${gameStarted ? 'lg:grid-cols-[320px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_360px]'}`}>
        {gameStarted && (
          <div className="animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]">
            <SidePanel
              countryIso={dominantIso}
              credits={credits}
              peak={peak}
              activeBets={activeBetCount}
              strikes={strikes}
              layers={layers}
              onToggleLayer={toggleLayer}
            />
          </div>
        )}

        <div className={`relative min-h-[620px] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${gameStarted ? 'lg:translate-x-2' : ''}`}>
          <ZoneMap
            strikes={strikes}
            mode={mode}
            area={displayedArea}
            grid={displayedArea ? displayedArea.grid : grid}
            cities={cities}
            activeAreaCount={activeAreas.length}
            zoneIndex={activeAreas.length ? zoneIndex % activeAreas.length : 0}
            secondsToScan={secondsToScan}
            secondsLeft={secondsLeft}
            botCredits={botCredits}
            botBets={botBets}
            radar={radar}
            loading={loading}
            onPlay={onPlay}
            now={nowMs}
            credits={credits}
            peak={peak}
            bets={bets}
            livePrices={livePrices}
            pendingCell={pendingCell}
            pendingAmount={pendingAmount}
            showDensity={!!layers.density}
            showWind={!!layers.wind}
            showRain={!!layers.rain}
            showRisk={!!layers.risk}
            showTracks={!!layers.tracks}
            showTotal={!!layers.total}
            totalLx={totalLx}
            totalLxUnavailable={totalLxUnavailable}
            weather={weather}
            stormTrack={stormTrack}
            hitPulse={hitPulse}
            onCellClick={onCellClick}
            onSetAmount={setAmount}
            onPlaceBet={placeBet}
            onCancelBet={cancelBet}
            onPlayAgain={playAgain}
            onNewStorm={newStorm}
            onDominantCountry={handleDominantCountry}
          />
          <button type="button" onClick={selectPrevious} disabled={mode !== 'selecting'} className={`absolute left-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35 ${gameStarted ? 'pointer-events-none opacity-0' : ''}`} aria-label="Previous zone">‹</button>
          <button type="button" onClick={selectNext} disabled={mode !== 'selecting'} className={`absolute right-4 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-3xl text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-35 ${gameStarted ? 'pointer-events-none opacity-0' : ''}`} aria-label="Next zone">›</button>
        </div>

        {!gameStarted && (
          <aside className="pointer-events-auto z-10 w-full max-w-[360px] space-y-4">
            <div className="glass rounded-3xl border border-cyan-200/15 bg-cyan-200/10 p-4 shadow-2xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/60">Live storm zones</div>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-display text-4xl font-black text-bolt">{activeAreas.length}</span>
                <span className="mb-1 text-sm font-semibold text-white/50">hottest zones on Earth right now</span>
              </div>
              {selectedZone && (
                <div className="mt-3 rounded-xl bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/35">Zone {activeAreas.length ? (zoneIndex % activeAreas.length) + 1 : 0} / {activeAreas.length}</div>
                  <div className="font-display mt-0.5 text-lg font-black text-white">
                    {dominantIso ? `${flagEmoji(dominantIso)} ${countryName(dominantIso)}` : '🌊 Open water'}
                  </div>
                  <div className="mt-1 text-xs text-white/45">~{selectedZone.roundStrikes} strikes/min · {Math.round(selectedZone.widthKm)} km wide</div>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-white/45">Use ‹ › to browse the hottest storms on Earth right now, then Play the one you like.</p>
            </div>
            <div className="glass rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/60">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/60">Continuous betting</div>
              <p className="mt-2">
                Start with <span className="font-bold text-white">{START_CREDITS} credits</span> and{' '}
                <span className="font-bold text-white">60 seconds</span>. Click any grid cell, stake some credits, and every
                strike that lands there pays its <span className="text-bolt">multiplier</span> × your stake. Cold cells pay the
                most — bet where the storm is <span className="text-cyan-200">heading</span>. A <span className="text-fuchsia-200">🤖 bot</span> plays
                the same storm — finish the 60s with more credits than it to win. Hit 0 and it&apos;s game over.
              </p>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
