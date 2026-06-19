'use client';
// components/game/ZoneBetPanel.tsx — right panel for Game mode: credits,
// performance, the multiplier-preview window (also drives the grid labels),
// active bets with countdowns, and recent results.
import { useEffect, useState } from 'react';
import { useZoneBetStore } from '@/store/zoneBetStore';
import { useZoneBetGame } from '@/lib/game/useZoneBetGame';
import { DURATIONS, durationLabel } from '@/lib/game/multiplier';
import { zoneCenter } from '@/lib/zones';
import { Section } from '@/components/live/hudShared';

function fmtZone(zid: string): string {
  const { lat, lon } = zoneCenter(zid);
  const la = `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}`;
  const lo = `${Math.abs(Math.round(lon))}°${lon >= 0 ? 'E' : 'W'}`;
  return `${la} ${lo}`;
}

export default function ZoneBetPanel() {
  useZoneBetGame();

  const credits = useZoneBetStore((s) => s.credits);
  const username = useZoneBetStore((s) => s.username);
  const activeBets = useZoneBetStore((s) => s.activeBets);
  const history = useZoneBetStore((s) => s.history);
  const previewDuration = useZoneBetStore((s) => s.previewDuration);
  const setPreviewDuration = useZoneBetStore((s) => s.setPreviewDuration);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const wins = history.filter((h) => h.status === 'won').length;
  const winRate = history.length ? Math.round((wins / history.length) * 100) : 0;

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 w-full flex-1 overflow-y-auto rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
          Zone game
        </span>
        <span className="text-[11px] text-white/45">{username}</span>
      </div>

      {/* credits */}
      <div className="mt-3 rounded-xl border border-white/10 bg-linear-to-br from-white/8 to-transparent px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-white/40">Credits</div>
        <div className="font-display text-4xl font-extrabold tabular-nums text-bolt">
          {Math.round(credits)}
        </div>
        <div className="mt-1 flex gap-2 text-[11px] text-white/45">
          <span>
            {wins}W / {history.length - wins}L
          </span>
          <span className="text-white/25">·</span>
          <span>{winRate}% win rate</span>
        </div>
      </div>

      {/* multiplier preview window */}
      <Section title="Multiplier preview">
        <div className="flex gap-1 rounded-full bg-white/5 p-1 text-xs font-semibold">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => setPreviewDuration(d)}
              className={`flex-1 rounded-full px-2 py-1.5 transition ${
                previewDuration === d ? 'bg-electric text-storm' : 'text-white/60 hover:text-white'
              }`}
            >
              {durationLabel(d)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/45">
          The grid shows payout for this window. Click a box on the globe to bet — you win if it gets
          the most strikes worldwide before time runs out.
        </p>
      </Section>

      {/* active bets */}
      <Section title={`Active bets (${activeBets.length})`}>
        {activeBets.length === 0 ? (
          <p className="text-xs text-white/40">No active bets. Click a box to start.</p>
        ) : (
          <div className="space-y-1.5">
            {activeBets.map((b) => {
              const left = Math.max(0, b.expiresAt - now);
              const mm = Math.floor(left / 60000);
              const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
              return (
                <div key={b.id} className="rounded-lg bg-white/4 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-white/90">{fmtZone(b.zoneId)}</span>
                    <span className="text-bolt">{b.multiplier}x</span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-white/45">
                    <span>
                      {b.amount} → {Math.round(b.amount * b.multiplier)}
                    </span>
                    <span className="font-mono">
                      {mm}:{ss}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* recent results */}
      {history.length > 0 && (
        <Section title="Recent results">
          <div className="space-y-1">
            {history.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center justify-between text-xs">
                <span className="text-white/70">
                  {fmtZone(b.zoneId)} · {durationLabel(b.durationMinutes)}
                </span>
                <span
                  className={
                    b.status === 'won' ? 'font-semibold text-emerald-400' : 'text-white/40'
                  }
                >
                  {b.status === 'won' ? `+${b.payout}` : `−${b.amount}`}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}