'use client'
// lib/socket.ts — single WebSocket to the backend. Strikes → globe store.

import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import { getRecentStrikes } from '@/lib/api'
import type { LightningStrike } from '@/types'

// How much recent history to backfill on load so the HUD counters (last 60s /
// last 10 min) and the sparkline aren't empty until the live feed fills them.
const BACKFILL_MINUTES = 15
const BACKFILL_LIMIT = 20_000

function resolveWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
  if (typeof window !== 'undefined') {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}/ws/lightning/`
  }
  return 'ws://localhost:8000/ws/lightning/'
}

export function useLightningSocket() {
  const addStrike = useGameStore((s) => s.addStrike)
  const ref = useRef<WebSocket | null>(null)
  const seeded = useRef(false)

  // One-time REST backfill so counters/sparkline show real numbers immediately
  // on (re)load instead of restarting from 0. seedStrikes() dedupes, so any
  // overlap with the live feed (or another consumer) is harmless.
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    let alive = true
    ;(async () => {
      try {
        const { strikes } = await getRecentStrikes(BACKFILL_MINUTES, BACKFILL_LIMIT)
        if (!alive || !strikes.length) return
        useGameStore.getState().seedStrikes(
          strikes.map((s) => ({
            id: crypto.randomUUID(),
            lat: s.lat,
            lon: s.lon,
            timestamp: Date.parse(s.timestamp) || Date.parse(s.received_at) || Date.now(),
            receivedAt: Date.parse(s.received_at) || Date.now(),
            quality: s.quality ?? 'good',
            country: s.country ?? null,
          })),
        )
      } catch {
        /* backend offline — the live feed fills the buffer instead */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(resolveWsUrl())
      ref.current = ws

      ws.onmessage = (e) => {
        let msg
        try {
          msg = JSON.parse(e.data)
        } catch {
          return
        }
        if (msg.type === 'strike') {
          const ts =
            typeof msg.timestamp === 'number'
              ? msg.timestamp
              : Date.parse(msg.timestamp) || Date.now()
          const strike: LightningStrike = {
            id: crypto.randomUUID(),
            lat: msg.lat,
            lon: msg.lon,
            timestamp: ts,
            receivedAt: Date.now(),
            quality: msg.quality ?? 'good',
            country: msg.country ?? null,
          }
          addStrike(strike)
        }
      }

      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000)
      }
      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ref.current?.close()
    }
  }, [addStrike])
}