'use client'
import { useEffect, useState } from 'react'
import { getStrikeStats, type StrikeStats } from '@/lib/api'

const POLL_MS = 5000

export function useStrikeStats(): StrikeStats | null {
  const [stats, setStats] = useState<StrikeStats | null>(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const s = await getStrikeStats()
        if (alive) setStats(s)
      } catch {
        /* backend offline — keep last good value */
      }
    }
    load() // immediate fetch so the numbers are correct on refresh, not ramping from 0
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return stats
}