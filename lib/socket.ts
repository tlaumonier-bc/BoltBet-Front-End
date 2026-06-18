'use client'
// lib/socket.ts — single WebSocket to the backend.
// Strikes -> globe store; game events (round_start / round_end / leaderboard) -> play store.

import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import { usePlayStore } from '@/store/playStore'
import type { LightningStrike } from '@/types'

function resolveWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL // dev/local override
  if (typeof window !== 'undefined') {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}/ws/lightning/`
  }
  return 'ws://localhost:8000/ws/lightning/'
}

export function useLightningSocket() {
  const addStrike = useGameStore((s) => s.addStrike)
  const ref = useRef<WebSocket | null>(null)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>
    const play = usePlayStore.getState

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

        switch (msg.type) {
          case 'strike': {
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
            break
          }
          case 'round_start':
            play().setRound(msg.round, msg.endsAt, msg.durationSeconds)
            play().clearLock()
            break
          case 'round_end':
            play().endRound(msg.round, msg.leaderboard ?? [], msg.nextRoundAt)
            break
          case 'leaderboard':
            play().setBoard(msg.leaderboard ?? [])
            break
          default:
            break
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