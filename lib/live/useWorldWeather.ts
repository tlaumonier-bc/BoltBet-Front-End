'use client'
// lib/live/useWorldWeather.ts — current conditions for a few world regions,
// for the right panel's "World weather" snapshot.

import { useEffect, useState } from 'react'
import { fetchOwmNow, weatherEmoji } from './owm'

const SPOTS = [
  { id: 'europe', label: 'Europe', lat: 50, lon: 10 },
  { id: 'americas', label: 'Americas', lat: 8, lon: -75 },
  { id: 'asia', label: 'Asia', lat: 18, lon: 100 },
  { id: 'oceania', label: 'Oceania', lat: -20, lon: 138 },
] as const

const POLL_MS = 5 * 60_000

export interface WorldWeatherRow {
  id: string
  label: string
  emoji: string
  tempC: number
  condition: string
  windKph: number
}

export function useWorldWeather(): WorldWeatherRow[] {
  const [rows, setRows] = useState<WorldWeatherRow[]>([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const out = await Promise.all(
        SPOTS.map(async (s) => {
          const w = await fetchOwmNow(s.lat, s.lon).catch(() => null)
          return w
            ? {
                id: s.id,
                label: s.label,
                emoji: weatherEmoji(w.main, w.icon),
                tempC: w.tempC,
                condition: w.main,
                windKph: w.windKph,
              }
            : null
        }),
      )
      if (alive) setRows(out.filter(Boolean) as WorldWeatherRow[])
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [])

  return rows
}