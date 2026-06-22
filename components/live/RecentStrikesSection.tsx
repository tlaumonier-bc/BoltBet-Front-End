'use client'
// components/live/RecentStrikesSection.tsx — live list of the latest strikes,
// each with its country (carried by the WS message). Snapshots the store once
// per second to avoid re-rendering on every incoming strike.
import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { flagEmoji, countryName } from '@/lib/live/owm'
import { regionName } from '@/lib/grid'
import { Section } from './hudShared'
import type { LightningStrike } from '@/types'

const MAX = 10

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

export default function RecentStrikesSection() {
  const [recent, setRecent] = useState<LightningStrike[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => {
      setNow(Date.now())
      setRecent(useGameStore.getState().strikes.slice(0, MAX))
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <Section title="Recent strikes">
      {recent.length === 0 ? (
        <p className="text-xs text-white/40">Waiting for strikes…</p>
      ) : (
        <div className="space-y-1">
          {recent.map((s) => {
            const cc = s.country && s.country !== 'XX' ? s.country : null
            const flag = cc ? flagEmoji(cc) : '🌍'
            const label = cc ? countryName(cc) : regionName(s.lat, s.lon)
            return (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="text-sm leading-none" aria-hidden>{flag}</span>
                <span className="flex-1 truncate text-white/85">{label}</span>
                <span className="tabular-nums text-white/40">{ago(now - s.receivedAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}