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

export interface StrikeStats {
  last_60s: number;
  last_10min: number;
  last_15_min: number;
  last_60_min: number;
  last_24h: number;
  buckets_15min: number[];
  avg_latency_ms_60min: number | null;
  server_time: string;
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

export async function getStrikeStats(): Promise<StrikeStats> {
  const res = await fetch(`${API}/api/stats/strikes/`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`strike stats ${res.status}`);
  return res.json();
}