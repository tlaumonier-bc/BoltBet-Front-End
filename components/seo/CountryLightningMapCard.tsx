'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LocalePage } from '@/lib/content/content-types';
import { boundsForLocale, type Bounds } from '@/lib/map/countryBounds';
import { getCountryMapStats, type CountryMapStatsResponse } from '@/lib/api';

type MapMode = 'cities' | 'heat';

type Copy = {
  eyebrow: string;
  title: (country: string) => string;
  description: string;
  cities: string;
  heat: string;
  loading: string;
  empty: string;
  topCities: string;
  strikes: string;
  latestStrikes: (count: number) => string;
  radius: string;
  attribution: string;
};

const COPY: Record<string, Copy> = {
  en: {
    eyebrow: 'Country lightning map',
    title: (country) => `Lightning hotspots in ${country}`,
    description: 'Switch between the most-struck major cities and a heatmap of the latest detected strikes.',
    cities: 'Top cities',
    heat: 'Heatmap',
    loading: 'Loading country map…',
    empty: 'Not enough lightning data yet for this country map.',
    topCities: 'Most-struck cities',
    strikes: 'strikes',
    latestStrikes: (count) => `${count.toLocaleString()} latest strikes`,
    radius: '20 km city radius',
    attribution: 'Map tiles © CARTO © OpenStreetMap contributors',
  },
  fr: {
    eyebrow: 'Carte foudre du pays',
    title: (country) => `Zones de foudre en ${country}`,
    description: 'Basculez entre les grandes villes les plus touchées et une heatmap des derniers impacts détectés.',
    cities: 'Top villes',
    heat: 'Heatmap',
    loading: 'Chargement de la carte…',
    empty: 'Pas encore assez de données foudre pour cette carte.',
    topCities: 'Villes les plus touchées',
    strikes: 'impacts',
    latestStrikes: (count) => `${count.toLocaleString()} derniers impacts`,
    radius: 'rayon ville 20 km',
    attribution: 'Tuiles © CARTO © contributeurs OpenStreetMap',
  },
  es: {
    eyebrow: 'Mapa de rayos del país',
    title: (country) => `Zonas de rayos en ${country}`,
    description: 'Cambia entre las ciudades más afectadas y un mapa de calor de los últimos rayos detectados.',
    cities: 'Ciudades',
    heat: 'Mapa de calor',
    loading: 'Cargando mapa…',
    empty: 'Aún no hay suficientes datos para este mapa.',
    topCities: 'Ciudades más afectadas',
    strikes: 'rayos',
    latestStrikes: (count) => `${count.toLocaleString()} últimos rayos`,
    radius: 'radio urbano 20 km',
    attribution: 'Map tiles © CARTO © OpenStreetMap contributors',
  },
  de: {
    eyebrow: 'Blitzkarte des Landes',
    title: (country) => `Blitz-Hotspots in ${country}`,
    description: 'Wechseln Sie zwischen den meistgetroffenen Großstädten und einer Heatmap der neuesten Blitze.',
    cities: 'Top-Städte',
    heat: 'Heatmap',
    loading: 'Karte wird geladen…',
    empty: 'Noch nicht genug Blitzdaten für diese Karte.',
    topCities: 'Meistgetroffene Städte',
    strikes: 'Blitze',
    latestStrikes: (count) => `${count.toLocaleString()} neueste Blitze`,
    radius: '20 km Stadtradius',
    attribution: 'Kartendaten © CARTO © OpenStreetMap-Mitwirkende',
  },
};

const TILE_SIZE = 256;

function copyFor(page: LocalePage, translated: boolean): Copy {
  if (translated) return COPY.en;
  return COPY[page.locale.toLowerCase()] ?? COPY.en;
}

function clampLat(lat: number): number {
  return Math.max(-85.0511, Math.min(85.0511, lat));
}

function zoomForBounds(bounds: Bounds): number {
  const lonSpan = Math.abs(bounds.maxLon - bounds.minLon);
  const latSpan = Math.abs(bounds.maxLat - bounds.minLat);
  const span = Math.max(lonSpan, latSpan);
  if (span > 75) return 3;
  if (span > 32) return 4;
  if (span > 14) return 5;
  if (span > 7) return 6;
  if (span > 3.5) return 7;
  return 8;
}

function paddedBounds(bounds: Bounds): Bounds {
  const lonPad = Math.max(0.8, Math.abs(bounds.maxLon - bounds.minLon) * 0.18);
  const latPad = Math.max(0.5, Math.abs(bounds.maxLat - bounds.minLat) * 0.18);
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

function viewport(bounds: Bounds) {
  const padded = paddedBounds(bounds);
  const zoom = zoomForBounds(padded);
  const nw = worldPoint(padded.maxLat, padded.minLon, zoom);
  const se = worldPoint(padded.minLat, padded.maxLon, zoom);
  const width = Math.max(1, se.x - nw.x);
  const height = Math.max(1, se.y - nw.y);
  const side = Math.max(width, height);
  const centerX = (nw.x + se.x) / 2;
  const centerY = (nw.y + se.y) / 2;
  return {
    zoom,
    left: centerX - side / 2,
    top: centerY - side / 2,
    size: side,
  };
}

function project(bounds: Bounds, lat: number, lon: number) {
  const view = viewport(bounds);
  const p = worldPoint(lat, lon, view.zoom);
  return {
    x: ((p.x - view.left) / view.size) * 100,
    y: ((p.y - view.top) / view.size) * 100,
  };
}

function mapTiles(bounds: Bounds) {
  const view = viewport(bounds);
  const minX = Math.floor(view.left / TILE_SIZE);
  const maxX = Math.floor((view.left + view.size) / TILE_SIZE);
  const minY = Math.floor(view.top / TILE_SIZE);
  const maxY = Math.floor((view.top + view.size) / TILE_SIZE);
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({
        key: `${view.zoom}-${x}-${y}`,
        src: `https://basemaps.cartocdn.com/light_all/${view.zoom}/${x}/${y}.png`,
        left: ((x * TILE_SIZE - view.left) / view.size) * 100,
        top: ((y * TILE_SIZE - view.top) / view.size) * 100,
        width: (TILE_SIZE / view.size) * 100,
        height: (TILE_SIZE / view.size) * 100,
      });
    }
  }
  return tiles;
}

function heatCells(stats: CountryMapStatsResponse | null, bounds: Bounds) {
  if (!stats) return [];
  const cells = new Map<string, { x: number; y: number; count: number }>();
  for (const strike of stats.strikes) {
    const p = project(bounds, strike.lat, strike.lon);
    if (p.x < -5 || p.x > 105 || p.y < -5 || p.y > 105) continue;
    const gx = Math.floor(p.x / 4);
    const gy = Math.floor(p.y / 4);
    const key = `${gx}:${gy}`;
    const cell = cells.get(key) ?? { x: gx * 4 + 2, y: gy * 4 + 2, count: 0 };
    cell.count += 1;
    cells.set(key, cell);
  }
  const max = Math.max(1, ...Array.from(cells.values(), (cell) => cell.count));
  return Array.from(cells.values()).map((cell) => ({
    ...cell,
    ratio: cell.count / max,
  }));
}

export default function CountryLightningMapCard({ page, translated = false }: { page: LocalePage; translated?: boolean }) {
  const [mode, setMode] = useState<MapMode>('cities');
  const [stats, setStats] = useState<CountryMapStatsResponse | null>(null);
  const [error, setError] = useState(false);
  const copy = copyFor(page, translated);
  const bounds = boundsForLocale(page.locale);
  const tiles = useMemo(() => mapTiles(bounds), [bounds]);
  const heat = useMemo(() => heatCells(stats, bounds), [stats, bounds]);
  const maxCityStrikes = Math.max(1, ...(stats?.cities ?? []).map((city) => city.strikes));

  useEffect(() => {
    let alive = true;
    setError(false);
    getCountryMapStats({ country: page.locale.toUpperCase(), strikeLimit: 10000, period: 'all' })
      .then((data) => {
        if (alive) setStats(data);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [page.locale]);

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl sm:mt-10">
      <div className="border-b border-white/10 bg-linear-to-r from-electric/10 via-white/[0.03] to-bolt/10 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-electric/80 sm:text-xs">
              {copy.eyebrow}
            </p>
            <h2 className="font-display mt-1 text-xl font-bold sm:text-2xl">
              {copy.title(translated ? page.country : bounds.label)}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              {copy.description}
            </p>
          </div>
          <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
            {(['cities', 'heat'] as MapMode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold transition ${
                  mode === value ? 'bg-bolt text-black' : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
              >
                {value === 'cities' ? copy.cities : copy.heat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-stretch gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 lg:h-auto">
          <div className="absolute inset-0 opacity-95 saturate-[0.9]">
            {tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.src}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute select-none"
                style={{
                  left: `${tile.left}%`,
                  top: `${tile.top}%`,
                  width: `${tile.width}%`,
                  height: `${tile.height}%`,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(250,204,21,0.08),transparent_42%),linear-gradient(to_bottom,rgba(2,6,23,0.04),rgba(2,6,23,0.38))]" />

          {mode === 'heat' && (
            <div className="absolute inset-0">
              {heat.map((cell) => (
                <span
                  key={`${cell.x}:${cell.y}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                  style={{
                    left: `${cell.x}%`,
                    top: `${cell.y}%`,
                    width: `${18 + cell.ratio * 54}px`,
                    height: `${18 + cell.ratio * 54}px`,
                    background: `rgba(250, ${Math.round(120 + cell.ratio * 120)}, 21, ${0.14 + cell.ratio * 0.46})`,
                    boxShadow: `0 0 ${18 + cell.ratio * 28}px rgba(250, 204, 21, ${0.22 + cell.ratio * 0.3})`,
                  }}
                  title={`${cell.count} ${copy.strikes}`}
                />
              ))}
            </div>
          )}

          {mode === 'cities' && stats?.cities.map((city, index) => {
            const p = project(bounds, city.lat, city.lon);
            const ratio = city.strikes / maxCityStrikes;
            return (
              <div
                key={city.city_id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <div
                  className="grid place-items-center rounded-full border border-black/30 bg-bolt font-display text-xs font-black text-black shadow-[0_0_28px_rgba(250,204,21,0.55)]"
                  style={{ width: `${26 + ratio * 20}px`, height: `${26 + ratio * 20}px` }}
                  title={`${city.city_name}: ${city.strikes.toLocaleString()} ${copy.strikes}`}
                >
                  {index + 1}
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] text-white/65 backdrop-blur">
            {stats ? copy.latestStrikes(stats.strikeCount) : copy.loading}
          </div>
          <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] text-white/45 backdrop-blur">
            {copy.attribution}
          </div>
        </div>

        <aside className="min-h-[420px] rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-bold">
              {mode === 'cities' ? copy.topCities : copy.heat}
            </h3>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/45">
              {copy.radius}
            </span>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-white/45">{copy.empty}</p>
          ) : !stats ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-9 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : mode === 'cities' ? (
            <div className="mt-4 space-y-2">
              {stats.cities.map((city, index) => (
                <div key={city.city_id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-bolt text-[11px] font-black text-black">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white/85">{city.city_name}</div>
                    <div className="text-[10px] text-white/35">
                      {city.population.toLocaleString()} pop.
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums text-bolt">{city.strikes.toLocaleString()}</div>
                    <div className="text-[10px] text-white/35">{copy.strikes}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/[0.04] p-4">
              <div className="font-display text-3xl font-extrabold text-bolt">
                {stats.strikeCount.toLocaleString()}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {copy.latestStrikes(stats.strikeCount)} projected as density clusters across {bounds.label}.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
