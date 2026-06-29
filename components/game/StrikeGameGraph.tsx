'use client';
// components/game/StrikeGameGraph.tsx
// previous 30s baseline (blue) · current bet window (yellow)
import { SERIES_CURRENT_START, SERIES_LEN } from '@/lib/game/useStrikeGame';

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
        <span style={{ width: `${(SERIES_CURRENT_START / N) * 100}%` }} className="text-electric/70">
          prev 30s
        </span>
        <span className="flex-1 text-right text-bolt/70">bet window</span>
      </div>

      <div className="rounded-xl bg-white/4 p-3">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
          {series.map((v, i) => {
            const h = v === 0 ? 0 : Math.max(2, (v / seriesMax) * 56);
            const isPrev = i < SERIES_CURRENT_START;
            const future = i > nowIndex;
            const fill = isPrev ? '#38bdf8' : '#fde047';
            const op = future ? 0.12 : 0.4 + 0.6 * (v / seriesMax);
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
          <div className="text-[10px] uppercase tracking-wider text-white/40">bet window</div>
          <div className="font-display text-2xl font-bold tabular-nums text-bolt">{currentCount}</div>
        </div>
      </div>
    </div>
  );
}