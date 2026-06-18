'use client'
// components/live/CountryPanel.tsx
// Right-side panel shown when the user clicks a country on the globe. Renders
// country info + the "Latest 1000 strikes in <country>" layer switch (yes/no).
// Selecting a country (in countryBorders) turns the switch on by default; the
// strikes themselves are fetched/rendered by lib/globe/countryStrikesLayer.ts,
// which also feeds liveStore.countryStrikes that this panel reads for stats.

import { useMemo, useState, useEffect } from 'react'
import { useLiveStore } from '@/store/liveStore'

function flagEmoji(iso2: string | null): string {
  if (!iso2 || !/^[A-Za-z]{2}$/.test(iso2)) return '🏳️'
  const A = 0x1f1e6
  const cc = iso2.toUpperCase()
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65)
}

export default function CountryPanel() {
  const country = useLiveStore((s) => s.selectedCountry)
  const on = useLiveStore((s) => s.countryStrikesOn)
  const setOn = useLiveStore((s) => s.setCountryStrikesOn)
  const setSelected = useLiveStore((s) => s.setSelectedCountry)
  const rows = useLiveStore((s) => s.countryStrikes)

const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const stats = useMemo(() => {
    if (!rows.length) return null
    const t = (s: { received_at: string }) => Date.parse(s.received_at)
    const newest = t(rows[0]) // endpoint returns newest-first
    const oldest = t(rows[rows.length - 1])
    let lastHour = 0
    const q = { good: 0, medium: 0, bad: 0 }
    for (const r of rows) {
      if (now - t(r) <= 3_600_000) lastHour++
      if (r.quality === 'good') q.good++
      else if (r.quality === 'medium') q.medium++
      else q.bad++
    }
    return {
      count: rows.length,
      lastAgeSec: Math.max(0, Math.round((now - newest) / 1000)),
      spanMin: Math.max(0, Math.round((newest - oldest) / 60000)),
      lastHour,
      q,
    }
  }, [rows, now])

  if (!country) return null

  const hasData = !!country.iso2

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 w-full overflow-y-auto rounded-2xl p-4">
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{flagEmoji(country.iso2)}</span>
          <div>
            <div className="font-display text-base font-bold leading-tight">{country.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              {country.iso2 ?? '—'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label="Close country panel"
          className="rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* layer switch */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
        <div className="pr-3">
          <div className="text-sm font-medium text-white/90">
            Latest 1000 strikes in {country.name}
          </div>
          <div className="text-[11px] text-white/45">
            Shows the most recent strikes regardless of age.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={!hasData}
          onClick={() => setOn(!on)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-30 ${
            on ? 'bg-electric' : 'bg-white/15'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              on ? 'left-5.5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {!hasData && (
        <p className="mt-3 text-xs text-white/45">
          Strike data isn’t available for this territory (no ISO country code).
        </p>
      )}

      {/* stats */}
      {hasData && (
        <div className="mt-4 space-y-2 text-sm">
          {!on ? (
            <p className="text-white/45">Turn the layer on to load strikes.</p>
          ) : !stats ? (
            <p className="text-white/45">Loading strikes…</p>
          ) : (
            <>
              <Row label="Loaded strikes" value={stats.count.toLocaleString()} />
              <Row label="In the last hour" value={String(stats.lastHour)} />
              <Row
                label="Most recent"
                value={stats.lastAgeSec < 90 ? `${stats.lastAgeSec}s ago` : `${Math.round(stats.lastAgeSec / 60)}m ago`}
              />
              <Row
                label="Window span"
                value={stats.spanMin >= 1440 ? `${Math.round(stats.spanMin / 1440)}d` : stats.spanMin >= 60 ? `${Math.round(stats.spanMin / 60)}h` : `${stats.spanMin}m`}
              />
              <div className="pt-1">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-white/40">Signal quality</div>
                <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                  <span className="bg-green-500" style={{ width: `${pct(stats.q.good, stats.count)}%` }} />
                  <span className="bg-amber-400" style={{ width: `${pct(stats.q.medium, stats.count)}%` }} />
                  <span className="bg-red-500" style={{ width: `${pct(stats.q.bad, stats.count)}%` }} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/55">{label}</span>
      <span className="font-display font-bold tabular-nums text-white/90">{value}</span>
    </div>
  )
}

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0
}