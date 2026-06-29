'use client';
// lib/game/useStrikeGame.ts
// Up/Down strike-prediction game. Each user starts their own 30-second window
// when they place a bet. They can place a new bet whenever no previous bet is
// pending, for either the whole globe or one active country.
//
// Settlement is server-authoritative when NEXT_PUBLIC_GAME_SERVER=1: bets are
// POSTed, the backend counts the window and credits tokens, and the client
// mirrors the returned balance. With the flag off (or the backend offline) the
// client settles locally so the game stays playable.

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
import {
  GAME_SERVER_ENABLED,
  getProfile,
  placeBet as placeBetApi,
  getBetResolution,
  claimTokens as claimTokensApi,
  getRecentStrikes,
  getCountryStrikes,
} from '@/lib/api';
import type { LightningStrike } from '@/types';
import { useSessionStore } from '@/store/sessionStore';
import {
  trackBetPlaced,
  trackBetResolved,
  trackTokensClaimed,
} from '@/lib/analytics';

export const GAME_MS = 30_000;
export const PAYOUT_MULTIPLIER = 2;

const TICK_MS = 250;
const PREV_BARS = 30;
const CUR_BARS = 30;
export const SERIES_LEN = PREV_BARS + CUR_BARS; // previous 30s + bet window
export const SERIES_CURRENT_START = PREV_BARS;


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
  elapsedMs: number; // elapsed time within the pending bet window
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

function currentScope(): GameScope {
  const sel = useLiveStore.getState().selectedCountry;
  return sel
    ? { kind: 'country', id: sel.iso2 ? sel.iso2.toUpperCase() : '', label: sel.name }
    : { kind: 'globe', id: 'GLOBE', label: 'Whole globe' };
}

interface Derived {
  roundId: number;
  elapsedMs: number;
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
    roundId: Date.now(),
    elapsedMs: 0,
    msUntilResolve: GAME_MS,
    nowIndex: PREV_BARS,
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

  const sessionUsername = useSessionStore((s) => s.username);

  // ── hydrate persisted game state (tokens/history/pending) once ─────────────
  useEffect(() => {
    const saved = loadPersisted();
    if (saved) {
      let pend = saved.pending ?? null;
      let tok = typeof saved.tokens === 'number' ? saved.tokens : START_TOKENS;
      // A local-only bet whose window ended while away cannot be fairly
      // resolved. Server bets keep their id and will settle when polled.
      if (pend && !pend.betId && Date.now() >= pend.placedAt + GAME_MS) {
        tok += pend.amount;
        pend = null;
      }
      useStrikeGameStore.getState().hydrate({
        tokens: tok,
        pending: pend,
        history: Array.isArray(saved.history) ? saved.history : [],
      });
    }
    const unsub = useStrikeGameStore.subscribe((s) =>
      persist({ username: s.username, tokens: s.tokens, pending: s.pending, history: s.history }),
    );
    return () => unsub();
  }, []);

  // ── follow the chosen identity: mirror the username into the game store and,
  //    in server mode, pull the authoritative balance for that account ────────
  useEffect(() => {
    if (!sessionUsername) return;
    useStrikeGameStore.getState().setUsername(sessionUsername);
    if (GAME_SERVER_ENABLED) {
      getProfile()
        .then((p) => useStrikeGameStore.getState().hydrate({ tokens: p.tokens }))
        .catch(() => {
          /* backend offline — keep the local balance */
        });
    }
  }, [sessionUsername]);

  // ── Backfill recent strikes from the DB so the "previous 30s" window is
  //    populated on load (the live WS only delivers strikes from now on). ─────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { strikes } = await getRecentStrikes(3); // last 3 min, global
        if (!alive || !strikes.length) return;
        useGameStore.getState().seedStrikes(
          strikes.map((s) => ({
            id: crypto.randomUUID(),
            lat: s.lat,
            lon: s.lon,
            timestamp: Date.parse(s.timestamp) || Date.parse(s.received_at) || Date.now(),
            receivedAt: Date.parse(s.received_at) || Date.now(),
            quality: s.quality ?? 'good',
            country: s.country ?? null,
          })),
        );
      } catch {
        /* backend offline — prev window fills once live strikes arrive */
      }
    })();
    return () => { alive = false; };
  }, []);

  // When a country is selected, backfill ITS recent strikes (tagged with the
  // ISO code) so country-mode's previous-30s count isn't empty on load.
  useEffect(() => {
    const iso = selectedCountry?.iso2;
    if (!iso) return;
    let alive = true;
    (async () => {
      try {
        const rows = await getCountryStrikes(iso, 1000);
        if (!alive || !rows.length) return;
        useGameStore.getState().seedStrikes(
          rows.map((s) => ({
            id: crypto.randomUUID(),
            lat: s.lat,
            lon: s.lon,
            timestamp: Date.parse(s.timestamp) || Date.parse(s.received_at) || Date.now(),
            receivedAt: Date.parse(s.received_at) || Date.now(),
            quality: s.quality ?? 'good',
            country: iso,
          })),
        );
      } catch {
        /* backend offline */
      }
    })();
    return () => { alive = false; };
  }, [selectedCountry?.iso2]);

  // ── round clock + counting + resolution (single timer) ────────────────────
  useEffect(() => {
    let resolvingRound: number | null = null; // guard for an in-flight server settle

    const buildResult = (
      pend: PendingBet,
      finalCount: number,
      outcome: Outcome,
      payout: number,
      at: number,
    ): GameResult => ({
      id: crypto.randomUUID(),
      roundId: pend.roundId,
      side: pend.side,
      amount: pend.amount,
      scopeLabel: pend.scopeLabel,
      prevCount: pend.prevCount,
      finalCount,
      outcome,
      payout,
      at,
    });

    const settleLocally = (pend: PendingBet, finalCount: number, at: number) => {
      let outcome: Outcome;
      if (finalCount > pend.prevCount) outcome = pend.side === 'up' ? 'won' : 'lost';
      else if (finalCount < pend.prevCount) outcome = pend.side === 'down' ? 'won' : 'lost';
      else outcome = 'push';
      const payout =
        outcome === 'won' ? pend.amount * PAYOUT_MULTIPLIER : outcome === 'push' ? pend.amount : 0;
      const result = buildResult(pend, finalCount, outcome, payout, at);
      useStrikeGameStore.getState().resolveBet(result);
      // ── analytics ──
      trackBetResolved({ outcome, amount: pend.amount, payout, scope: pend.scopeKind });
    };

    const settleFromServer = (pend: PendingBet) => {
      if (!pend.betId || resolvingRound === pend.roundId) return;
      resolvingRound = pend.roundId;
      getBetResolution(pend.betId)
        .then((res) => {
          if (!res) {
            resolvingRound = null; // not settled yet — retry next tick
            return;
          }
          const cur = useStrikeGameStore.getState();
          if (cur.pending && cur.pending.betId === pend.betId) {
            cur.resolveBet(
              buildResult(pend, res.finalCount, res.outcome, res.payout, Date.now()),
              res.tokens, // authoritative balance
            );
            // ── analytics ──
            trackBetResolved({
              outcome: res.outcome,
              amount: pend.amount,
              payout: res.payout,
              scope: pend.scopeKind,
            });
          }
          resolvingRound = null;
        })
        .catch(() => {
          // backend offline → settle locally so the round still closes
          const s = useGameStore.getState().strikes;
          settleLocally(
            pend,
            countWindow(s, pend.scopeKind, pend.scopeId, pend.placedAt, pend.placedAt + GAME_MS),
            Date.now(),
          );
          resolvingRound = null;
        });
    };

    const tick = () => {
      const now = Date.now();
      const strikes = useGameStore.getState().strikes;
      const { kind, id } = currentScope();
      const pend = useStrikeGameStore.getState().pending;

      const windowStart = pend?.placedAt ?? now;
      const windowEnd = windowStart + GAME_MS;
      const baselineStart = windowStart - GAME_MS;

      const prevCount = countWindow(strikes, kind, id, now - GAME_MS, now + 1);
      const currentCount = pend
        ? countWindow(strikes, pend.scopeKind, pend.scopeId, pend.placedAt, Math.min(now + 1, pend.placedAt + GAME_MS))
        : 0;
      const rollingLast30 = countWindow(strikes, kind, id, now - GAME_MS, now + 1);

      // series anchored to the active bet if present, otherwise to "now":
      // previous 30s | current 30s bet window.
      const base = baselineStart;
      const top = windowEnd;
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

      const elapsedMs = pend ? Math.max(0, Math.min(GAME_MS, now - pend.placedAt)) : 0;
      const msUntilResolve = pend ? Math.max(0, pend.placedAt + GAME_MS - now) : 0;

      // pending bet's live count + resolution
      let pendingCurrentCount = 0;
      if (pend) {
        pendingCurrentCount = countWindow(
          strikes,
          pend.scopeKind,
          pend.scopeId,
          pend.placedAt,
          Math.min(now + 1, pend.placedAt + GAME_MS),
        );
        if (now >= pend.placedAt + GAME_MS) {
          // Server settles when it accepted the bet; otherwise (local mode, or a
          // POST that never landed) settle locally so the round always closes.
          if (GAME_SERVER_ENABLED && pend.betId) settleFromServer(pend);
          else settleLocally(pend, pendingCurrentCount, now);
        }
      }

      setDerived({
        roundId: pend?.roundId ?? now,
        elapsedMs,
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

  const phase: GamePhase = pending ? 'locked' : 'betting';
  const playable = scope.kind === 'globe' ? true : scope.id !== '' && derived.rollingLast30 > 0;
  const canBet = !pending && playable && tokens > 0;

  const placeBet = useCallback((side: BetSide, amount: number) => {
    const st = useStrikeGameStore.getState();
    if (st.pending) return;

    const now = Date.now();

    const sc = currentScope();
    const strikes = useGameStore.getState().strikes;

    if (sc.kind === 'country') {
      if (!sc.id) return;
      if (countWindow(strikes, 'country', sc.id, now - GAME_MS, now + 1) <= 0) return;
    }

    const amt = Math.max(1, Math.min(Math.floor(amount), st.tokens));
    if (amt <= 0) return;

    const roundId = now; // legacy/audit id; the window starts at placedAt.
    const prevCount = countWindow(strikes, sc.kind, sc.id, now - GAME_MS, now + 1);

    // Optimistic local debit so the UI reacts instantly.
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

    // ── analytics ──
    trackBetPlaced({ side, amount: amt, scope: sc.kind, scopeId: sc.id });

    if (GAME_SERVER_ENABLED) {
      placeBetApi({
        roundId,
        side,
        amount: amt,
        scopeKind: sc.kind,
        scopeId: sc.id,
        prevCount,
      })
        .then((res) => {
          const cur = useStrikeGameStore.getState();
          if (cur.pending && cur.pending.roundId === roundId && !cur.pending.betId) {
            cur.attachBetId(res.betId);
            cur.setTokens(res.tokens); // reconcile to the server balance
          }
        })
        .catch(() => {
          /* backend offline/rejected — keep the optimistic local bet */
        });
    }
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

  const claimTokens = useCallback(() => {
    trackTokensClaimed();
    if (GAME_SERVER_ENABLED) {
      claimTokensApi()
        .then((p) => useStrikeGameStore.getState().setTokens(p.tokens))
        .catch(() => useStrikeGameStore.getState().claimTokens());
    } else {
      useStrikeGameStore.getState().claimTokens();
    }
  }, []);

  return {
    scope,
    playable,
    phase,
    roundId: derived.roundId,
    elapsedMs: derived.elapsedMs,
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
