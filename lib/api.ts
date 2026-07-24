// lib/api.ts — REST client for the BoltBet strike-prediction game backend.
import { sessionToken } from '@/store/sessionStore';

const API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const STRIKES_API = (process.env.NEXT_PUBLIC_STRIKES_API_URL || API).replace(/\/$/, '');
export const LEADERBOARD_API = (process.env.NEXT_PUBLIC_LEADERBOARD_API_URL || API).replace(/\/$/, '');
export const TROPHIES: Trophy[] = [
  { key: 'bolt-tracker', points: 200, image: 'trophy-200.png', label: 'Bolt Tracker Trophy' },
  { key: 'could-reader', points: 500, image: 'trophy-500.png', label: 'Could Reader Trophy' },
  { key: 'strike-predictor', points: 1000, image: 'trophy-1000.png', label: 'Strike predictor Trophy' },
  { key: 'tempest-watcher', points: 10000, image: 'trophy-10000.png', label: 'Tempest Watcher Trophy' },
  { key: 'lightning-lord', points: 100000, image: 'trophy-100000.png', label: 'Lightning Lord Trophy' },
];
const TROPHY_BY_POINTS = new Map(TROPHIES.map((trophy) => [trophy.points, trophy]));

/**
 * Server-authoritative game is OFF until the backend ships. While off, the
 * client runs the Up/Down game locally and these endpoints are never called.
 * Set NEXT_PUBLIC_GAME_SERVER=1 to route identity, bets, balances, resolution
 * and the leaderboard onto the backend.
 */
export const GAME_SERVER_ENABLED = process.env.NEXT_PUBLIC_GAME_SERVER === '1';

function csrf(): string {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

/** Identity header: the session token is the authoritative identity. */
function authHeaders(): Record<string, string> {
  const t = sessionToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf(), ...authHeaders() },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

// ── strike feeds (public, no auth) ───────────────────────────────────────────
export interface RecentStrike {
  lat: number;
  lon: number;
  quality: string;
  timestamp: string;
  received_at: string;
  country?: string | null;
}

export interface RecentStrikesResponse {
  minutes: number;
  older_than?: number;
  count: number;
  strikes: RecentStrike[];
}

export interface NearbyStrike extends RecentStrike {
  distance_km: number;
}

export interface NearbyStrikesResponse {
  lat: number;
  lon: number;
  minutes: number;
  limit: number;
  radius_km: number;
  count: number;
  strikes: NearbyStrike[];
}

export interface MinuteBucket {
  minute: string;
  count: number;
}

export interface StrikesPerMinuteResponse {
  minutes: number;
  series: MinuteBucket[];
}

export interface CountryStrike {
  lat: number;
  lon: number;
  timestamp: string;
  quality: string;
  received_at: string;
}

export interface CountryStrikeMeta {
  country: string;
  limit: number;
  lastHour: number;
  cappedLastHour: boolean;
}

export interface CountryStrikesResult {
  strikes: CountryStrike[];
  meta: CountryStrikeMeta | null;
}

export interface WeatherNow {
  tempC: number;
  clouds: number;
  windKph: number;
  humidity: number;
  main: string;
  icon: string;
  country?: string;
}

export interface CountryNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface CountryNewsResponse {
  country: string;
  lang: string;
  query: string;
  fetchedAt: string;
  articles: CountryNewsArticle[];
}

export interface CountryMapCity {
  city_id: string;
  city_name: string;
  country: string;
  lat: number;
  lon: number;
  population: number;
  strikes: number;
}

export interface CountryMapStrike {
  lat: number;
  lon: number;
  quality: string;
  received_at: string;
}

export interface CountryMapStatsResponse {
  country: string;
  period: 'all' | 'year' | 'month' | 'day';
  cityRadiusKm: number;
  cityCount: number;
  strikeLimit: number;
  strikeCount: number;
  cities: CountryMapCity[];
  strikes: CountryMapStrike[];
}

export async function getRecentStrikes(
  minutes: number,
  limit = 5000,
  olderThan = 0,
  opts: { after?: string; downsample?: number } = {},
): Promise<RecentStrikesResponse> {
  const q = new URLSearchParams({
    minutes: String(minutes),
    limit: String(limit),
    older_than: String(olderThan),
  });
  if (opts.after) q.set('after', opts.after);
  if (opts.downsample && opts.downsample > 1) q.set('downsample', String(opts.downsample));
  const res = await fetch(`${STRIKES_API}/api/strikes/recent/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`recent strikes ${res.status}`);
  return res.json();
}

export async function getNearbyStrikes(params: {
  lat: number;
  lon: number;
  minutes?: number;
  limit?: number;
  radiusKm?: number;
}): Promise<NearbyStrikesResponse> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    minutes: String(params.minutes ?? 60),
    limit: String(params.limit ?? 30),
    radius_km: String(params.radiusKm ?? 2500),
  });
  const res = await fetch(`${STRIKES_API}/api/strikes/nearby/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`nearby strikes ${res.status}`);
  return res.json();
}

export async function getStrikesPerMinute(minutes = 15): Promise<StrikesPerMinuteResponse> {
  const q = new URLSearchParams({ minutes: String(minutes) });
  const res = await fetch(`${API}/api/strikes/per-minute/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`per-minute ${res.status}`);
  return res.json();
}

export async function getCountryStrikesResult(country: string, limit = 10000): Promise<CountryStrikesResult> {
  const q = new URLSearchParams({ country, limit: String(limit) });
  const res = await fetch(`${STRIKES_API}/api/strikes/by-country/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`country strikes ${res.status}`);
  const data = (await res.json()) as Record<string, CountryStrike[] | CountryStrikeMeta | undefined>;
  const key = country.toUpperCase();
  const meta = data._meta as CountryStrikeMeta | undefined;
  return {
    strikes: (data[key] as CountryStrike[] | undefined) ?? [],
    meta: meta ?? null,
  };
}

export async function getCountryStrikes(country: string, limit = 10000): Promise<CountryStrike[]> {
  const result = await getCountryStrikesResult(country, limit);
  return result.strikes;
}

/** Recent strikes inside a lat/lon box (for feeding a zoomed grid-game zone). */
export async function getStrikesInBounds(
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  seconds = 90,
  limit = 800,
): Promise<CountryStrike[]> {
  const q = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLon: String(bounds.minLon),
    maxLon: String(bounds.maxLon),
    seconds: String(seconds),
    limit: String(limit),
  });
  const res = await fetch(`${STRIKES_API}/api/strikes/in-bounds/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`strikes in-bounds ${res.status}`);
  const data = (await res.json()) as { strikes?: CountryStrike[] };
  return data.strikes ?? [];
}

export interface CityLabel {
  name: string;
  admin1: string;
  cc: string;
  lat: number;
  lon: number;
}

/** Town/city labels within a lat/lon box (to show where a play zone is). */
export async function getCitiesInBounds(
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  limit = 8,
): Promise<CityLabel[]> {
  const q = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLon: String(bounds.minLon),
    maxLon: String(bounds.maxLon),
    limit: String(limit),
  });
  const res = await fetch(`${STRIKES_API}/api/cities/in-bounds/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`cities in-bounds ${res.status}`);
  const data = (await res.json()) as { cities?: CityLabel[] };
  return data.cities ?? [];
}

// ── Grid-game map layers: per-zone weather (Open-Meteo via backend, cached) ───
export interface ZoneWeatherPoint {
  lat: number;
  lon: number;
  precip: number | null;
  rain: number | null;
  windSpeed: number | null;
  windDir: number | null;
  gust: number | null;
  cape: number | null;
}
export interface ZoneWeather {
  sampledAt: string | null;
  model: string;
  points: ZoneWeatherPoint[];
  summary: {
    capeMax: number | null;
    capeAvg: number | null;
    precipMax: number | null;
    windAvg: number | null;
    windDir: number | null;
  };
}

/** Rain / wind / CAPE sampled over a zone bbox (powers the Rain, Wind and
 *  Storm-risk layers). Primary path is the cached backend proxy
 *  (GET /api/weather/zone/); if that's unavailable it falls back to calling
 *  Open-Meteo directly from the browser (no key, CORS-open) so the layer still
 *  works before the backend is deployed. Same sampling as lightning/weather.py. */
export async function getZoneWeather(
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  n = 4,
): Promise<ZoneWeather> {
  const q = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLon: String(bounds.minLon),
    maxLon: String(bounds.maxLon),
    n: String(n),
  });
  try {
    const res = await fetch(`${STRIKES_API}/api/weather/zone/?${q}`, { cache: 'no-store' });
    if (res.ok) return (await res.json()) as ZoneWeather;
  } catch {
    /* backend not reachable — fall through to the direct provider */
  }
  return openMeteoZoneDirect(bounds, n);
}

// ── Grid-game map layers: storm-cell trajectory (from our strike store) ───────
export interface StormTrack {
  heading: number | null;
  compass: string | null;
  speedKmh: number;
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  projected: { lat: number; lon: number };
  olderSamples: number;
  recentSamples: number;
}

const COMPASS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function computeTrackClient(
  points: { lat: number; lon: number; t: number }[],
  nowMs: number,
  windowMs: number,
  projectMs = 300_000,
  minPerHalf = 3,
): StormTrack | null {
  const mid = nowMs - windowMs / 2;
  const older: { lat: number; lon: number }[] = [];
  const recent: { lat: number; lon: number }[] = [];
  for (const p of points) {
    if (p.t < nowMs - windowMs || p.t > nowMs) continue;
    (p.t >= mid ? recent : older).push({ lat: p.lat, lon: p.lon });
  }
  if (older.length < minPerHalf || recent.length < minPerHalf) return null;
  const cen = (rows: { lat: number; lon: number }[]) => ({
    lat: rows.reduce((a, r) => a + r.lat, 0) / rows.length,
    lon: rows.reduce((a, r) => a + r.lon, 0) / rows.length,
  });
  const o = cen(older);
  const r = cen(recent);
  const dtS = windowMs / 2 / 1000;
  const cos = Math.max(0.01, Math.cos((r.lat * Math.PI) / 180));
  const dNorth = (r.lat - o.lat) * 111.32;
  const dEast = (r.lon - o.lon) * 111.32 * cos;
  const dist = Math.hypot(dNorth, dEast);
  const speedKmh = dtS > 0 ? (dist / dtS) * 3600 : 0;
  const heading = dist > 1e-6 ? ((Math.atan2(dEast, dNorth) * 180) / Math.PI + 360) % 360 : null;
  const scale = projectMs / (windowMs / 2);
  return {
    heading: heading != null ? Math.round(heading) : null,
    compass: heading != null ? COMPASS8[Math.round(heading / 45) % 8] : null,
    speedKmh: Math.round(speedKmh * 10) / 10,
    from: { lat: o.lat, lon: o.lon },
    to: { lat: r.lat, lon: r.lon },
    projected: { lat: r.lat + (r.lat - o.lat) * scale, lon: r.lon + (r.lon - o.lon) * scale },
    olderSamples: older.length,
    recentSamples: recent.length,
  };
}

/** Storm-cell trajectory & speed for a zone (from our strike store). Backend:
 *  GET /api/weather/storm-track/; falls back to computing from the strike feed
 *  client-side. Returns null while a storm is too new to have a motion history. */
export async function getStormTrack(
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  minutes = 10,
): Promise<StormTrack | null> {
  const q = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLon: String(bounds.minLon),
    maxLon: String(bounds.maxLon),
    minutes: String(minutes),
  });
  try {
    const res = await fetch(`${STRIKES_API}/api/weather/storm-track/?${q}`, { cache: 'no-store' });
    if (res.ok) return ((await res.json()) as { track: StormTrack | null }).track ?? null;
  } catch {
    /* fall through to client-side computation */
  }
  try {
    const strikes = await getStrikesInBounds(bounds, minutes * 60, 3000);
    const pts = strikes.map((s) => ({ lat: s.lat, lon: s.lon, t: Date.parse(s.received_at) })).filter((s) => Number.isFinite(s.t));
    return computeTrackClient(pts, Date.now(), minutes * 60_000);
  } catch {
    return null;
  }
}

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

function capeForHour(loc: { current?: { time?: string }; hourly?: { time?: string[]; cape?: (number | null)[] } }): number | null {
  const times = loc.hourly?.time ?? [];
  const capes = loc.hourly?.cape ?? [];
  const prefix = (loc.current?.time ?? '').slice(0, 13);
  for (let i = 0; i < times.length; i += 1) if (times[i].startsWith(prefix) && capes[i] != null) return capes[i] ?? null;
  return capes.find((v) => v != null) ?? null;
}

async function openMeteoZoneDirect(
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  n: number,
): Promise<ZoneWeather> {
  const count = Math.max(2, Math.min(6, Math.round(n)));
  const lats: string[] = [];
  const lons: string[] = [];
  for (let r = 0; r < count; r += 1) {
    const lat = bounds.minLat + ((r + 0.5) / count) * (bounds.maxLat - bounds.minLat);
    for (let c = 0; c < count; c += 1) {
      lats.push(lat.toFixed(4));
      lons.push((bounds.minLon + ((c + 0.5) / count) * (bounds.maxLon - bounds.minLon)).toFixed(4));
    }
  }
  const q = new URLSearchParams({
    latitude: lats.join(','),
    longitude: lons.join(','),
    current: 'precipitation,rain,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'cape',
    models: 'gfs_seamless',
    forecast_days: '1',
    timezone: 'UTC',
  });
  const res = await fetch(`${OPEN_METEO}?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data = await res.json();
  const locs = (Array.isArray(data) ? data : [data]) as {
    latitude: number; longitude: number;
    current?: { time?: string; precipitation?: number; rain?: number; wind_speed_10m?: number; wind_direction_10m?: number; wind_gusts_10m?: number };
    hourly?: { time?: string[]; cape?: (number | null)[] };
  }[];
  let sampledAt: string | null = null;
  const points: ZoneWeatherPoint[] = locs.map((loc) => {
    const cur = loc.current ?? {};
    sampledAt = sampledAt ?? cur.time ?? null;
    return {
      lat: loc.latitude,
      lon: loc.longitude,
      precip: cur.precipitation ?? null,
      rain: cur.rain ?? null,
      windSpeed: cur.wind_speed_10m ?? null,
      windDir: cur.wind_direction_10m ?? null,
      gust: cur.wind_gusts_10m ?? null,
      cape: capeForHour(loc),
    };
  });
  const capes = points.map((p) => p.cape).filter((v): v is number => v != null);
  const precips = points.map((p) => p.precip).filter((v): v is number => v != null);
  const winds = points.map((p) => p.windSpeed).filter((v): v is number => v != null);
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    if (p.windDir == null) continue;
    const w = (p.windSpeed ?? 0) + 0.1;
    sx += w * Math.sin((p.windDir * Math.PI) / 180);
    sy += w * Math.cos((p.windDir * Math.PI) / 180);
  }
  const windDir = sx || sy ? ((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360 : null;
  return {
    sampledAt,
    model: 'gfs_seamless',
    points,
    summary: {
      capeMax: capes.length ? Math.max(...capes) : null,
      capeAvg: capes.length ? Math.round(capes.reduce((a, b) => a + b, 0) / capes.length) : null,
      precipMax: precips.length ? Math.max(...precips) : null,
      windAvg: winds.length ? Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10 : null,
      windDir: windDir != null ? Math.round(windDir) : null,
    },
  };
}

export async function getWeatherNow(lat: number, lon: number): Promise<WeatherNow> {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const res = await fetch(`${API}/api/weather/now/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return res.json();
}

export async function getCountryNews(params: {
  country: string;
  lang: string;
  query: string;
  limit?: number;
}): Promise<CountryNewsResponse> {
  const q = new URLSearchParams({
    country: params.country,
    lang: params.lang,
    q: params.query,
    limit: String(params.limit ?? 5),
  });
  const res = await fetch(`${API}/api/news/country/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`country news ${res.status}`);
  return res.json();
}

export async function getCountryMapStats(params: {
  country: string;
  strikeLimit?: number;
  period?: 'all' | 'year' | 'month' | 'day';
}): Promise<CountryMapStatsResponse> {
  const q = new URLSearchParams({
    country: params.country,
    strike_limit: String(params.strikeLimit ?? 10000),
    period: params.period ?? 'all',
  });
  const res = await fetch(`${STRIKES_API}/api/stats/country-map/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`country map stats ${res.status}`);
  return res.json();
}

// ── identity / auth ───────────────────────────────────────────────────────
export interface UsernameCheck {
  available: boolean;
}

export interface Session {
  username: string;
  token: string;
  tokens: number; // starting balance
  gridElo: number;
  verified: boolean;
  country: string;
  canChangeUsername: boolean;
  usernameChangeAvailableAt: string | null;
}

/** Is this username free? (debounced by the UI) */
export async function checkUsername(username: string): Promise<UsernameCheck> {
  const q = new URLSearchParams({ username });
  const res = await fetch(`${API}/api/game/username/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`username check ${res.status}`);
  return res.json();
}

/** Create a guest account. If omitted, the backend assigns a unique random name. */
export async function registerUsername(username?: string): Promise<Session> {
  return postJson<Session>('/api/game/register/', username ? { username } : {});
}

/**
 * Exchange a Firebase ID token for the backend's opaque game session token.
 * `linkToken` lets the backend merge a guest's points into the Firebase account.
 */
export async function exchangeFirebaseToken(
  idToken: string,
  linkToken?: string | null,
): Promise<Session> {
  return postJson<Session>('/api/auth/firebase/', {
    idToken,
    linkToken: linkToken ?? '',
  });
}

// ── Up/Down game (server-authoritative; identity comes from the Bearer token) ─
export type BetSide = 'up' | 'down';
export type Outcome = 'won' | 'lost' | 'push';
export type ScopeKind = 'globe' | 'country';

export interface PlayerProfile {
  username: string;
  tokens: number;
  gridElo: number;
  verified: boolean;
  country: string;
  canChangeUsername: boolean;
  usernameChangeAvailableAt: string | null;
}

export interface BetPayload {
  roundId: number;
  side: BetSide;
  amount: number;
  scopeKind: ScopeKind;
  scopeId: string;
  prevCount: number; // for audit only — server recomputes
}

export interface PlacedBet {
  betId: string;
  roundId: number;
  tokens: number;
}

export interface BetResolution {
  betId: string;
  outcome: Outcome;
  finalCount: number;
  payout: number;
  tokens: number;
}

export interface LeaderboardEntry {
  rank?: number | null;
  username: string;
  tokens: number;
  wins: number;
  gamesPlayed: number;
  verified: boolean;
  country: string;
  trophy: Trophy | null;
}

export interface Trophy {
  key: string;
  points: number;
  image: string;
  label: string;
  achievedCount?: number;
}

export interface LeaderboardContext {
  rows: LeaderboardEntry[];
  currentRank: number;
  nextTrophy: Trophy | null;
  trophies: Trophy[];
}

export interface LeaderboardSummary {
  entries: LeaderboardEntry[];
  trophies: Trophy[];
  totalPlayers: number;
}

export interface GridActiveCountry {
  country: string;
  strikes30s: number;
  strikes5m: number;
}

export interface GridActiveCountriesResponse {
  countries: GridActiveCountry[];
  windowSeconds: number;
  fallbackWindowSeconds: number;
  model?: string;
}

export type GridMatchStatus = 'preparing' | 'active' | 'settled';

export interface GridMatchState {
  matchId: string;
  status: GridMatchStatus;
  country: string;
  grid: {
    cols: number;
    rows: number;
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
    cellSizeKm: number | null;
  };
  player: {
    username: string;
    score: number;
    eloBefore: number;
    eloAfter: number | null;
  };
  opponent: {
    username: string;
    score: number;
    elo: number;
    eloAfter: number | null;
    bot: boolean;
    selectedCell: number | null;
    selectedCellExpiresAt: string | null;
  };
  model?: string;
  zone?: { hNorm: number | null; roundStrikes: number | null };
  timing: {
    createdAt: string;
    prepareEndsAt: string;
    startedAt: string;
    endsAt: string;
    serverNow: string;
  };
  strikes30sAtStart: number;
  eloDelta: number | null;
}

export interface AdminAccountsGrowthPoint {
  date: string;
  newAccounts: number;
  cumulativeAccounts: number;
}

export interface AdminAccountsGrowthResponse {
  adminEmail: string;
  days: number;
  totalAccounts: number;
  guestAccounts: number;
  verifiedAccounts: number;
  series: AdminAccountsGrowthPoint[];
}

function trophyFor(tokens: number): Trophy | null {
  let earned: Trophy | null = null;
  for (const trophy of TROPHIES) {
    if (tokens >= trophy.points) earned = trophy;
  }
  return earned;
}

function normalizeTrophy(trophy: Trophy | null | undefined): Trophy | null {
  if (!trophy) return null;
  const canonical = TROPHY_BY_POINTS.get(Number(trophy.points));
  return canonical ? { ...canonical, achievedCount: trophy.achievedCount } : trophy;
}

function normalizeTrophies(trophies: Trophy[] | undefined): Trophy[] {
  if (!trophies?.length) return TROPHIES;
  return trophies.map((trophy) => normalizeTrophy(trophy) ?? trophy);
}

function nextTrophyFor(tokens: number): Trophy | null {
  return TROPHIES.find((trophy) => tokens < trophy.points) ?? null;
}

function hydrateLeaderboardEntry(entry: Partial<LeaderboardEntry>, rank: number): LeaderboardEntry {
  const tokens = Number(entry.tokens ?? 0);
  return {
    rank: entry.rank ?? rank,
    username: entry.username ?? 'player',
    tokens,
    wins: Number(entry.wins ?? 0),
    gamesPlayed: Number(entry.gamesPlayed ?? 0),
    verified: Boolean(entry.verified),
    country: entry.country ?? '',
    trophy: normalizeTrophy(entry.trophy) ?? trophyFor(tokens),
  };
}

function trophyCounts(entries: LeaderboardEntry[], trophies = TROPHIES): Trophy[] {
  return trophies.map((trophy) => ({
    ...trophy,
    achievedCount: entries.filter((entry) => entry.tokens >= trophy.points).length,
  }));
}

/** Current player's profile + balance (identity from the token). */
export async function getProfile(): Promise<PlayerProfile> {
  const res = await fetch(`${API}/api/game/profile/`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  return res.json();
}

export async function getLeaderboardContext(): Promise<LeaderboardContext> {
  const res = await fetch(`${API}/api/game/leaderboard/context/`, { cache: 'no-store', headers: authHeaders() });
  if (res.ok) {
    const context = (await res.json()) as LeaderboardContext;
    return {
      ...context,
      rows: context.rows.map((row, index) => hydrateLeaderboardEntry(row, row.rank ?? index + 1)),
      nextTrophy: normalizeTrophy(context.nextTrophy),
      trophies: normalizeTrophies(context.trophies),
    };
  }

  const summary = await getLeaderboardSummary(3);
  return {
    rows: summary.entries.slice(0, 3),
    currentRank: 0,
    nextTrophy: nextTrophyFor(0),
    trophies: summary.trophies,
  };
}

export async function getLeaderboardSummary(limit = 50): Promise<LeaderboardSummary> {
  const q = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${LEADERBOARD_API}/api/game/leaderboard/summary/?${q}`, { cache: 'no-store' });
  if (res.ok) {
    const summary = (await res.json()) as LeaderboardSummary;
    return {
      ...summary,
      entries: summary.entries.map((entry, index) => hydrateLeaderboardEntry(entry, entry.rank ?? index + 1)),
      trophies: normalizeTrophies(summary.trophies),
    };
  }

  const legacy = await fetch(`${LEADERBOARD_API}/api/game/leaderboard/?${q}`, { cache: 'no-store' });
  if (!legacy.ok) throw new Error(`leaderboard summary ${res.status}`);
  const entries = ((await legacy.json()) as Partial<LeaderboardEntry>[]).map((entry, index) =>
    hydrateLeaderboardEntry(entry, index + 1),
  );
  return {
    entries,
    trophies: trophyCounts(entries),
    totalPlayers: entries.length,
  };
}

export async function placeBet(payload: BetPayload): Promise<PlacedBet> {
  return postJson<PlacedBet>('/api/game/bet/', payload);
}

export async function getBetResolution(betId: string): Promise<BetResolution | null> {
  const res = await fetch(`${API}/api/game/bet/${betId}/result/`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  if (res.status === 202 || res.status === 204) return null;
  if (!res.ok) throw new Error(`bet result ${res.status}`);
  return res.json();
}

export async function claimTokens(): Promise<PlayerProfile> {
  return postJson<PlayerProfile>('/api/game/claim/', {});
}

export async function changeUsername(username: string): Promise<PlayerProfile> {
  return postJson<PlayerProfile>('/api/game/username/change/', { username });
}

export async function changeCountry(countryCode: string): Promise<PlayerProfile> {
  return postJson<PlayerProfile>('/api/game/country/change/', { countryCode });
}

export async function getGridActiveCountries(limit = 8): Promise<GridActiveCountriesResponse> {
  const q = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API}/api/game/grid/active-countries/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`grid active countries ${res.status}`);
  return res.json();
}

export async function startGridMatch(country: string): Promise<GridMatchState> {
  return postJson<GridMatchState>('/api/game/grid/match/', { country });
}

export async function getGridMatchState(matchId: string): Promise<GridMatchState> {
  const res = await fetch(`${API}/api/game/grid/match/${matchId}/`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`grid match ${res.status}`);
  return res.json();
}

export async function selectGridCell(matchId: string, cell: number): Promise<GridMatchState> {
  return postJson<GridMatchState>(`/api/game/grid/match/${matchId}/select-cell/`, { cell });
}

export async function getAdminAccountsGrowth(idToken: string, days = 180): Promise<AdminAccountsGrowthResponse> {
  const q = new URLSearchParams({ days: String(days) });
  const res = await fetch(`${API}/api/admin/accounts-growth/?${q}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`admin accounts growth ${res.status}`);
  return res.json();
}
