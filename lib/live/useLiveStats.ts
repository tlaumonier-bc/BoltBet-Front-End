'use client'
// lib/live/useLiveStats.ts — REAL metrics derived from the live strike feed.
// Everything here is computed from the same Zustand store the globe renders
// from (fed by lib/socket.ts), so the HUD needs no extra backend endpoint.
// Note: the store keeps the last 200 strikes, so at very high global rates the
// 10/15-min figures are floors, not exact totals (fine for a console readout).

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { regionName } from '@/lib/grid'
import type { LightningStrike } from '@/types'

const SPARK_BUCKETS = 15 // 15 × 1-min bars for the activity sparkline
const MINUTE = 60_000

export interface LiveStats {
  perMinute: number // strikes received in the last 60 s
  last10Min: number // strikes received in the last 10 min
  totalSession: number // every strike since page load (not capped at 200)
  topRegion: string | null // most active region over the last 10 min
  lastStrike: { region: string; ageSec: number } | null
  buckets: number[] // strikes/min, oldest → newest (sparkline)
  avgLatencyMs: number | null // receivedAt − strike timestamp
  qualityPct: { good: number; medium: number; bad: number }
  feedLive: boolean // a strike arrived in the last 30 s
  now: number
}

export function useLiveStats(): LiveStats {
  const strikes = useGameStore((s) => s.strikes)
  const totalSession = useGameStore((s) => s.totalStrikes)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  return useMemo(() => {
    const minuteAgo = now - MINUTE
    const tenMinAgo = now - 10 * MINUTE

    let perMinute = 0
    let last10Min = 0
    const regionCounts = new Map<string, number>()
    const buckets = new Array(SPARK_BUCKETS).fill(0) as number[]
    let latencySum = 0
    let latencyN = 0
    const quality = { good: 0, medium: 0, bad: 0 }

    for (const s of strikes) {
      if (s.receivedAt >= minuteAgo) perMinute++
      if (s.receivedAt >= tenMinAgo) {
        last10Min++
        const r = regionName(s.lat, s.lon)
        regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
      }
      const bucket = SPARK_BUCKETS - 1 - Math.floor((now - s.receivedAt) / MINUTE)
      if (bucket >= 0 && bucket < SPARK_BUCKETS) buckets[bucket]++
      const lag = s.receivedAt - s.timestamp
      if (lag >= 0 && lag <= 120_000) {
        // clamp out bogus clocks / malformed timestamps
        latencySum += lag
        latencyN++
      }
      if (s.quality === 'good') quality.good++
      else if (s.quality === 'medium') quality.medium++
      else quality.bad++
    }

    let topRegion: string | null = null
    let topCount = 0
    for (const [r, c] of regionCounts) {
      if (c > topCount) {
        topRegion = r
        topCount = c
      }
    }

    const latest = strikes[0] // the store prepends newest first
    const lastStrike = latest
      ? {
          region: regionName(latest.lat, latest.lon),
          ageSec: Math.max(0, Math.round((now - latest.receivedAt) / 1000)),
        }
      : null

    const qTotal = quality.good + quality.medium + quality.bad
    const qualityPct = qTotal
      ? {
          good: Math.round((quality.good / qTotal) * 100),
          medium: Math.round((quality.medium / qTotal) * 100),
          bad: Math.round((quality.bad / qTotal) * 100),
        }
      : { good: 0, medium: 0, bad: 0 }

    return {
      perMinute,
      last10Min,
      totalSession,
      topRegion,
      lastStrike,
      buckets,
      avgLatencyMs: latencyN ? Math.round(latencySum / latencyN) : null,
      qualityPct,
      feedLive: !!latest && now - latest.receivedAt < 30_000,
      now,
    }
  }, [strikes, totalSession, now])
}

// ---------- proximity helper (real data, used by the pro card) --------------

const EARTH_R_KM = 6371
const DEG2RAD = Math.PI / 180

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = (lat2 - lat1) * DEG2RAD
  const dLon = (lon2 - lon1) * DEG2RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(a))
}

/** Nearest strike to (lat, lon) within the time window (default 10 min). */
export function nearestStrike(
  strikes: LightningStrike[],
  lat: number,
  lon: number,
  now: number,
  windowMs = 600_000
): { km: number; ageSec: number } | null {
  let best: { km: number; ageSec: number } | null = null
  for (const s of strikes) {
    if (now - s.receivedAt > windowMs) continue
    const km = haversineKm(lat, lon, s.lat, s.lon)
    if (!best || km < best.km) {
      best = { km, ageSec: Math.max(0, Math.round((now - s.receivedAt) / 1000)) }
    }
  }
  return best
}
