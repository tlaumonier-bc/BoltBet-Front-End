'use client'
// components/game/GamePanel.tsx — round timer / intermission countdown + your
// points + the current 5s lock. The lock is cleared when it expires so the
// globe highlight disappears.

import { useEffect, useState } from 'react'
import { usePlayStore } from '@/store/playStore'
import { zoneCenter } from '@/lib/zones'
import { useEnsureIdentity, useGameStateSync } from '@/lib/useGame'

function fmt(lat: number, lon: number) {
  const la = `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'E' : 'W'}`
  return `${la} ${lo}`
}

export default function GamePanel() {
  useEnsureIdentity()
  useGameStateSync()

  const username = usePlayStore((s) => s.username)
  const roundNumber = usePlayStore((s) => s.roundNumber)
  const endsAtMs = usePlayStore((s) => s.endsAtMs)
  const durationSeconds = usePlayStore((s) => s.durationSeconds)
  const offset = usePlayStore((s) => s.serverOffsetMs)
  const nextRoundAtMs = usePlayStore((s) => s.nextRoundAtMs)
  const lockZoneId = usePlayStore((s) => s.lockZoneId)
  const lockExpiresAtMs = usePlayStore((s) => s.lockExpiresAtMs)
  const clearLock = usePlayStore((s) => s.clearLock)
  const board = usePlayStore((s) => s.board)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])

  // Clear the lock exactly when it expires, so the globe highlight disappears.
  useEffect(() => {
    if (lockExpiresAtMs == null) return
    const ms = lockExpiresAtMs - (Date.now() + offset)
    if (ms <= 0) {
      clearLock()
      return
    }
    const t = setTimeout(() => clearLock(), ms)
    return () => clearTimeout(t)
  }, [lockExpiresAtMs, offset, clearLock])

  const serverNow = now + offset
  const roundActive = roundNumber != null && endsAtMs != null
  const inIntermission = !roundActive && nextRoundAtMs != null && serverNow < nextRoundAtMs

  const remainingMs = endsAtMs ? Math.max(0, endsAtMs - serverNow) : 0
  const remainingS = Math.ceil(remainingMs / 1000)
  const pct = durationSeconds ? Math.max(0, Math.min(1, remainingMs / (durationSeconds * 1000))) : 0
  const nextInS = nextRoundAtMs ? Math.max(0, Math.ceil((nextRoundAtMs - serverNow) / 1000)) : 0

  const lockMsLeft = lockExpiresAtMs ? Math.max(0, lockExpiresAtMs - serverNow) : 0
  const locked = lockMsLeft > 0
  const lockS = Math.ceil(lockMsLeft / 1000)

  const myPoints = board.find((r) => r.username === username)?.points ?? 0
  const center = lockZoneId ? zoneCenter(lockZoneId) : null

  const header = roundActive
    ? `Round ${roundNumber}`
    : inIntermission
    ? 'Intermission'
    : 'Waiting for round…'

  return (
    <div className="glass pointer-events-auto w-full rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
          {header}
        </span>
        <span className="text-[11px] text-white/45">{username}</span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          {roundActive ? (
            <div className="font-display text-4xl font-extrabold text-bolt tabular-nums">
              {remainingS}
              <span className="ml-1 text-base font-medium text-white/40">s left</span>
            </div>
          ) : inIntermission ? (
            <div className="font-display text-4xl font-extrabold text-electric tabular-nums">
              {nextInS}
              <span className="ml-1 text-base font-medium text-white/40">s to next</span>
            </div>
          ) : (
            <div className="font-display text-3xl font-bold text-white/40">—</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-bold text-white tabular-nums">{myPoints}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">your points</div>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-bolt transition-[width] duration-200 ease-linear"
          style={{ width: `${roundActive ? pct * 100 : 0}%` }}
        />
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-sm">
        {inIntermission ? (
          <span className="text-white/55">Next round starting soon…</span>
        ) : locked && center ? (
          <div className="flex items-center justify-between">
            <span className="text-white/80">
              Locked on <span className="font-semibold text-electric">{fmt(center.lat, center.lon)}</span>
            </span>
            <span className="font-mono text-bolt">{lockS}s</span>
          </div>
        ) : roundActive ? (
          <span className="text-white/55">Click a zone on the globe to lock it for 5s.</span>
        ) : (
          <span className="text-white/55">Waiting for the next round to start.</span>
        )}
      </div>
    </div>
  )
}
