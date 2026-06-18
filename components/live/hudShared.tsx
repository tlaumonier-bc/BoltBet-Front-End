// components/live/hudShared.tsx
// Stateless presentational pieces shared across the /live console panels.
import type { AlertSample, StormCellSample } from '@/lib/live/locations'

export function Section({
  title,
  badge,
  children,
}: {
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-4 border-t border-white/10 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-electric/70">
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </section>
  )
}

export function Stat({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-baseline justify-between gap-3 text-sm">
      <span className="text-white/45">{name}</span>
      <span className="text-right font-medium text-white/90">{value}</span>
    </div>
  )
}

export function BigStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-white/4 px-3 py-2">
      <div className="font-display text-2xl font-bold text-bolt">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  )
}

export function SampleTag({ label = 'sample' }: { label?: string }) {
  return (
    <span className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/35">
      {label}
    </span>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/40">{children}</p>
}

export function QualityBar({ pct }: { pct: { good: number; medium: number; bad: number } }) {
  return (
    <div className="mt-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="bg-emerald-400" style={{ width: `${pct.good}%` }} />
        <div className="bg-bolt" style={{ width: `${pct.medium}%` }} />
        <div className="bg-red-400" style={{ width: `${pct.bad}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>good {pct.good}%</span>
        <span>med {pct.medium}%</span>
        <span>bad {pct.bad}%</span>
      </div>
    </div>
  )
}

export function PulseBar({ cgShare }: { cgShare: number }) {
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="bg-bolt" style={{ width: `${cgShare}%` }} />
        <div className="bg-electric/70" style={{ width: `${100 - cgShare}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span className="text-bolt/80">CG {cgShare}%</span>
        <span className="text-electric/80">IC {100 - cgShare}%</span>
      </div>
    </div>
  )
}

export function RateSparkline({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets)
  const W = 272
  const H = 44
  const bw = W / Math.max(1, buckets.length)
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-11 w-full text-bolt"
      aria-label="Strikes per minute over the last 15 minutes"
    >
      {buckets.map((v, i) => {
        const h = Math.max(2, (v / max) * (H - 4))
        return (
          <rect
            key={i}
            x={i * bw + 1.5}
            y={H - h}
            width={bw - 3}
            height={h}
            rx={1.5}
            fill="currentColor"
            opacity={0.35 + 0.65 * (v / max)}
          />
        )
      })}
    </svg>
  )
}

const ALERT_STYLE: Record<AlertSample['severity'], string> = {
  warning: 'border-red-400/30 bg-red-400/10 text-red-300',
  watch: 'border-bolt/30 bg-bolt/10 text-bolt',
  advisory: 'border-electric/30 bg-electric/10 text-electric',
}

export function AlertRow({ alert }: { alert: AlertSample }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${ALERT_STYLE[alert.severity]}`}
    >
      <span className="font-medium">{alert.event}</span>
      <span className="shrink-0 opacity-70">{alert.expires}</span>
    </div>
  )
}

export function StormCellRow({ cell }: { cell: StormCellSample }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/4 px-2.5 py-1.5 text-[11px]">
      <span className="font-mono text-white/70">{cell.id}</span>
      <span className="text-white/50">
        {cell.bearing} · {cell.speedKph} km/h
      </span>
      <span className="text-white/50">hail {cell.hailProb}%</span>
      {cell.tag ? (
        <span className="rounded bg-red-400/15 px-1 py-0.5 text-[9px] font-bold text-red-300">
          {cell.tag}
        </span>
      ) : (
        <span className="text-white/25">—</span>
      )}
    </div>
  )
}

export function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function coord(lat: number, lon: number) {
  const la = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`
  return `${la} ${lo}`
}