'use client'
// lib/socket.ts — single WebSocket to the backend. Strikes → globe store.

import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { LightningStrike } from '@/types'

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