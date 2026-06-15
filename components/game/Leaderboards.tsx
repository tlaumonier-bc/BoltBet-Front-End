'use client'
// components/game/Leaderboards.tsx — three boards in one panel.
//  * "This game"    -> live, from the play store (socket-driven).
//  * "Most wins"    -> polled from /api/game/leaderboard/wins/.
//  * "Best average" -> polled from /api/game/leaderboard/average/.

import { useEffect, useState } from 'react'
import { getLeaderboard, type LeaderboardKind, type LeaderboardRow } from '@/lib/api'
import { usePlayStore } from '@/store/playStore'

const TABS: { id: LeaderboardKind; label: string }[] = [
  { id: 'current', label: 'This game' },
  { id: 'wins', label: 'Most wins' },
  { id: 'average', label: 'Best average' },
]

const MEDAL = ['🥇', '🥈', '🥉']

function value(kind: LeaderboardKind, row: LeaderboardRow): string {
  if (kind === 'wins') return `${row.games_won ?? 0} wins`
  if (kind === 'average') return `${(row.avg_strikes ?? 0).toFixed(1)} avg`
  return `${row.points ?? 0}`
}

export default function Leaderboards() {
  const [tab, setTab] = useState<LeaderboardKind>('current')
  const username = usePlayStore((s) => s.username)
  const liveBoard = usePlayStore((s) => s.board)
  const [polled, setPolled] = useState<LeaderboardRow[]>([])

  useEffect(() => {
    if (tab === 'current') return
    let alive = true
    const load = async () => {
      try {
        const rows = await getLeaderboard(tab)
        if (alive) setPolled(rows)
      } catch {
        /* keep last */
      }
    }
    load()
    const t = setInterval(load, 10000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [tab])

  const rows = tab === 'current' ? liveBoard : polled

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 w-full overflow-y-auto rounded-2xl p-4">
      <div className="flex gap-1 rounded-full bg-white/5 p-1 text-xs font-semibold">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-3 py-1.5 transition ${
              tab === t.id ? 'bg-electric text-storm' : 'text-white/60 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-1">
        {rows.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-white/40">No scores yet.</p>
        )}
        {rows.map((r, i) => {
          const me = r.username === username
          return (
            <div
              key={`${r.username}-${i}`}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                me ? 'bg-bolt/10 ring-1 ring-bolt/30' : 'bg-white/4'
              }`}
            >
              <span className="w-6 text-center font-display text-white/45">
                {MEDAL[i] ?? i + 1}
              </span>
              <span className={`flex-1 truncate font-medium ${me ? 'text-bolt' : 'text-white/90'}`}>
                {r.username}
                {r.country && r.country !== 'XX' && (
                  <span className="ml-1.5 text-[10px] text-white/40">{r.country}</span>
                )}
              </span>
              <span className="font-display font-bold tabular-nums text-white/90">
                {value(tab, r)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
