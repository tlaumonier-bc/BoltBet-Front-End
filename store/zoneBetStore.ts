// store/zoneBetStore.ts — state for the globe zone-bet game (Game mode).
// Separate from gameStore (legacy /play betting) and playStore (round game).
import { create } from 'zustand';
import type { ZoneMultipliers } from '@/lib/game/multiplier';

export interface ZoneBet {
  id: string;
  zoneId: string;
  durationMinutes: number;
  amount: number;
  multiplier: number;
  placedAt: number;   // epoch ms
  expiresAt: number;  // epoch ms
  status: 'pending' | 'won' | 'lost';
  payout: number;
  winningZoneId?: string | null;
}

interface ZoneBetStore {
  username: string;
  credits: number;
  multipliers: Record<string, ZoneMultipliers>;
  previewDuration: number;     // which window the grid labels show
  selectedZoneId: string | null; // open bet modal for this zone
  activeBets: ZoneBet[];
  history: ZoneBet[];

  setUsername: (u: string) => void;
  setCredits: (n: number) => void;
  setMultipliers: (m: Record<string, ZoneMultipliers>) => void;
  setPreviewDuration: (d: number) => void;
  selectZone: (id: string | null) => void;
  placeBet: (bet: ZoneBet) => void;
  resolveBet: (id: string, won: boolean, payout: number, winningZoneId?: string | null) => void;
  replaceState: (s: { credits: number; active: ZoneBet[]; history: ZoneBet[] }) => void;
}

export const useZoneBetStore = create<ZoneBetStore>((set) => ({
  username: '',
  credits: 1000,
  multipliers: {},
  previewDuration: 10,
  selectedZoneId: null,
  activeBets: [],
  history: [],

  setUsername: (username) => set({ username }),
  setCredits: (credits) => set({ credits }),
  setMultipliers: (multipliers) => set({ multipliers }),
  setPreviewDuration: (previewDuration) => set({ previewDuration }),
  selectZone: (selectedZoneId) => set({ selectedZoneId }),

  placeBet: (bet) =>
    set((s) => ({ activeBets: [bet, ...s.activeBets], credits: s.credits - bet.amount })),

  resolveBet: (id, won, payout, winningZoneId) =>
    set((s) => {
      const bet = s.activeBets.find((b) => b.id === id);
      if (!bet) return {};
      const resolved: ZoneBet = {
        ...bet,
        status: won ? 'won' : 'lost',
        payout: won ? payout : 0,
        winningZoneId: winningZoneId ?? null,
      };
      return {
        activeBets: s.activeBets.filter((b) => b.id !== id),
        history: [resolved, ...s.history].slice(0, 50),
        credits: s.credits + (won ? payout : 0),
      };
    }),

  replaceState: ({ credits, active, history }) => set({ credits, activeBets: active, history }),
}));