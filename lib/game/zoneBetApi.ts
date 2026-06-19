// lib/game/zoneBetApi.ts — REST client for the zone-bet game, with an offline
// mock fallback so the whole feature works before the backend exists.
import { allZones } from '@/lib/zones';
import { computeMultipliers, type ZoneMultipliers } from '@/lib/game/multiplier';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function csrf(): string {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

// ── shapes the backend should return ───────────────────────────────────────
export interface ZoneActivityRow {
  zone_id: string;
  recent_strikes: number;
  multipliers: Record<string, number>; // key = duration minutes as string, e.g. "10"
}
export interface ZoneActivityResponse {
  lookback_minutes: number;
  zones: ZoneActivityRow[];
}

export interface ZoneBetRecord {
  id: string;
  zone_id: string;
  duration_minutes: number;
  amount: number;
  multiplier: number;
  placed_at: string;   // ISO
  expires_at: string;  // ISO
  status: 'pending' | 'won' | 'lost';
  payout: number;
  winning_zone_id?: string | null;
}
export interface PlaceZoneBetResponse {
  bet: ZoneBetRecord;
  credits: number;
}
export interface ZoneBetStateResponse {
  credits: number;
  active: ZoneBetRecord[];
  history: ZoneBetRecord[];
}

// ── endpoints ────────────────────────────────────────────────────────────
export async function getZoneMultipliers(lookbackMinutes = 60): Promise<ZoneActivityResponse> {
  const q = new URLSearchParams({ lookback: String(lookbackMinutes) });
  const res = await fetch(`${API}/api/game/zones/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`zone multipliers ${res.status}`);
  return res.json();
}

export async function placeZoneBet(
  zoneId: string,
  durationMinutes: number,
  amount: number,
  username: string,
): Promise<PlaceZoneBetResponse> {
  const res = await fetch(`${API}/api/game/zone-bet/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() },
    credentials: 'same-origin',
    body: JSON.stringify({ zone_id: zoneId, duration_minutes: durationMinutes, amount, username }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `zone bet ${res.status}`);
  }
  return res.json();
}

export async function getZoneBetState(username: string): Promise<ZoneBetStateResponse> {
  const q = new URLSearchParams({ username });
  const res = await fetch(`${API}/api/game/zone-bet/state/?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`zone bet state ${res.status}`);
  return res.json();
}

// ── MOCK (until the backend ships) ─────────────────────────────────────────
// Deterministic activity weighted toward equatorial belts + two hotspots so the
// grid looks plausible. Shifts gently every 30s for a little life.
export function mockActivity(): Record<string, number> {
  const t = Math.floor(Date.now() / 30_000);
  const out: Record<string, number> = {};
  for (const z of allZones()) {
    const lat = (z.latMin + z.latMax) / 2;
    const lon = (z.lonMin + z.lonMax) / 2;
    const tropical = Math.exp(-((lat / 22) ** 2));
    const hotspots =
      Math.exp(-(((lat - 9) / 8) ** 2) - (((lon + 71) / 8) ** 2)) + // Maracaibo
      Math.exp(-(((lat + 2) / 10) ** 2) - (((lon - 24) / 12) ** 2)); // Congo
    const v = tropical * 40 + hotspots * 120 + pseudo(z.id, t) * 12;
    out[z.id] = Math.max(0, Math.round(v));
  }
  return out;
}

function pseudo(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(Math.sin(h * 12.9898)) % 1;
}

export function mockMultipliers(): Record<string, ZoneMultipliers> {
  return computeMultipliers(mockActivity());
}