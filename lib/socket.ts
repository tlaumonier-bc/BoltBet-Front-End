'use client'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { LightningStrike } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/lightning/'

export function useLightningSocket() {
  const updateCells = useGameStore((s) => s.updateCells)
  const addStrike = useGameStore((s) => s.addStrike)
  const resolveBet = useGameStore((s) => s.resolveBet)
  const ref = useRef<WebSocket | null>(null)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(WS_URL)
      ref.current = ws

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
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
            }
            console.log('STRIKE RECEIVED', strike.lat, strike.lon)
            addStrike(strike)
          } else if (msg.type === 'grid_update') {
            updateCells(msg.cells ?? [])
          } else if (msg.type === 'bet_resolved') {
            resolveBet(msg.betId, !!msg.won, msg.payout ?? 0)
          }
        } catch {
          /* ignore malformed frames */
        }
      }

      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000) // reconnect
      }
      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ref.current?.close()
    }
  }, [updateCells, addStrike, resolveBet])
}