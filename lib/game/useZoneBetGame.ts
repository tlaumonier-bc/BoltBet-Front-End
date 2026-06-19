'use client';
// lib/game/useZoneBetGame.ts — drives the zone-bet game: guest identity,
// multiplier polling (grid), and bet-state polling. When the backend is
// unreachable it falls back to the local mock model + local bet resolution so
// the feature is fully playable today.
import { useEffect } from 'react';
import { useZoneBetStore, type ZoneBet } from '@/store/zoneBetStore';
import {
  getZoneMultipliers,
  getZoneBetState,
  mockMultipliers,
  type ZoneBetRecord,
} from '@/lib/game/zoneBetApi';
import { impliedWinProb } from '@/lib/game/multiplier';

const IDENTITY_KEY = 'zbet_identity';
const MULT_POLL_MS = 30_000;
const STATE_POLL_MS = 10_000;

let backendHealthy = false;

function toBet(r: ZoneBetRecord): ZoneBet {
  return {
    id: r.id,
    zoneId: r.zone_id,
    durationMinutes: r.duration_minutes,
    amount: r.amount,
    multiplier: r.multiplier,
    placedAt: Date.parse(r.placed_at),
    expiresAt: Date.parse(r.expires_at),
    status: r.status,
    payout: r.payout,
    winningZoneId: r.winning_zone_id ?? null,
  };
}

// Offline only: resolve any expired pending bet using the model's implied prob.
function mockResolveTick() {
  const st = useZoneBetStore.getState();
  const now = Date.now();
  for (const b of st.activeBets) {
    if (now < b.expiresAt) continue;
    const won = Math.random() < impliedWinProb(b.multiplier, b.durationMinutes);
    st.resolveBet(b.id, won, Math.round(b.amount * b.multiplier));
  }
}

export function useZoneBetGame() {
  const username = useZoneBetStore((s) => s.username);
  const setUsername = useZoneBetStore((s) => s.setUsername);
  const setMultipliers = useZoneBetStore((s) => s.setMultipliers);
  const replaceState = useZoneBetStore((s) => s.replaceState);

  // guest identity
  useEffect(() => {
    if (username) return;
    let id = '';
    try {
      id = localStorage.getItem(IDENTITY_KEY) ?? '';
    } catch {
      /* private mode */
    }
    if (!id) {
      id = 'guest-' + Math.random().toString(36).slice(2, 7);
      try {
        localStorage.setItem(IDENTITY_KEY, id);
      } catch {
        /* ignore */
      }
    }
    setUsername(id);
  }, [username, setUsername]);

  // grid multipliers (backend → mock fallback)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await getZoneMultipliers(60);
        if (!alive) return;
        const map: Record<string, { recentStrikes: number; byDuration: Record<number, number> }> = {};
        for (const z of res.zones) {
          const byDuration: Record<number, number> = {};
          for (const [k, v] of Object.entries(z.multipliers)) byDuration[Number(k)] = v;
          map[z.zone_id] = { recentStrikes: z.recent_strikes, byDuration };
        }
        setMultipliers(map);
      } catch {
        if (alive) setMultipliers(mockMultipliers());
      }
    };
    load();
    const t = setInterval(load, MULT_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [setMultipliers]);

  // bet state (backend authoritative; else resolve mock bets locally)
  useEffect(() => {
    if (!username) return;
    let alive = true;
    const load = async () => {
      try {
        const st = await getZoneBetState(username);
        if (!alive) return;
        backendHealthy = true;
        replaceState({
          credits: st.credits,
          active: st.active.map(toBet),
          history: st.history.map(toBet),
        });
      } catch {
        backendHealthy = false;
      }
    };
    load();
    const poll = setInterval(load, STATE_POLL_MS);
    const tick = setInterval(() => {
      if (!backendHealthy) mockResolveTick();
    }, 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [username, replaceState]);
}