'use client'
import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { regionName, cellCenter, parseCellId } from '@/lib/grid'

export default function GameHUD() {
  const balance = useGameStore((s) => s.userBalance)
  const activeBets = useGameStore((s) => s.activeBets)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const pending = activeBets.filter((b) => b.status === 'pending')

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 w-72 max-w-[90vw]">
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/70 p-4 text-white backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-white/50">Balance</span>
          <span className="text-xl font-black text-yellow-300">{balance}</span>
        </div>
        <div className="mt-3 text-xs uppercase tracking-wide text-white/50">
          Active bets ({pending.length})
        </div>
        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {pending.length === 0 && (
            <p className="text-sm text-white/40">Click a zone to place a bet.</p>
          )}
          {pending.map((b) => {
            const parsed = parseCellId(b.cellId)
            const region = parsed
              ? regionName(...Object.values(cellCenter(parsed.lonMin, parsed.latMin)) as [number, number])
              : b.cellId
            const remaining = Math.max(0, b.expiresAt - now)
            return (
              <div key={b.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="truncate">{region}</span>
                  <span className="text-yellow-300">{b.multiplier.toFixed(1)}x</span>
                </div>
                <div className="flex justify-between text-xs text-white/50">
                  <span>{b.amount} → {Math.round(b.amount * b.multiplier)}</span>
                  <span className="font-mono">
                    {Math.floor(remaining / 60000)}:
                    {String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}