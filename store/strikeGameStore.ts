// store/strikeGameStore.ts — state for the Up/Down strike-prediction game.
import { create } from 'zustand';

export type BetSide = 'up' | 'down';
export type Outcome = 'won' | 'lost' | 'push';

export const START_TOKENS = 100;

export interface PendingBet {
  roundId: number;
  side: BetSide;
  amount: number;
  scopeKind: 'globe' | 'country';
  scopeId: string;        // 'GLOBE' or ISO-2 (uppercase)
  scopeLabel: string;
  prevCount: number;      // previous-30s count, snapshotted at bet time
  placedAt: number;
  betId?: string;         // server bet id, set once the backend accepts the bet
}

export interface GameResult {
  id: string;
  roundId: number;
  side: BetSide;
  amount: number;
  scopeLabel: string;
  prevCount: number;
  finalCount: number;
  outcome: Outcome;
  payout: number;         // tokens credited back (2×amount win, amount push, 0 loss)
  at: number;
}

interface StrikeGameStore {
  username: string;
  tokens: number;
  pending: PendingBet | null;
  history: GameResult[];

  setUsername: (u: string) => void;
  setTokens: (n: number) => void;
  placeBet: (bet: PendingBet) => void;
  attachBetId: (betId: string) => void;
  resolveBet: (result: GameResult, tokensOverride?: number) => void;
  refundPending: () => void;
  claimTokens: (n?: number) => void;
  hydrate: (
    s: Partial<Pick<StrikeGameStore, 'username' | 'tokens' | 'pending' | 'history'>>,
  ) => void;
}

export const useStrikeGameStore = create<StrikeGameStore>((set) => ({
  username: '',
  tokens: START_TOKENS,
  pending: null,
  history: [],

  setUsername: (username) => set({ username }),
  setTokens: (tokens) => set({ tokens }),

  // One bet per round: ignore if a bet is already pending.
  placeBet: (bet) =>
    set((s) => (s.pending ? {} : { pending: bet, tokens: s.tokens - bet.amount })),

  // Record the server-issued id on the in-flight bet (server mode).
  attachBetId: (betId) =>
    set((s) => (s.pending ? { pending: { ...s.pending, betId } } : {})),

  // Local play credits `payout`; server play passes the authoritative balance
  // via tokensOverride so the client mirrors the server instead of re-computing.
  resolveBet: (result, tokensOverride) =>
    set((s) => ({
      pending: null,
      tokens: tokensOverride != null ? tokensOverride : s.tokens + result.payout,
      history: [result, ...s.history].slice(0, 100),
    })),

  refundPending: () =>
    set((s) => (s.pending ? { tokens: s.tokens + s.pending.amount, pending: null } : {})),

  claimTokens: (n = START_TOKENS) => set((s) => ({ tokens: s.tokens + n })),

  hydrate: (partial) => set(partial),
}));

// ── localStorage persistence (client only) ──────────────────────────────────
const PERSIST_KEY = 'strike_game_v1';

export function loadPersisted(): Partial<Pick<StrikeGameStore, 'username' | 'tokens' | 'pending' | 'history'>> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persist(s: {
  username: string;
  tokens: number;
  pending: PendingBet | null;
  history: GameResult[];
}): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — ignore */
  }
}