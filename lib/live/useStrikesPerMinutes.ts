'use client'
// lib/live/useStrikesPerMinute.ts
// Global strikes-per-minute series for the "Activity · last 15 min" sparkline,
// pulled from /api/strikes/per-minute/ (reads the minute rollups, never raw
// strikes). Oldest → newest, zero-filled.

import { useEffect, useState } from 'react'
import { getStrikesPerMinute, type MinuteBucket } from '@/lib/api'

const POLL_MS = 5000

export function useStrikesPerMinute(minutes = 15): MinuteBucket[] {
  const [series, setSeries] = useState<MinuteBucket[]>([])
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { series } = await getStrikesPerMinute(minutes)
        if (alive) setSeries(series)
      } catch {
        /* backend offline — keep last good value */
      }
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [minutes])
  return series
}