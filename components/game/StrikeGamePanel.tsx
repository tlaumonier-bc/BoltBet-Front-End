'use client';
// components/game/StrikeGamePanel.tsx — right-side panel for Game mode.
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useStrikeGameStore } from '@/store/strikeGameStore';
import { flagEmoji } from '@/lib/live/owm';
import { Section } from '@/components/live/hudShared';
import StrikeGameGraph from './StrikeGameGraph';
import type { StrikeGameVM } from '@/lib/game/useStrikeGame';
import { getLeaderboardContext, type LeaderboardContext, type LeaderboardEntry, type Trophy } from '@/lib/api';

function fmtNet(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function trophySrc(trophy: Trophy): string {
  return `/images/trophies/${trophy.image}`;
}

function TrophyImage({ trophy, size = 28 }: { trophy: Trophy | null; size?: number }) {
  if (!trophy) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-white/35"
        style={{ width: size, height: size }}
        aria-label="No trophy yet"
      >
        -
      </span>
    );
  }
  return (
    <Image
      src={trophySrc(trophy)}
      alt={trophy.label}
      width={size}
      height={size}
      className="shrink-0 object-contain drop-shadow-[0_0_10px_rgba(250,204,21,0.18)]"
    />
  );
}

function LeaderboardRow({ row, current }: { row: LeaderboardEntry; current: boolean }) {
  return (
    <div
      className={`grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
        current ? 'border border-bolt/25 bg-bolt/10' : 'bg-white/[0.035]'
      }`}
    >
      <span className="text-center text-base leading-none">{flagEmoji(row.country || null)}</span>
      <div className="min-w-0">
        <div className={`truncate font-semibold ${current ? 'text-bolt' : 'text-white/80'}`}>
          {row.rank ? `#${row.rank} ` : ''}{row.username}
        </div>
      </div>
      <span className="font-display text-right font-bold tabular-nums text-white/85">
        {row.tokens.toLocaleString()}
      </span>
      <TrophyImage trophy={row.trophy} size={24} />
    </div>
  );
}

function MiniLeaderboard({ context, username, tokens }: { context: LeaderboardContext | null; username: string; tokens: number }) {
  if (!context) {
    return (
      <Section title="Leaderboard">
        <div className="rounded-xl bg-white/4 px-4 py-3 text-sm text-white/45">Loading ranking...</div>
      </Section>
    );
  }

  const next = context.nextTrophy;
  const prevThreshold = context.trophies.reduce((best, trophy) => (tokens >= trophy.points ? trophy.points : best), 0);
  const progress = next
    ? Math.max(0, Math.min(100, ((tokens - prevThreshold) / (next.points - prevThreshold)) * 100))
    : 100;

  return (
    <Section title="Leaderboard">
      <div className="rounded-xl border border-white/10 bg-linear-to-br from-white/8 to-transparent p-3">
        <div className="flex items-center gap-3">
          <TrophyImage trophy={next} size={38} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Next trophy</div>
            <div className="truncate text-sm font-semibold text-white/85">
              {next ? `${next.label} at ${next.points.toLocaleString()} points` : 'All trophies unlocked'}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-bolt" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {context.rows.map((row) => (
          <LeaderboardRow key={`${row.rank}-${row.username}`} row={row} current={row.username === username} />
        ))}
      </div>
    </Section>
  );
}

export default function StrikeGamePanel({ vm }: { vm: StrikeGameVM }) {
  const username = useStrikeGameStore((s) => s.username);
  const history = useStrikeGameStore((s) => s.history);
  const [leaderboardContext, setLeaderboardContext] = useState<LeaderboardContext | null>(null);

  const isCountry = vm.scope.kind === 'country';
  const iso2 = isCountry ? vm.scope.id : null;

  const wins = history.filter((h) => h.outcome === 'won').length;
  const losses = history.filter((h) => h.outcome === 'lost').length;
  const decided = wins + losses;
  const winRate = decided ? Math.round((wins / decided) * 100) : 0;
  const net = history.reduce((a, h) => a + (h.payout - h.amount), 0);
  let streak = 0;
  for (const h of history) {
    if (h.outcome === 'won') streak++;
    else break;
  }

  useEffect(() => {
    let alive = true;
    const load = () => {
      getLeaderboardContext()
        .then((data) => {
          if (alive) setLeaderboardContext(data);
        })
        .catch(() => {
          if (alive) setLeaderboardContext(null);
        });
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [vm.tokens]);

  // not-playable country — but never hide a live play behind it
  if (isCountry && !vm.playable && !vm.pending) {
    return (
      <div className="glass panel-scroll pointer-events-auto min-h-0 w-full flex-1 overflow-y-auto rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{flagEmoji(iso2)}</span>
          <div>
            <div className="font-display text-base font-bold leading-tight">{vm.scope.label}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/45">Not playable</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-white/60">
          No strikes detected here in the last 30 seconds, so there&rsquo;s nothing to predict yet.
          Pick a country with live activity, or take on the whole globe.
        </p>

        <button
          onClick={() => {
            if (!vm.findPlayableCountry()) vm.playGlobe();
          }}
          className="btn-glow mt-5 w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-bold"
        >
          ⚡ Find a playable country
        </button>
        <div className="my-3 text-center text-[11px] uppercase tracking-wider text-white/30">— or —</div>
        <button
          onClick={vm.playGlobe}
          className="w-full cursor-pointer rounded-xl border border-electric/40 bg-electric/10 px-4 py-3 text-sm font-bold text-electric transition hover:bg-electric/20"
        >
          🌍 Play the whole globe
        </button>
      </div>
    );
  }

  const countdown = vm.pending
    ? `${Math.ceil(vm.msUntilResolve / 1000)}s to result`
    : 'play anytime';

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 w-full overflow-y-auto rounded-2xl p-4">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
          Strike game
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="text-lg leading-none">{isCountry ? flagEmoji(iso2) : '🌍'}</span>
          <span className="truncate font-medium text-white/85">{vm.scope.label}</span>
        </span>
      </div>

      {/* points */}
      <div className="mt-3 rounded-xl border border-white/10 bg-linear-to-br from-white/8 to-transparent px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <div className="font-display text-4xl font-extrabold tabular-nums text-bolt">
              {Math.round(vm.tokens)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Points</div>
          </div>
          {streak >= 2 && (
            <span className="rounded-full bg-orange-400/15 px-2.5 py-1 text-xs font-bold text-orange-300">
              🔥 {streak} streak
            </span>
          )}
        </div>
        <div className="mt-1 flex gap-2 text-[11px] text-white/45">
          <span>{wins}W / {losses}L</span>
          <span className="text-white/25">·</span>
          <span>{winRate}% win rate</span>
          <span className="text-white/25">·</span>
          <span className={net >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}>{fmtNet(net)} net</span>
        </div>
      </div>

      <MiniLeaderboard context={leaderboardContext} username={username} tokens={Math.round(vm.tokens)} />

      {/* graph */}
      <Section title={`Activity · ${countdown}`}>
        <StrikeGameGraph
          series={vm.series}
          seriesMax={vm.seriesMax}
          nowIndex={vm.nowIndex}
          prevCount={vm.prevCount}
          currentCount={vm.currentCount}
        />
      </Section>

      {/* last 3 games */}
      {history.length > 0 && (
        <Section title="Last 3 games">
          <div className="space-y-1">
            {history.slice(0, 3).map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-white/65">
                  {h.side === 'up' ? '↑' : '↓'} {h.scopeLabel} · {h.prevCount}→{h.finalCount}
                </span>
                <span
                  className={
                    h.outcome === 'won'
                      ? 'font-semibold text-emerald-400'
                      : h.outcome === 'push'
                      ? 'text-white/45'
                      : 'text-rose-400/80'
                  }
                >
                  {h.outcome === 'won' ? `+${h.amount}` : h.outcome === 'push' ? '±0' : `−${h.amount}`}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}