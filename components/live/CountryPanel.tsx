'use client'
// components/live/CountryPanel.tsx
// Right-side panel shown when the user clicks a country on the globe. Country
// header (with a live/idle pulse), a "Learn more" CTA into the SEO copy, and a
// compact readout derived from the per-country strikes layer (auto-enabled on
// selection by liveStore.setSelectedCountry; fetched/rendered by
// lib/globe/countryStrikesLayer.ts, which feeds liveStore.countryStrikes).

import { useMemo, useState, useEffect } from 'react'
import { useLiveStore } from '@/store/liveStore'
import { useGameStore } from '@/store/gameStore'
import { primaryPageForLocale } from '@/lib/content/content'
import StrikeHistoryChart from './StrikeHistoryChart'

function flagEmoji(iso2: string | null): string {
  if (!iso2 || !/^[A-Za-z]{2}$/.test(iso2)) return '🏳️'
  const A = 0x1f1e6
  const cc = iso2.toUpperCase()
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65)
}

// Average strikes/min over the loaded window → a human "how busy is it" label.
function intensityFor(perMin: number): { label: string; color: string } {
  if (perMin >= 60) return { label: 'Intense', color: 'text-red-400' }
  if (perMin >= 20) return { label: 'Active', color: 'text-orange-300' }
  if (perMin >= 5) return { label: 'Moderate', color: 'text-bolt' }
  if (perMin >= 1) return { label: 'Light', color: 'text-electric' }
  return { label: 'Calm', color: 'text-white/50' }
}

function ago(sec: number): string {
  if (sec < 5) return 'Now'
  if (sec < 90) return `${sec}s ago`
  const m = Math.round(sec / 60)
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

function span(min: number): string {
  if (min >= 1440) return `${Math.round(min / 1440)}d`
  if (min >= 60) return `${Math.round(min / 60)}h`
  return `${min}m`
}

export default function CountryPanel() {
  const country = useLiveStore((s) => s.selectedCountry)
  const setSelected = useLiveStore((s) => s.setSelectedCountry)
  const setSeoContentOpen = useLiveStore((s) => s.setSeoContentOpen)
  const rows = useLiveStore((s) => s.countryStrikes)
  const strikeMeta = useLiveStore((s) => s.countryStrikeMeta)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Freshest strike for this country from the LIVE feed (not the 30s poll),
  // so "last strike" matches the bolts the user sees flashing on the globe.
  // Reading getState() inside the now-driven memo re-evaluates each second
  // tick without subscribing the panel to every incoming strike.
  const liveLastAgeSec = useMemo(() => {
    const iso = country?.iso2
    if (!iso) return null
    const target = iso.toUpperCase()
    const strikes = useGameStore.getState().strikes // newest-first
    for (const s of strikes) {
      if (s.country && s.country.toUpperCase() === target) {
        return Math.max(0, Math.round((now - s.receivedAt) / 1000))
      }
    }
    return null
  }, [country, now])

  const stats = useMemo(() => {
    if (!rows.length) return null
    const t = (s: { received_at: string }) => Date.parse(s.received_at)
    const newest = t(rows[0]) // endpoint returns newest-first
    const oldest = t(rows[rows.length - 1])
    let lastHour = 0
    for (const r of rows) {
      if (now - t(r) <= 3_600_000) lastHour++
    }
    const spanMin = Math.max(0, Math.round((newest - oldest) / 60000))
    const perMin = spanMin > 0 ? Math.round(rows.length / spanMin) : rows.length
    const polledAgeSec = Math.max(0, Math.round((now - newest) / 1000))
    return {
      total: rows.length,
      // prefer the live feed; fall back to the polled snapshot
      lastAgeSec:
        liveLastAgeSec != null ? Math.min(liveLastAgeSec, polledAgeSec) : polledAgeSec,
      spanMin,
      perMin,
      lastHour,
    }
  }, [rows, now, liveLastAgeSec])

  if (!country) return null

  const hasData = !!country.iso2
  const learnMore = country.iso2 ? primaryPageForLocale(country.iso2.toLowerCase()) : undefined
  const live = stats != null && stats.lastAgeSec < 120
  const tone = stats ? intensityFor(stats.perMin) : null
  const lastHourLabel = strikeMeta?.cappedLastHour
    ? `> ${strikeMeta.limit.toLocaleString()}`
    : (strikeMeta?.lastHour ?? stats?.lastHour ?? 0).toLocaleString()

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 w-full overflow-y-auto rounded-2xl p-4">
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
            {flagEmoji(country.iso2)}
          </span>
          <div>
            <div className="font-display text-base font-bold leading-tight">{country.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45">
              {hasData ? (
                <>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      live ? 'live-dot bg-emerald-400' : 'bg-white/30'
                    }`}
                  />
                  <span className={live ? 'text-emerald-400' : 'text-white/45'}>
                    {live ? 'Live' : 'Idle'}
                  </span>
                  <span className="text-white/25">·</span>
                  <span>{country.iso2}</span>
                </>
              ) : (
                <span>No strike data</span>
              )}
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

      {/* learn more → slides up to the localized SEO copy */}
      {learnMore && (
        <button
          type="button"
          onClick={() => setSeoContentOpen(true)}
          className="btn-glow mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold md:mt-4 md:px-4 md:py-3 md:text-sm"
        >
          Learn more about {country.name}
          <span aria-hidden>↓</span>
        </button>
      )}

      {!hasData ? (
        <p className="mt-4 text-xs leading-relaxed text-white/45">
          Strike data isn’t available for this territory — it has no ISO country code.
        </p>
      ) : !stats ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/45">
          <span className="globe-loading-spinner" />
          Loading recent strikes…
        </div>
      ) : (
        <>
          {/* hero: last-hour count + intensity */}
          <div className="mt-4 rounded-xl border border-white/10 bg-linear-to-br from-white/8 to-transparent px-4 py-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-display text-4xl font-extrabold tabular-nums leading-none text-bolt">
                  {lastHourLabel}
                </div>
                <div className="mt-1.5 text-[10px] uppercase tracking-wider text-white/40">
                  strikes · last hour
                </div>
              </div>
              {tone && (
                <span
                  className={`rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone.color}`}
                >
                  {tone.label}
                </span>
              )}
            </div>
          </div>

          {/* supporting stats */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat value={`~${stats.perMin}`} unit="/min" label="recent rate" />
            <Stat value={ago(stats.lastAgeSec)} label="last strike" />
          </div>

          {/* strike history chart (replaces signal quality) */}
          <StrikeHistoryChart rows={rows} now={now} />

          <p className="mt-3 text-[10px] leading-relaxed text-white/30">
            Latest {stats.total.toLocaleString()} strikes · {span(stats.spanMin)} window
          </p>
        </>
      )}
    </div>
  )
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/4 px-3 py-2.5">
      <div className="font-display text-xl font-bold tabular-nums leading-none text-white/90">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-white/40">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  )
}