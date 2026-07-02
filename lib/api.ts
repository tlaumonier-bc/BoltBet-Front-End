// lib/api.ts — REST client for the BoltBet strike-prediction game backend.
import { sessionToken } from '@/store/sessionStore';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const STRIKES_API = process.env.NEXT_PUBLIC_STRIKES_API_URL ?? API;
export const LEADERBOARD_API = process.env.NEXT_PUBLIC_LEADERBOARD_API_URL ?? API;
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

export async function getStrikesPerMinute(minutes = 15): Promise<StrikesPerMinuteResponse> {
  const q = new URLSearchParams({ minutes: String(minutes) });
  const res = await fetch(`${API}/api/strikes/per-minute/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`per-minute ${res.status}`);
  return res.json();
}

export async function getCountryStrikesResult(country: string, limit = 5000): Promise<CountryStrikesResult> {
  const q = new URLSearchParams({ country, limit: String(limit) });
  const res = await fetch(`${API}/api/strikes/by-country/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`country strikes ${res.status}`);
  const data = (await res.json()) as Record<string, CountryStrike[] | CountryStrikeMeta | undefined>;
  const key = country.toUpperCase();
  const meta = data._meta as CountryStrikeMeta | undefined;
  return {
    strikes: (data[key] as CountryStrike[] | undefined) ?? [],
    meta: meta ?? null,
  };
}

export async function getCountryStrikes(country: string, limit = 5000): Promise<CountryStrike[]> {
  const result = await getCountryStrikesResult(country, limit);
  return result.strikes;
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

// ── identity / auth ───────────────────────────────────────────────────────
export interface UsernameCheck {
  available: boolean;
}

export interface Session {
  username: string;
  token: string;
  tokens: number; // starting balance
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
