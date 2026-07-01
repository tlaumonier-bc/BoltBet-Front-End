'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LeaderboardContext, Trophy } from '@/lib/api'
import { getLeaderboardContext, getProfile } from '@/lib/api'

function progressPercent(points: number, trophies: Trophy[]): number {
  if (trophies.length === 0) return 0
  const first = trophies[0].points
  if (points <= 0) return 0
  if (points < first) return (points / first) * trophyNodePercent(0, trophies.length)

  for (let i = 1; i < trophies.length; i++) {
    const prev = trophies[i - 1].points
    const next = trophies[i].points
    if (points < next) {
      const segmentStart = trophyNodePercent(i - 1, trophies.length)
      const segmentEnd = trophyNodePercent(i, trophies.length)
      return segmentStart + ((points - prev) / (next - prev)) * (segmentEnd - segmentStart)
    }
  }
  return 100
}

function trophyNodePercent(index: number, total: number): number {
  return ((index + 0.5) / total) * 100
}

export default function LeaderboardProgressClient({ trophies }: { trophies: Trophy[] }) {
  const [context, setContext] = useState<LeaderboardContext | null>(null)
  const [profilePoints, setProfilePoints] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    getProfile()
      .then((profile) => {
        if (alive) setProfilePoints(profile.tokens)
      })
      .catch(() => {
        if (alive) setProfilePoints(null)
      })
    getLeaderboardContext()
      .then((data) => {
        if (alive) setContext(data)
      })
      .catch(() => {
        if (alive) setContext(null)
      })
    return () => {
      alive = false
    }
  }, [])

  const current = context?.rows.find((row) => row.rank === context.currentRank) ?? null
  const points = current?.tokens ?? profilePoints ?? 0
  const pct = useMemo(() => progressPercent(points, trophies), [points, trophies])

  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-electric via-bolt to-orange-300" style={{ width: `${pct}%` }} />
        {trophies.map((trophy, index) => (
          <div
            key={trophy.key}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 bg-bolt shadow-[0_0_14px_rgba(250,204,21,0.35)]"
            style={{ left: `${trophyNodePercent(index, trophies.length)}%` }}
            title={`${trophy.label}: ${trophy.points.toLocaleString()} points`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 text-center text-[10px] text-white/45">
        {trophies.map((trophy) => (
          <div
            key={trophy.key}
            className="min-w-0"
          >
            <div className="font-semibold text-white/65">{trophy.points.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
