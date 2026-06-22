'use client'
// components/how-it-works/LiveStrikeRanking.tsx
// Live "where is it striking now" ranking, built from the same live strike feed
// the globe uses (useLightningSocket -> gameStore). Ranks by region (derived
// from coordinates, so it always populates) and auto-upgrades to countries +
// flags when the feed tags them. Seeds from getRecentStrikes for instant fill.

import { useEffect, useRef, useState } from 'react'
import { useLightningSocket } from '@/lib/socket'
import { useGameStore } from '@/store/gameStore'
import { getRecentStrikes } from '@/lib/api'
import { regionName } from '@/lib/grid'
import { flagEmoji, countryName } from '@/lib/live/owm'
import type { LightningStrike } from '@/types'

const SEED_MIN = 20
const SEED_LIMIT = 8000
const TICK_MS = 2000
const OFFLINE_MS = 9000
const TOP_N = 12
const MEDAL = ['🥇', '🥈', '🥉']

interface Row {
  id: string
  label: string
  icon: string
  count: number
}

interface Snapshot {
  rows: Row[]
  total: number
  mode: 'country' | 'region'
}

function aggregate(strikes: LightningStrike[]): Snapshot {
  const countryCounts = new Map<string, number>()
  const regionCounts = new Map<string, number>()
  let countryTagged = 0

  for (const s of strikes) {
    const cc = s.country ? s.country.toUpperCase() : ''
    if (/^[A-Z]{2}$/.test(cc) && cc !== 'XX') {
      countryCounts.set(cc, (countryCounts.get(cc) ?? 0) + 1)
      countryTagged++
    }
    const r = regionName(s.lat, s.lon)
    regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
  }

  const total = strikes.length
  // Use countries only if the feed tags most strikes; otherwise fall back to
  // coordinate-derived regions so the board is never empty.
  const useCountries = total > 0 && countryTagged / total >= 0.6 && countryCounts.size >= 3

  const rows: Row[] = useCountries
    ? [...countryCounts.entries()]
        .map(([iso2, count]) => ({ id: iso2, label: countryName(iso2), icon: flagEmoji(iso2), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_N)
    : [...regionCounts.entries()]
        .map(([name, count]) => ({ id: name, label: name, icon: '⚡', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_N)

  return { rows, total, mode: useCountries ? 'country' : 'region' }
}

export default function LiveStrikeRanking() {
  useLightningSocket() // open the live feed for this page

  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const seeded = useRef(false)

  // One-time backfill so the board fills instantly (region only needs lat/lon,
  // which /api/strikes/recent/ always returns).
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    let alive = true
    ;(async () => {
      try {
        const { strikes } = await getRecentStrikes(SEED_MIN, SEED_LIMIT)
        if (!alive || !strikes.length) return
        useGameStore.getState().seedStrikes(
          strikes.map((s) => ({
            id: crypto.randomUUID(),
            lat: s.lat,
            lon: s.lon,
            timestamp: Date.parse(s.timestamp) || Date.parse(s.received_at) || Date.now(),
            receivedAt: Date.parse(s.received_at) || Date.now(),
            quality: s.quality ?? 'good',
            country: s.country ?? null,
          })),
        )
      } catch {
        /* backend offline — live feed fills the board instead */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Recompute from the store every couple of seconds.
  useEffect(() => {
    const compute = () => setSnap(aggregate(useGameStore.getState().strikes))
    compute()
    const t = setInterval(compute, TICK_MS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), OFFLINE_MS)
    return () => clearTimeout(t)
  }, [])

  const ready = snap && snap.total > 0

  if (!ready && timedOut) {
    return (
      <div className="glass mt-6 rounded-2xl p-8 text-center text-white/55">
        The live strike feed is offline right now. The ranking will appear here once it reconnects.
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="glass mt-6 flex items-center gap-3 rounded-2xl p-8 text-sm text-white/55">
        <span className="globe-loading-spinner" />
        Connecting to the live strike feed…
      </div>
    )
  }

  const max = snap.rows[0]?.count ?? 1

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-bolt" />
        <span className="font-semibold text-bolt">{snap.total.toLocaleString()}</span>
        <span>strikes tracked live · most active {snap.mode === 'country' ? 'countries' : 'regions'} right now</span>
      </div>

      <ol className="glass overflow-hidden rounded-2xl">
        {snap.rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-4 border-b border-white/5 px-5 py-3.5 last:border-b-0">
            <span className="font-display w-7 shrink-0 text-center text-lg">
              {MEDAL[i] ?? <span className="text-sm text-white/40">{i + 1}</span>}
            </span>
            <span className="shrink-0 text-xl leading-none" aria-hidden>
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white/90">{r.label}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-bolt/70" style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} />
              </div>
            </div>
            <span className="font-display w-16 shrink-0 text-right text-base font-bold tabular-nums text-bolt">
              {r.count.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-2.5 text-[11px] text-white/30">
        {snap.mode === 'region'
          ? 'Regions are derived from each strike’s coordinates, so the board fills even when the feed does not tag a country.'
          : 'Countries come tagged on the live strike feed; territories without an ISO code are not ranked.'}
      </p>
    </div>
  )
}