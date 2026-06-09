'use client'
import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { cellColor, cellCenter, regionName } from '@/lib/grid'
import type { Bet } from '@/types'

const DURATIONS = [5, 15, 30, 60]
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function BetModal() {
  const selectedCellId = useGameStore((s) => s.selectedCellId)
  const cells = useGameStore((s) => s.cells)
  const activeBets = useGameStore((s) => s.activeBets)
  const balance = useGameStore((s) => s.userBalance)
  const selectCell = useGameStore((s) => s.selectCell)
  const placeBet = useGameStore((s) => s.placeBet)

  const cell = selectedCellId ? cells[selectedCellId] : null
  const [duration, setDuration] = useState(15)
  const [amount, setAmount] = useState(100)
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') selectCell(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectCell])

  const existing = activeBets.find(
    (b) => b.cellId === selectedCellId && b.status === 'pending'
  )

  const sparkline = useMemo(() => {
    const base = cell?.strikeCount24h ?? 0
    const seed = (cell?.id ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return Array.from({ length: 24 }, (_, h) => {
      const r = Math.abs(Math.sin(seed + h))
      return Math.round((base / 24) * (0.4 + r))
    })
  }, [cell])

  if (!cell) return null

  const { color } = cellColor(cell.multiplier)
  const center = cellCenter(cell.lonMin, cell.latMin)
  const region = regionName(center.lat, center.lon)
  const payout = Math.round(amount * cell.multiplier)
  const maxBar = Math.max(1, ...sparkline)
  const remaining = existing ? Math.max(0, existing.expiresAt - now) : 0

  async function confirm() {
    if (!cell || amount <= 0 || amount > balance) return
    setSubmitting(true)
    const bet: Bet = {
      id: crypto.randomUUID(),
      cellId: cell.id,
      multiplier: cell.multiplier,
      amount,
      durationMinutes: duration,
      placedAt: Date.now(),
      expiresAt: Date.now() + duration * 60_000,
      status: 'pending',
      payout: 0,
    }
    try {
      const res = await fetch(`${API}/api/bets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cell_id: cell.id,
          multiplier_at_bet: cell.multiplier,
          amount,
          duration_minutes: duration,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.id) bet.id = String(data.id)
      }
    } catch {
      /* backend offline — keep optimistic bet for MVP */
    }
    placeBet(bet)
    setSubmitting(false)
    selectCell(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => selectCell(null)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{region}</h2>
            <p className="text-xs text-white/50">
              Center {center.lat}°, {center.lon}° · cell {cell.id}
            </p>
          </div>
          <button
            onClick={() => selectCell(null)}
            className="text-white/50 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <span className="text-5xl font-black" style={{ color }}>
            {cell.multiplier.toFixed(1)}x
          </span>
          <span className="pb-2 text-sm text-white/50">current multiplier</span>
        </div>

        <p className="mt-3 text-sm text-white/70">
          If a lightning strike hits this zone in the next {duration} minutes, you win{' '}
          <span className="font-semibold text-yellow-300">{payout} credits</span>.
        </p>

        {/* 24h activity sparkline */}
        <div className="mt-4">
          <p className="mb-1 text-xs text-white/50">Strike activity (last 24h)</p>
          <svg viewBox="0 0 240 40" className="h-10 w-full">
            {sparkline.map((v, i) => (
              <rect
                key={i}
                x={i * 10}
                y={40 - (v / maxBar) * 38}
                width={8}
                height={(v / maxBar) * 38}
                rx={1}
                fill={color}
                opacity={0.85}
              />
            ))}
          </svg>
        </div>

        {/* Duration */}
        <div className="mt-4">
          <p className="mb-2 text-xs text-white/50">Bet duration</p>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-lg px-2 py-2 text-sm transition ${
                  duration === d
                    ? 'bg-yellow-400 font-semibold text-black'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {d >= 60 ? '1 hr' : `${d} min`}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/50">
            <span>Amount (credits)</span>
            <span>Balance: {balance}</span>
          </div>
          <input
            type="number"
            min={1}
            max={balance}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-yellow-400"
          />
        </div>

        {existing && (
          <div className="mt-4 rounded-lg bg-white/5 p-3 text-sm">
            <span className="text-white/60">Active bet on this zone — resolves in </span>
            <span className="font-mono text-yellow-300">
              {Math.floor(remaining / 60000)}:
              {String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
            </span>
          </div>
        )}

        <button
          onClick={confirm}
          disabled={submitting || amount <= 0 || amount > balance}
          className="mt-5 w-full rounded-xl bg-yellow-400 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-40"
        >
          {submitting ? 'Placing…' : `Place bet — win ${payout}`}
        </button>
      </div>
    </div>
  )
}