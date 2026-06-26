// lib/api.ts — REST client for the BoltBet strike-prediction game backend.
import { sessionToken } from '@/store/sessionStore';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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
  const res = await fetch(`${API}/api/strikes/recent/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`recent strikes ${res.status}`);
  return res.json();
}

export async function getStrikesPerMinute(minutes = 15): Promise<StrikesPerMinuteResponse> {
  const q = new URLSearchParams({ minutes: String(minutes) });
  const res = await fetch(`${API}/api/strikes/per-minute/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`per-minute ${res.status}`);
  return res.json();
}

export async function getCountryStrikes(country: string, limit = 1000): Promise<CountryStrike[]> {
  const q = new URLSearchParams({ country, limit: String(limit) });
  const res = await fetch(`${API}/api/strikes/by-country/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`country strikes ${res.status}`);
  const data = (await res.json()) as Record<string, CountryStrike[]>;
  return data[country.toUpperCase()] ?? [];
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
}

/** Is this username free? (debounced by the UI) */
export async function checkUsername(username: string): Promise<UsernameCheck> {
  const q = new URLSearchParams({ username });
  const res = await fetch(`${API}/api/game/username/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`username check ${res.status}`);
  return res.json();
}

/** Claim a chosen guest username → server account + session token. */
export async function registerUsername(username: string): Promise<Session> {
  return postJson<Session>('/api/game/register/', { username });
}

/**
 * Exchange a Firebase ID token for the backend's opaque game session token.
 * `linkToken` lets the backend merge a guest's points into the Firebase account.
 */
export async function exchangeFirebaseToken(
  idToken: string,
  linkToken?: string | null,
): Promise<Session> {
  return postJson<Session>('/api/auth/firebase/', { idToken, linkToken: linkToken ?? '' });
}

// ── Up/Down game (server-authoritative; identity comes from the Bearer token) ─
export type BetSide = 'up' | 'down';
export type Outcome = 'won' | 'lost' | 'push';
export type ScopeKind = 'globe' | 'country';

export interface PlayerProfile {
  username: string;
  tokens: number;
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
  username: string;
  tokens: number;
  wins: number;
  gamesPlayed: number;
}

/** Current player's profile + balance (identity from the token). */
export async function getProfile(): Promise<PlayerProfile> {
  const res = await fetch(`${API}/api/game/profile/`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  return res.json();
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
