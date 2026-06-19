'use client'
// components/live/StrikeHistoryChart.tsx
// Histogram of the latest ~1000 strikes for the selected country over time.
// X axis auto-scales to the span between the oldest loaded strike and now
// (a year of data → a year-wide axis; an hour of data → an hour-wide axis).
// Y axis is the strike count per time bucket.

import { useMemo } from 'react'
import type { CountryStrike } from '@/lib/api'

const BUCKETS = 30
const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

// Pick a date/time formatter appropriate to the visible span.
function pickFormatter(span: number): (ms: number) => string {
  if (span >= 300 * DAY)
    return (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  if (span >= 60 * DAY)
    return (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (span >= 2 * DAY)
    return (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  // hours / minutes
  return (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// "each bar ≈ …" granularity hint.
function humanDuration(ms: number): string {
  const s = ms / 1000
  if (s < 90) return `${Math.round(s)}s`
  const m = s / 60
  if (m < 90) return `${Math.round(m)}m`
  const h = m / 60
  if (h < 36) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

export default function StrikeHistoryChart({
  rows,
  now,
}: {
  rows: CountryStrike[]
  now: number
}) {
  const data = useMemo(() => {
    const times: number[] = []
    for (const r of rows) {
      const t = Date.parse(r.received_at)
      if (Number.isFinite(t)) times.push(t)
    }
    if (times.length === 0) return null

    let minT = Infinity
    let maxT = -Infinity
    for (const t of times) {
      if (t < minT) minT = t
      if (t > maxT) maxT = t
    }

    const left = minT
    const right = Math.max(now, maxT) // anchor the right edge at "now"
    const span = Math.max(MIN, right - left)
    const bucketMs = span / BUCKETS

    const bins = Array.from({ length: BUCKETS }, (_, i) => ({
      start: left + i * bucketMs,
      count: 0,
    }))
    for (const t of times) {
      let idx = Math.floor((t - left) / bucketMs)
      if (idx < 0) idx = 0
      if (idx >= BUCKETS) idx = BUCKETS - 1
      bins[idx].count++
    }

    const max = bins.reduce((m, b) => Math.max(m, b.count), 0)
    return { bins, max, left, right, span, bucketMs, total: times.length }
  }, [rows, now])

  if (!data) return null
  const { bins, max, left, right, span, bucketMs, total } = data

  const fmt = pickFormatter(span)
  const rightIsNow = right <= now + 2 * MIN
  const bw = 100 / BUCKETS

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
        <span>Strike history</span>
        <span className="text-white/30">each bar ≈ {humanDuration(bucketMs)}</span>
      </div>

      <div className="rounded-xl bg-white/4 p-3">
        <div className="flex gap-2">
          {/* y-axis */}
          <div className="flex w-8 shrink-0 flex-col justify-between py-0.5 text-right text-[9px] tabular-nums text-white/30">
            <span>{max}</span>
            <span>0</span>
          </div>

          {/* bars */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-24 w-full text-bolt"
            aria-label={`Strike count over time for the latest ${total} strikes`}
          >
            {/* baseline */}
            <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeWidth="0.4" opacity="0.18" />
            {bins.map((b, i) => {
              const ratio = max ? b.count / max : 0
              const h = b.count === 0 ? 0 : Math.max(2.5, ratio * 96)
              return (
                <rect
                  key={i}
                  x={i * bw + 0.35}
                  y={100 - h}
                  width={Math.max(0.6, bw - 0.7)}
                  height={h}
                  fill="currentColor"
                  opacity={0.3 + 0.7 * ratio}
                />
              )
            })}
          </svg>
        </div>

        {/* x-axis */}
        <div className="mt-1.5 flex gap-2 text-[9px] text-white/35">
          <span className="w-8 shrink-0" aria-hidden />
          <div className="flex flex-1 justify-between tabular-nums">
            <span>{fmt(left)}</span>
            <span>{fmt((left + right) / 2)}</span>
            <span>{rightIsNow ? 'now' : fmt(right)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}