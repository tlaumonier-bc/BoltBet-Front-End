// lib/api.ts — REST client for the BoltBet game backend.
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function csrf(): string {
  if (typeof document === 'undefined') return ''
  return document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.split('=')[1] ?? ''
}

export interface GameState {
  active: boolean;
  round_number?: number;
  ends_at?: string;
  server_time: string;
  duration_seconds?: number;
  lock_seconds?: number;
  intermission?: boolean;
  next_round_at?: string;
}

export interface PickResult {
  id: number;
  zone_id: string;
  locked_at: string;
  expires_at: string;
}

export interface LeaderboardRow {
  username: string;
  country: string;
  points?: number;
  games_won?: number;
  avg_strikes?: number;
  games_played?: number;
}

// ── NEW: raw recent strikes (/api/strikes/recent/) ──────────────────────────
export interface RecentStrike {
  lat: number;
  lon: number;
  quality: string;
  timestamp: string;
  received_at: string;
}

export interface RecentStrikesResponse {
  minutes: number;
  older_than?: number;
  count: number;
  strikes: RecentStrike[];
}


// ── NEW: per-minute series (/api/strikes/per-minute/) ───────────────────────
export interface MinuteBucket {
  minute: string;       // ISO, start of the minute
  count: number;
}

export interface StrikesPerMinuteResponse {
  minutes: number;
  series: MinuteBucket[]; // oldest → newest, zero-filled
}

// ── NEW: per-country strikes (/api/strikes/by-country/) ─────────────────────
export interface CountryStrike {
  lat: number;
  lon: number;
  timestamp: string;
  quality: string;
  received_at: string;
}

export type LeaderboardKind = 'current' | 'wins' | 'average';

export class PickError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'PickError';
  }
}

export async function getGameState(): Promise<GameState> {
  const res = await fetch(`${API}/api/game/state/`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`game state ${res.status}`);
  return res.json();
}

export async function placePick(zoneId: string, username: string, country: string): Promise<PickResult> {
  const res = await fetch(`${API}/api/game/pick/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() },
    credentials: 'same-origin',
    body: JSON.stringify({ zone_id: zoneId, username, country }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PickError((body as { error?: string }).error ?? `pick ${res.status}`);
  }
  return res.json();
}

export async function getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardRow[]> {
  const res = await fetch(`${API}/api/game/leaderboard/${kind}/`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.json();
}

/** Raw strike positions over a recent window (or age band via olderThan). */
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

/** Global strike count per minute — drives the "Activity" sparkline. */
export async function getStrikesPerMinute(minutes = 15): Promise<StrikesPerMinuteResponse> {
  const q = new URLSearchParams({ minutes: String(minutes) });
  const res = await fetch(`${API}/api/strikes/per-minute/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`per-minute ${res.status}`);
  return res.json();
}

/** Newest N strikes for a single country (e.g. 'FR'). */
export async function getCountryStrikes(country: string, limit = 1000): Promise<CountryStrike[]> {
  const q = new URLSearchParams({ country, limit: String(limit) });
  const res = await fetch(`${API}/api/strikes/by-country/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`country strikes ${res.status}`);
  const data = (await res.json()) as Record<string, CountryStrike[]>;
  return data[country.toUpperCase()] ?? [];
}