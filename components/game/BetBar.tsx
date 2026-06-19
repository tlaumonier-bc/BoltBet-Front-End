'use client';
// components/game/BetBar.tsx — bottom-centre action bar for Game mode.
import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { flagEmoji } from '@/lib/live/owm';
import {
  PAYOUT_MULTIPLIER,
  BUFFER_MS,
  CYCLE_MS,
  type StrikeGameVM,
} from '@/lib/game/useStrikeGame';

const CHIPS = [10, 25, 50];

export default function BetBar({ vm }: { vm: StrikeGameVM }) {
  const [amount, setAmount] = useState(10);
  const isCountry = vm.scope.kind === 'country';

  const clampAmt = Math.max(1, Math.min(amount, Math.max(1, Math.floor(vm.tokens))));
  const toWin = clampAmt * PAYOUT_MULTIPLIER;
  const cyclePct = Math.min(100, (vm.elapsedMs / CYCLE_MS) * 100);

  const handleFind = () => {
    if (!vm.findPlayableCountry()) {
      useGameStore.getState().pushNotification({
        type: 'info',
        message: 'No active countries right now — playing the globe.',
      });
      vm.playGlobe();
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 w-[min(700px,94vw)] -translate-x-1/2">
      <div className="glass pointer-events-auto rounded-2xl border border-white/10 p-4 shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-base leading-none">{isCountry ? flagEmoji(vm.scope.id || null) : '🌍'}</span>
            <span className="font-medium text-white/85">{vm.scope.label}</span>
            {isCountry && (
              <button
                onClick={vm.playGlobe}
                className="ml-1 rounded-md bg-white/8 px-2 py-0.5 text-[11px] font-medium text-white/60 transition hover:bg-white/15 hover:text-white"
              >
                🌍 Globe
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-[11px] uppercase tracking-wider text-white/40">Tokens</span>
            <span className="font-display font-bold tabular-nums text-bolt">{Math.round(vm.tokens)}</span>
          </div>
        </div>

        {/* cycle timeline (buffer zone = last 25%) */}
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-y-0 right-0 bg-emerald-400/20" style={{ width: `${(BUFFER_MS / CYCLE_MS) * 100}%` }} />
          <div className="absolute inset-y-0 left-0 bg-bolt/80 transition-[width] duration-200 ease-linear" style={{ width: `${cyclePct}%` }} />
        </div>

        {/* ── content (pending first, so a live bet stays visible) ────────── */}
        {vm.pending ? (
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <div className={`font-display text-lg font-bold ${vm.pending.side === 'up' ? 'text-emerald-300' : 'text-rose-300'}`}>
                {vm.pending.side === 'up' ? '↑ HIGHER' : '↓ LOWER'} · {vm.pending.amount} tokens
              </div>
              <div className="mt-0.5 text-xs text-white/55">
                {vm.pending.scopeLabel} · beat <span className="font-semibold text-electric">{vm.pending.prevCount}</span> ·
                now <span className="font-semibold text-bolt">{vm.pendingCurrentCount}</span> · win{' '}
                <span className="font-semibold text-bolt">{vm.pending.amount * 2}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-extrabold tabular-nums text-white">
                {Math.ceil(vm.msUntilResolve / 1000)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">s to result</div>
            </div>
          </div>
        ) : isCountry && !vm.playable ? (
          <div className="mt-3">
            <p className="text-sm text-white/65">
              No strikes in <span className="font-medium text-white/85">{vm.scope.label}</span> in the last 30s — not playable.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={handleFind} className="btn-glow flex-1 rounded-xl py-2.5 text-sm font-bold">
                ⚡ Find a playable country
              </button>
              <button
                onClick={vm.playGlobe}
                className="flex-1 rounded-xl border border-electric/40 bg-electric/10 py-2.5 text-sm font-bold text-electric transition hover:bg-electric/20"
              >
                🌍 Play the globe
              </button>
            </div>
          </div>
        ) : vm.tokens <= 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-white/65">You&rsquo;re out of tokens.</p>
            <button onClick={vm.claimTokens} className="btn-glow rounded-xl px-4 py-2.5 text-sm font-bold">
              Claim 100 free tokens
            </button>
          </div>
        ) : vm.canBet ? (
          <div className="mt-3">
            {/* big, obvious instruction */}
            <p className="text-center text-base font-bold leading-snug text-white sm:text-lg">
              More or fewer strikes in the next 30s than the last?
            </p>
            <p className="mt-1 text-center text-sm text-white/70">
              Beat <span className="font-bold text-electric">{vm.prevCount}</span> strikes — pick a side, double your tokens if you&rsquo;re right.
            </p>

            {/* flashy up / down */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={() => vm.placeBet('up', clampAmt)}
                className="flex flex-col items-center gap-0.5 rounded-2xl bg-linear-to-b from-emerald-400 to-emerald-600 py-4 text-white shadow-[0_8px_26px_-6px_rgba(16,185,129,0.85)] ring-1 ring-emerald-300/50 transition hover:from-emerald-300 hover:to-emerald-500 hover:shadow-[0_10px_32px_-6px_rgba(16,185,129,1)] active:scale-[0.97]"
              >
                <span className="font-display text-xl font-extrabold leading-none">↑ HIGHER</span>
                <span className="text-xs font-semibold text-white/95">win {toWin} tokens</span>
              </button>
              <button
                onClick={() => vm.placeBet('down', clampAmt)}
                className="flex flex-col items-center gap-0.5 rounded-2xl bg-linear-to-b from-rose-400 to-rose-600 py-4 text-white shadow-[0_8px_26px_-6px_rgba(244,63,94,0.85)] ring-1 ring-rose-300/50 transition hover:from-rose-300 hover:to-rose-500 hover:shadow-[0_10px_32px_-6px_rgba(244,63,94,1)] active:scale-[0.97]"
              >
                <span className="font-display text-xl font-extrabold leading-none">↓ LOWER</span>
                <span className="text-xs font-semibold text-white/95">win {toWin} tokens</span>
              </button>
            </div>

            {/* stake chips */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAmount(c)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      clampAmt === c ? 'bg-bolt text-storm' : 'bg-white/8 text-white/70 hover:bg-white/15'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => setAmount(Math.floor(vm.tokens))}
                  className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/15"
                >
                  Max
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.floor(vm.tokens)}
                  value={clampAmt}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-bolt"
                />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                {Math.ceil(vm.msUntilLock / 1000)}s to bet
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/75">Game in play — betting locked.</p>
              <p className="mt-0.5 text-xs text-white/45">
                Next 30s vs <span className="text-electric">{vm.prevCount}</span> · live{' '}
                <span className="text-bolt">{vm.currentCount}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-extrabold tabular-nums text-electric">
                {Math.ceil(vm.msUntilResolve / 1000)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">seconds to next bet</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}