'use client';
// components/game/StrikeGameGraph.tsx
// prev game (30s, blue) · buffer (10s, grey "no count") · next game (30s, yellow)
import { SERIES_BUFFER_START, SERIES_CURRENT_START, SERIES_LEN } from '@/lib/game/useStrikeGame';

export default function StrikeGameGraph({
  series,
  seriesMax,
  nowIndex,
  prevCount,
  currentCount,
}: {
  series: number[];
  seriesMax: number;
  nowIndex: number;
  prevCount: number;
  currentCount: number;
}) {
  const N = SERIES_LEN;
  const bw = 100 / N;
  const x = (i: number) => (i / N) * 100;

  return (
    <div>
      <div className="mb-1.5 flex items-center text-[10px] uppercase tracking-wider text-white/40">
        <span style={{ width: `${(SERIES_BUFFER_START / N) * 100}%` }} className="text-electric/70">
          prev 30s
        </span>
        <span style={{ width: `${((SERIES_CURRENT_START - SERIES_BUFFER_START) / N) * 100}%` }} className="text-center text-white/30">
          buffer
        </span>
        <span className="flex-1 text-right text-bolt/70">next 30s</span>
      </div>

      <div className="rounded-xl bg-white/4 p-3">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
          {/* buffer band */}
          <rect
            x={x(SERIES_BUFFER_START)}
            y={0}
            width={x(SERIES_CURRENT_START) - x(SERIES_BUFFER_START)}
            height={60}
            fill="white"
            opacity={0.04}
          />
          {series.map((v, i) => {
            const h = v === 0 ? 0 : Math.max(2, (v / seriesMax) * 56);
            const inBuffer = i >= SERIES_BUFFER_START && i < SERIES_CURRENT_START;
            const isPrev = i < SERIES_BUFFER_START;
            const future = i > nowIndex;
            const fill = inBuffer ? '#94a3b8' : isPrev ? '#38bdf8' : '#fde047';
            const op = future ? 0.12 : (inBuffer ? 0.3 : 0.4 + 0.6 * (v / seriesMax));
            return (
              <rect
                key={i}
                x={i * bw + 0.2}
                y={60 - h}
                width={Math.max(0.5, bw - 0.4)}
                height={h}
                rx={0.4}
                fill={fill}
                opacity={op}
              />
            );
          })}
          {/* now marker */}
          <line x1={x(nowIndex)} y1="0" x2={x(nowIndex)} y2="60" stroke="#fde047" strokeWidth="0.7" opacity="0.9" />
        </svg>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/4 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">last 30s</div>
          <div className="font-display text-2xl font-bold tabular-nums text-electric">{prevCount}</div>
        </div>
        <div className="rounded-lg bg-white/4 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">next 30s</div>
          <div className="font-display text-2xl font-bold tabular-nums text-bolt">{currentCount}</div>
        </div>
      </div>
    </div>
  );
}