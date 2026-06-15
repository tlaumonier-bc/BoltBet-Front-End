// store/playStore.ts — state for the round-based game.
// The socket pushes round_start / round_end / leaderboard here; components read
// the round timer, the intermission countdown, the player's lock, and the board.

import { create } from 'zustand';
import type { LeaderboardRow } from '@/lib/api';

interface PlayStore {
  username: string;
  country: string;
  setIdentity: (username: string, country?: string) => void;

  roundNumber: number | null;
  endsAtMs: number | null;        // epoch ms, server clock
  durationSeconds: number | null;
  serverOffsetMs: number;         // serverNow - clientNow

  nextRoundAtMs: number | null;   // intermission target (server clock)

  lockZoneId: string | null;
  lockExpiresAtMs: number | null;

  board: LeaderboardRow[];
  lastResult: { round: number; board: LeaderboardRow[] } | null;

  syncClock: (serverIso: string) => void;
  setRound: (round: number, endsAtIso: string, durationSeconds: number) => void;
  endRound: (round: number, board: LeaderboardRow[], nextRoundAtIso?: string | null) => void;
  setIntermission: (nextRoundAtIso: string) => void;
  setLock: (zoneId: string, expiresIso: string) => void;
  clearLock: () => void;
  setBoard: (rows: LeaderboardRow[]) => void;
  upsertSelf: (username: string, country: string) => void;
}

export const usePlayStore = create<PlayStore>((set) => ({
  username: '',
  country: 'XX',
  setIdentity: (username, country) => set((s) => ({ username, country: country ?? s.country })),

  roundNumber: null,
  endsAtMs: null,
  durationSeconds: null,
  serverOffsetMs: 0,
  nextRoundAtMs: null,

  lockZoneId: null,
  lockExpiresAtMs: null,

  board: [],
  lastResult: null,

  syncClock: (serverIso) => set({ serverOffsetMs: Date.parse(serverIso) - Date.now() }),

  setRound: (roundNumber, endsAtIso, durationSeconds) =>
    set({ roundNumber, endsAtMs: Date.parse(endsAtIso), durationSeconds, nextRoundAtMs: null }),

  endRound: (round, board, nextRoundAtIso) =>
    set({
      lastResult: { round, board },
      board,
      lockZoneId: null,
      lockExpiresAtMs: null,
      roundNumber: null,
      endsAtMs: null,
      nextRoundAtMs: nextRoundAtIso ? Date.parse(nextRoundAtIso) : null,
    }),

  setIntermission: (nextRoundAtIso) =>
    set({ roundNumber: null, endsAtMs: null, nextRoundAtMs: Date.parse(nextRoundAtIso) }),

  setLock: (zoneId, expiresIso) => set({ lockZoneId: zoneId, lockExpiresAtMs: Date.parse(expiresIso) }),
  clearLock: () => set({ lockZoneId: null, lockExpiresAtMs: null }),
  setBoard: (rows) => set({ board: rows }),
  // Optimistic: show the player on the live board at 0 the moment they pick,
  // before the next server broadcast arrives.
  upsertSelf: (username, country) =>
    set((s) =>
      s.board.some((r) => r.username === username)
        ? {}
        : { board: [...s.board, { username, country, points: 0 }] },
    ),
}));

export function serverNowMs(): number {
  return Date.now() + usePlayStore.getState().serverOffsetMs;
}
