'use client';
// components/game/ZoneBetModal.tsx — centred bet popup for the selected zone.
import { useEffect, useState } from 'react';
import { useZoneBetStore, type ZoneBet } from '@/store/zoneBetStore';
import { DURATIONS, durationLabel, multiplierColor } from '@/lib/game/multiplier';
import { zoneCenter } from '@/lib/zones';
import { placeZoneBet } from '@/lib/game/zoneBetApi';

function fmtZone(zid: string): string {
  const { lat, lon } = zoneCenter(zid);
  const la = `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}`;
  const lo = `${Math.abs(Math.round(lon))}°${lon >= 0 ? 'E' : 'W'}`;
  return `${la} ${lo}`;
}

export default function ZoneBetModal() {
  const zoneId = useZoneBetStore((s) => s.selectedZoneId);
  const multipliers = useZoneBetStore((s) => s.multipliers);
  const credits = useZoneBetStore((s) => s.credits);
  const username = useZoneBetStore((s) => s.username);
  const previewDuration = useZoneBetStore((s) => s.previewDuration);
  const placeBetLocal = useZoneBetStore((s) => s.placeBet);
  const setCredits = useZoneBetStore((s) => s.setCredits);
  const close = () => useZoneBetStore.getState().selectZone(null);

  const [amount, setAmount] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  // Reset the chosen window when the modal opens for a different zone — done
  // via a render-time reset key (not an effect), so it can't cascade renders.
  const [durationState, setDuration] = useState(previewDuration);
  const [lastZone, setLastZone] = useState(zoneId);
  if (zoneId !== lastZone) {
    setLastZone(zoneId);
    setDuration(previewDuration);
  }
  const duration = durationState;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!zoneId) return null;

  const z = multipliers[zoneId];
  const mult = z?.byDuration[duration] ?? 1;
  const payout = Math.round(amount * mult);
  const color = multiplierColor(mult);

  async function confirm() {
    if (!zoneId || amount <= 0 || amount > credits) return;
    setSubmitting(true);
    const t = Date.now();
    const bet: ZoneBet = {
      id: crypto.randomUUID(),
      zoneId,
      durationMinutes: duration,
      amount,
      multiplier: mult,
      placedAt: t,
      expiresAt: t + duration * 60_000,
      status: 'pending',
      payout: 0,
    };
    try {
      const res = await placeZoneBet(zoneId, duration, amount, username || 'anonymous');
      bet.id = res.bet.id;
      bet.multiplier = res.bet.multiplier;
      bet.expiresAt = Date.parse(res.bet.expires_at);
      placeBetLocal(bet);
      setCredits(res.credits); // backend authoritative
    } catch {
      placeBetLocal(bet); // offline: optimistic local bet (store deducts credits)
    }
    setSubmitting(false);
    close();
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="glass w-full max-w-md rounded-2xl border border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Bet on {fmtZone(zoneId)}</h2>
            <p className="text-xs text-white/45">Zone {zoneId}</p>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <span className="font-display text-5xl font-extrabold tabular-nums" style={{ color }}>
            {mult}x
          </span>
          <span className="pb-2 text-sm text-white/50">payout · {durationLabel(duration)}</span>
        </div>

        <p className="mt-3 text-sm text-white/70">
          Win if this box gets the most strikes worldwide in the next {durationLabel(duration)} — for{' '}
          <span className="font-semibold text-bolt">{payout} credits</span>.
        </p>

        <div className="mt-4">
          <p className="mb-2 text-xs text-white/50">Window</p>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-lg px-2 py-2 text-sm transition ${
                  duration === d
                    ? 'bg-bolt font-semibold text-storm'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {durationLabel(d)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/50">
            <span>Amount (credits)</span>
            <span>Balance: {Math.round(credits)}</span>
          </div>
          <input
            type="number"
            min={1}
            max={credits}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-bolt"
          />
        </div>

        <button
          onClick={confirm}
          disabled={submitting || amount <= 0 || amount > credits}
          className="btn-glow mt-5 w-full rounded-xl py-3 font-bold disabled:opacity-40"
        >
          {submitting ? 'Placing…' : `Place bet — win ${payout}`}
        </button>
      </div>
    </div>
  );
}