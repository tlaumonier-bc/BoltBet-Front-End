'use client';
// lib/game/useStrikeGame.ts
// Up/Down strike-prediction game. Round model (anchored to wall-clock so it's
// deterministic across tabs):
//   cycle c: [c*40s, c*40s+30s] = GAME window (strikes counted, betting locked)
//            [c*40s+30s, c*40s+40s] = BUFFER (10s, betting open, strikes IGNORED)
// During the buffer of cycle c you bet on game c+1 vs game c. Buffer strikes
// count for neither game. Resolves locally; swap in a backend by replacing the
// counting + resolution block — the view-model stays the same.

import { useCallback, useEffect, useState } from 'react';
import { useLiveStore } from '@/store/liveStore';
import { useGameStore } from '@/store/gameStore';
import {
  useStrikeGameStore,
  loadPersisted,
  persist,
  START_TOKENS,
  type BetSide,
  type GameResult,
  type Outcome,
  type PendingBet,
} from '@/store/strikeGameStore';
import { countryName } from '@/lib/live/owm';
import type { LightningStrike } from '@/types';

export const GAME_MS = 30_000;
export const BUFFER_MS = 10_000;
export const CYCLE_MS = GAME_MS + BUFFER_MS; // 40_000
export const PAYOUT_MULTIPLIER = 2;

const TICK_MS = 250;
const PREV_BARS = 30;
const BUFFER_BARS = 10;
const CUR_BARS = 30;
export const SERIES_LEN = PREV_BARS + BUFFER_BARS + CUR_BARS; // 70
export const SERIES_BUFFER_START = PREV_BARS;        // 30
export const SERIES_CURRENT_START = PREV_BARS + BUFFER_BARS; // 40

const IDENTITY_KEY = 'strike_game_identity';

export type GamePhase = 'betting' | 'locked';

export interface GameScope {
  kind: 'globe' | 'country';
  id: string; // 'GLOBE' or ISO-2 (uppercase), '' for a territory with no ISO code
  label: string;
}

export interface StrikeGameVM {
  scope: GameScope;
  playable: boolean;
  phase: GamePhase;
  roundId: number;
  elapsedMs: number; // offset within the 40s cycle
  msUntilLock: number;
  msUntilResolve: number;
  nowIndex: number;
  prevCount: number;
  currentCount: number;
  rollingLast30: number;
  pendingCurrentCount: number; // live count of the pending bet's game window
  series: number[];
  seriesMax: number;
  tokens: number;
  pending: PendingBet | null;
  canBet: boolean;
  placeBet: (side: BetSide, amount: number) => void;
  findPlayableCountry: () => boolean;
  playGlobe: () => void;
  claimTokens: () => void;
}

function matchScope(s: LightningStrike, kind: 'globe' | 'country', id: string): boolean {
  if (kind === 'globe') return true;
  return !!s.country && s.country.toUpperCase() === id;
}

// strikes are newest-first by receivedAt, so break once we pass `min`.
function countWindow(
  strikes: LightningStrike[],
  kind: 'globe' | 'country',
  id: string,
  min: number,
  max: number,
): number {
  let c = 0;
  for (const s of strikes) {
    if (s.receivedAt < min) break;
    if (s.receivedAt >= max) continue;
    if (matchScope(s, kind, id)) c++;
  }
  return c;
}

// Count strikes inside game window of `cycle` (buffer is naturally excluded).
function gameCount(
  strikes: LightningStrike[],
  kind: 'globe' | 'country',
  id: string,
  cycle: number,
): number {
  const lo = cycle * CYCLE_MS;
  return countWindow(strikes, kind, id, lo, lo + GAME_MS);
}

function currentScope(): GameScope {
  const sel = useLiveStore.getState().selectedCountry;
  return sel
    ? { kind: 'country', id: sel.iso2 ? sel.iso2.toUpperCase() : '', label: sel.name }
    : { kind: 'globe', id: 'GLOBE', label: 'Whole globe' };
}

interface Derived {
  roundId: number;
  elapsedMs: number;
  inBuffer: boolean;
  msUntilLock: number;
  msUntilResolve: number;
  nowIndex: number;
  prevCount: number;
  currentCount: number;
  rollingLast30: number;
  pendingCurrentCount: number;
  series: number[];
  seriesMax: number;
}

function emptyDerived(): Derived {
  return {
    roundId: Math.floor(Date.now() / CYCLE_MS),
    elapsedMs: 0,
    inBuffer: false,
    msUntilLock: 0,
    msUntilResolve: GAME_MS,
    nowIndex: SERIES_CURRENT_START,
    prevCount: 0,
    currentCount: 0,
    rollingLast30: 0,
    pendingCurrentCount: 0,
    series: new Array(SERIES_LEN).fill(0),
    seriesMax: 1,
  };
}

export function useStrikeGame(): StrikeGameVM {
  const selectedCountry = useLiveStore((s) => s.selectedCountry);
  const setSelectedCountry = useLiveStore((s) => s.setSelectedCountry);

  const tokens = useStrikeGameStore((s) => s.tokens);
  const pending = useStrikeGameStore((s) => s.pending);

  const scope: GameScope = selectedCountry
    ? {
        kind: 'country',
        id: selectedCountry.iso2 ? selectedCountry.iso2.toUpperCase() : '',
        label: selectedCountry.name,
      }
    : { kind: 'globe', id: 'GLOBE', label: 'Whole globe' };

  const [derived, setDerived] = useState<Derived>(emptyDerived);

  // ── identity + hydrate persisted state (once) ─────────────────────────────
  useEffect(() => {
    const st = useStrikeGameStore.getState();
    if (!st.username) {
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

      const saved = loadPersisted();
      if (saved) {
        const curCycle = Math.floor(Date.now() / CYCLE_MS);
        let pend = saved.pending ?? null;
        let tok = typeof saved.tokens === 'number' ? saved.tokens : START_TOKENS;
        // Bet whose game already ended while away can't be fairly resolved — refund.
        if (pend && pend.roundId < curCycle) {
          tok += pend.amount;
          pend = null;
        }
        useStrikeGameStore.getState().hydrate({
          username: saved.username || id,
          tokens: tok,
          pending: pend,
          history: Array.isArray(saved.history) ? saved.history : [],
        });
      } else {
        useStrikeGameStore.getState().setUsername(id);
      }
    }

    const unsub = useStrikeGameStore.subscribe((s) =>
      persist({ username: s.username, tokens: s.tokens, pending: s.pending, history: s.history }),
    );
    return () => unsub();
  }, []);

  // ── round clock + counting + resolution (single timer) ────────────────────
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const cycle = Math.floor(now / CYCLE_MS);
      const cycleStart = cycle * CYCLE_MS;
      const offset = now - cycleStart; // 0..40000
      const inBuffer = offset >= GAME_MS; // last 10s → betting open for next game
      const activeRound = inBuffer ? cycle + 1 : cycle;

      const strikes = useGameStore.getState().strikes;
      const { kind, id } = currentScope();

      const prevCount = gameCount(strikes, kind, id, activeRound - 1);
      const currentCount = gameCount(strikes, kind, id, activeRound);
      const rollingLast30 = countWindow(strikes, kind, id, now - GAME_MS, now + 1);

      // series anchored to activeRound: prev game | buffer | current game (70s)
      const base = (activeRound - 1) * CYCLE_MS;
      const top = base + SERIES_LEN * 1000;
      const series = new Array(SERIES_LEN).fill(0);
      for (const s of strikes) {
        if (s.receivedAt < base) break;
        if (s.receivedAt >= top) continue;
        if (!matchScope(s, kind, id)) continue;
        const idx = Math.floor((s.receivedAt - base) / 1000);
        if (idx >= 0 && idx < SERIES_LEN) series[idx]++;
      }
      const seriesMax = Math.max(1, ...series);
      const nowIndex = Math.max(0, Math.min(SERIES_LEN, Math.floor((now - base) / 1000)));

      const msUntilLock = inBuffer ? Math.max(0, activeRound * CYCLE_MS - now) : 0;
      const msUntilResolve = Math.max(0, activeRound * CYCLE_MS + GAME_MS - now);

      // pending bet's live count + resolution
      const pend = useStrikeGameStore.getState().pending;
      let pendingCurrentCount = 0;
      if (pend) {
        pendingCurrentCount = gameCount(strikes, pend.scopeKind, pend.scopeId, pend.roundId);
        if (now >= pend.roundId * CYCLE_MS + GAME_MS) {
          const finalCount = pendingCurrentCount;
          let outcome: Outcome;
          if (finalCount > pend.prevCount) outcome = pend.side === 'up' ? 'won' : 'lost';
          else if (finalCount < pend.prevCount) outcome = pend.side === 'down' ? 'won' : 'lost';
          else outcome = 'push';
          const payout =
            outcome === 'won'
              ? pend.amount * PAYOUT_MULTIPLIER
              : outcome === 'push'
              ? pend.amount
              : 0;

          const result: GameResult = {
            id: crypto.randomUUID(),
            roundId: pend.roundId,
            side: pend.side,
            amount: pend.amount,
            scopeLabel: pend.scopeLabel,
            prevCount: pend.prevCount,
            finalCount,
            outcome,
            payout,
            at: now,
          };
          useStrikeGameStore.getState().resolveBet(result);

          const notify = useGameStore.getState().pushNotification;
          if (outcome === 'won')
            notify({ type: 'win', message: `⚡ +${pend.amount} tokens — ${pend.scopeLabel}` });
          else if (outcome === 'lost')
            notify({ type: 'loss', message: `Missed it — ${pend.amount} tokens lost` });
          else notify({ type: 'info', message: 'Push — bet refunded' });
        }
      }

      setDerived({
        roundId: activeRound,
        elapsedMs: offset,
        inBuffer,
        msUntilLock,
        msUntilResolve,
        nowIndex,
        prevCount,
        currentCount,
        rollingLast30,
        pendingCurrentCount,
        series,
        seriesMax,
      });
    };

    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, []);

  const phase: GamePhase = derived.inBuffer ? 'betting' : 'locked';
  const playable = scope.kind === 'globe' ? true : scope.id !== '' && derived.rollingLast30 > 0;
  const canBet = phase === 'betting' && !pending && playable && tokens > 0;

  const placeBet = useCallback((side: BetSide, amount: number) => {
    const st = useStrikeGameStore.getState();
    if (st.pending) return;

    const now = Date.now();
    const cycle = Math.floor(now / CYCLE_MS);
    const offset = now - cycle * CYCLE_MS;
    if (offset < GAME_MS) return; // betting only during the buffer

    const sc = currentScope();
    const strikes = useGameStore.getState().strikes;

    if (sc.kind === 'country') {
      if (!sc.id) return;
      if (countWindow(strikes, 'country', sc.id, now - GAME_MS, now + 1) <= 0) return;
    }

    const amt = Math.max(1, Math.min(Math.floor(amount), st.tokens));
    if (amt <= 0) return;

    const roundId = cycle + 1; // betting on next game
    const prevCount = gameCount(strikes, sc.kind, sc.id, cycle); // just-finished game
    st.placeBet({
      roundId,
      side,
      amount: amt,
      scopeKind: sc.kind,
      scopeId: sc.id,
      scopeLabel: sc.label,
      prevCount,
      placedAt: now,
    });
  }, []);

  const findPlayableCountry = useCallback((): boolean => {
    const now = Date.now();
    const strikes = useGameStore.getState().strikes;
    const counts = new Map<string, number>();
    for (const s of strikes) {
      if (s.receivedAt < now - GAME_MS) break;
      const cc = s.country && s.country !== 'XX' ? s.country.toUpperCase() : null;
      if (!cc) continue;
      counts.set(cc, (counts.get(cc) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [cc, n] of counts) {
      if (n > bestN) {
        best = cc;
        bestN = n;
      }
    }
    if (!best) return false;
    setSelectedCountry({ name: countryName(best), iso2: best });
    return true;
  }, [setSelectedCountry]);

  const playGlobe = useCallback(() => setSelectedCountry(null), [setSelectedCountry]);
  const claimTokens = useCallback(() => useStrikeGameStore.getState().claimTokens(), []);

  return {
    scope,
    playable,
    phase,
    roundId: derived.roundId,
    elapsedMs: derived.elapsedMs,
    msUntilLock: derived.msUntilLock,
    msUntilResolve: derived.msUntilResolve,
    nowIndex: derived.nowIndex,
    prevCount: derived.prevCount,
    currentCount: derived.currentCount,
    rollingLast30: derived.rollingLast30,
    pendingCurrentCount: derived.pendingCurrentCount,
    series: derived.series,
    seriesMax: derived.seriesMax,
    tokens,
    pending,
    canBet,
    placeBet,
    findPlayableCountry,
    playGlobe,
    claimTokens,
  };
}