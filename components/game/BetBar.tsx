'use client';
// components/game/BetBar.tsx — bottom-centre play bar for Game mode.
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useStrikeGameStore } from '@/store/strikeGameStore';
import { flagEmoji } from '@/lib/live/owm';
import {
  PAYOUT_MULTIPLIER,
  GAME_MS,
  type StrikeGameVM,
} from '@/lib/game/useStrikeGame';

const CHIPS = [10, 25, 50];
const FLOAT_MS = 1600;

export default function BetBar({ vm, variant = 'fixed' }: { vm: StrikeGameVM; variant?: 'fixed' | 'embedded' | 'compact' }) {
  const [amount, setAmount] = useState(10);
  const isCountry = vm.scope.kind === 'country';

  const clampAmt = Math.max(1, Math.min(amount, Math.max(1, Math.floor(vm.tokens))));
  const toWin = clampAmt * PAYOUT_MULTIPLIER;

  const gamePct = vm.pending ? Math.min(100, (vm.elapsedMs / GAME_MS) * 100) : 0;

  // ── result float: rises out of the top of the bar when a bet resolves ──────
  const lastResult = useStrikeGameStore((s) => s.history[0]);
  const lastResultId = lastResult?.id;
  const seenRef = useRef<string | null | undefined>(undefined);
  const [floatResult, setFloatResult] = useState<typeof lastResult | null>(null);

  useEffect(() => {
    // First render: record the latest persisted result without animating it.
    if (seenRef.current === undefined) {
      seenRef.current = lastResultId ?? null;
      return;
    }
    if (lastResult && lastResultId !== seenRef.current) {
      seenRef.current = lastResultId ?? null;
      setFloatResult(lastResult);
      const t = setTimeout(() => setFloatResult(null), FLOAT_MS);
      return () => clearTimeout(t);
    }
  }, [lastResultId, lastResult]);

  const floatText =
    floatResult?.outcome === 'won'
      ? `⚡ +${floatResult.amount}`
      : floatResult?.outcome === 'lost'
      ? `−${floatResult.amount}`
      : '±0';
  const floatColor =
    floatResult?.outcome === 'won'
      ? 'text-bolt'
      : floatResult?.outcome === 'lost'
      ? 'text-rose-400'
      : 'text-white/70';

  const handleFind = () => {
    if (!vm.findPlayableCountry()) {
      useGameStore.getState().pushNotification({
        type: 'info',
        message: 'No active countries right now — playing the globe.',
      });
      vm.playGlobe();
    }
  };

  const compactContent = (
    <div className="glass-opaque pointer-events-auto relative rounded-2xl border border-white/10 p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-base leading-none">{isCountry ? flagEmoji(vm.scope.id || null) : '🌍'}</span>
          <span className="truncate font-semibold text-white/85">{vm.scope.label}</span>
          {isCountry && (
            <button
              type="button"
              onClick={vm.playGlobe}
              className="shrink-0 rounded-md border border-electric/30 bg-electric/10 px-1.5 py-0.5 text-[10px] font-bold text-electric"
            >
              Globe
            </button>
          )}
        </div>
        <div className="font-display shrink-0 font-bold tabular-nums text-bolt">{Math.round(vm.tokens)} pts</div>
      </div>

      <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 bg-bolt/80 transition-[width] duration-200 ease-linear" style={{ width: `${gamePct}%` }} />
      </div>

      {vm.pending ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={`font-display text-lg font-extrabold ${vm.pending.side === 'up' ? 'text-emerald-300' : 'text-rose-300'}`}>
                {vm.pending.side === 'up' ? '↑ Higher' : '↓ Lower'}
              </div>
              <div className="mt-1 text-[11px] text-white/45">
                Beat {vm.pending.prevCount} · now {vm.pendingCurrentCount}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-extrabold tabular-nums text-white">
                {Math.ceil(vm.msUntilResolve / 1000)}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-white/40">sec</div>
            </div>
          </div>
        </div>
      ) : isCountry && !vm.playable ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={handleFind} className="btn-glow min-h-10 rounded-xl px-2 text-xs font-bold">
            Find country
          </button>
          <button
            onClick={vm.playGlobe}
            className="min-h-10 rounded-xl border border-electric/40 bg-electric/10 px-2 text-xs font-bold text-electric"
          >
            Play globe
          </button>
        </div>
      ) : vm.tokens <= 0 ? (
        <button onClick={vm.claimTokens} className="btn-glow mt-3 min-h-10 w-full rounded-xl px-3 text-xs font-bold">
          Claim 100 free points
        </button>
      ) : vm.canBet ? (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-white/55">
            <span>Beat <span className="font-bold text-electric">{vm.prevCount}</span> strikes?</span>
            <div className="flex gap-1">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAmount(c)}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold ${clampAmt === c ? 'bg-bolt text-storm' : 'bg-white/8 text-white/65'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => vm.placeBet('up', clampAmt)}
              className="min-h-13 rounded-xl bg-emerald-500 px-2 text-white active:scale-[0.98]"
            >
              <div className="font-display text-base font-extrabold">↑ HIGHER</div>
              <div className="text-[11px] font-semibold text-white/90">win {toWin} pts</div>
            </button>
            <button
              onClick={() => vm.placeBet('down', clampAmt)}
              className="min-h-13 rounded-xl bg-rose-500 px-2 text-white active:scale-[0.98]"
            >
              <div className="font-display text-base font-extrabold">↓ LOWER</div>
              <div className="text-[11px] font-semibold text-white/90">win {toWin} pts</div>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.04] p-3 text-xs text-white/70">
          <span>Waiting for result</span>
          <span className="font-display text-lg font-bold text-electric">{Math.ceil(vm.msUntilResolve / 1000)}s</span>
        </div>
      )}
    </div>
  );

  const content = (
    <div className="glass-opaque pointer-events-auto relative rounded-2xl border border-white/10 p-4 shadow-2xl">
        {/* result float */}
        {floatResult && (
          <span
            key={floatResult.id}
            aria-hidden
            className={`bet-float pointer-events-none absolute left-1/2 top-0 z-10 font-display text-2xl font-extrabold tabular-nums drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] ${floatColor}`}
          >
            {floatText}
          </span>
        )}

        {/* header: scope + points */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-base leading-none">{isCountry ? flagEmoji(vm.scope.id || null) : '🌍'}</span>
            <span className="truncate font-medium text-white/85">{vm.scope.label}</span>
            {isCountry && (
              <button
                type="button"
                onClick={vm.playGlobe}
                className="shrink-0 cursor-pointer rounded-md border border-electric/30 bg-electric/10 px-2 py-0.5 text-[11px] font-bold text-electric transition hover:bg-electric/20"
              >
                Play whole globe
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-white/40">Points</span>
            <span className="font-display font-bold tabular-nums text-bolt">{Math.round(vm.tokens)}</span>
          </div>
        </div>

        {/* active-play progress bar */}
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 bg-bolt/80 transition-[width] duration-200 ease-linear"
            style={{ width: `${gamePct}%` }}
          />
        </div>

        {/* ── content (pending first, so a live play stays visible) ───────── */}
        {vm.pending ? (
          <div className="mt-4">
            <div
              className={`rounded-2xl border px-4 py-4 ${
                vm.pending.side === 'up'
                  ? 'border-emerald-300/35 bg-emerald-300/10'
                  : 'border-rose-300/35 bg-rose-300/10'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">Current play</div>
                  <div className={`mt-1 font-display text-2xl font-extrabold ${vm.pending.side === 'up' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {vm.pending.side === 'up' ? '↑ HIGHER' : '↓ LOWER'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-4xl font-extrabold tabular-nums text-white">
                    {Math.ceil(vm.msUntilResolve / 1000)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">seconds left</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="rounded-xl bg-black/18 px-3 py-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-electric/70">Score to beat</div>
                  <div className="font-display text-4xl font-extrabold tabular-nums text-electric">{vm.pending.prevCount}</div>
                </div>
                <div className="font-display text-lg font-black text-white/35">vs</div>
                <div className="rounded-xl bg-black/18 px-3 py-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-bolt/70">Now</div>
                  <div className="font-display text-4xl font-extrabold tabular-nums text-bolt">{vm.pendingCurrentCount}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
                <span>{vm.pending.scopeLabel}</span>
                <span>
                  {vm.pending.amount} → <span className="font-semibold text-bolt">{vm.pending.amount * PAYOUT_MULTIPLIER}</span> points
                </span>
              </div>
            </div>
          </div>
        ) : isCountry && !vm.playable ? (
          <div className="mt-3">
            <p className="text-sm text-white/65">
              No strikes in <span className="font-medium text-white/85">{vm.scope.label}</span> in the last 30s — not playable.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={handleFind} className="btn-glow flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-bold">
                ⚡ Find a playable country
              </button>
              <button
                onClick={vm.playGlobe}
                className="flex-1 cursor-pointer rounded-xl border border-electric/40 bg-electric/10 py-2.5 text-sm font-bold text-electric transition hover:bg-electric/20"
              >
                🌍 Play whole globe
              </button>
            </div>
          </div>
        ) : vm.tokens <= 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-white/65">You&rsquo;re out of points.</p>
            <button onClick={vm.claimTokens} className="btn-glow cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold">
              Claim 100 free points
            </button>
          </div>
        ) : vm.canBet ? (
          <div className="mt-3">
            <p className="text-center text-sm text-white/70">
              More or fewer than <span className="font-bold text-electric">{vm.prevCount}</span> strikes in the next 30s?
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={() => vm.placeBet('up', clampAmt)}
                className="flex cursor-pointer flex-col items-center gap-0.5 rounded-xl bg-emerald-500 py-3.5 text-white transition hover:bg-emerald-400 active:scale-[0.97]"
              >
                <span className="font-display text-lg font-extrabold leading-none">↑ HIGHER</span>
                <span className="text-xs font-semibold text-white/90">win {toWin} points</span>
              </button>
              <button
                onClick={() => vm.placeBet('down', clampAmt)}
                className="flex cursor-pointer flex-col items-center gap-0.5 rounded-xl bg-rose-500 py-3.5 text-white transition hover:bg-rose-400 active:scale-[0.97]"
              >
                <span className="font-display text-lg font-extrabold leading-none">↓ LOWER</span>
                <span className="text-xs font-semibold text-white/90">win {toWin} points</span>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAmount(c)}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      clampAmt === c ? 'bg-bolt text-storm' : 'bg-white/8 text-white/70 hover:bg-white/15'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => setAmount(Math.floor(vm.tokens))}
                  className="cursor-pointer rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/15"
                >
                  Max
                </button>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                Play anytime
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-white/75">Waiting for this play to settle.</p>
            <div className="text-right">
              <div className="font-display text-2xl font-extrabold tabular-nums text-electric">
                {Math.ceil(vm.msUntilResolve / 1000)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">seconds to result</div>
            </div>
          </div>
        )}
    </div>
  );

  if (variant === 'embedded') return content;
  if (variant === 'compact') return compactContent;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 w-[min(640px,94vw)] -translate-x-1/2 max-md:hidden">
      {content}
    </div>
  );
}