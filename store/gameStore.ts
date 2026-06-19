import { create } from 'zustand'
import type { LightningStrike } from '@/types'

const STRIKE_WINDOW_MS = 20 * 60_000
const MAX_STRIKES = 80_000

interface Notification {
  id: string
  message: string
  type: 'win' | 'loss' | 'info'
}

interface GameStore {
  strikes: LightningStrike[]
  notifications: Notification[]
  /** Strikes received since page load — NOT capped at MAX_STRIKES. */
  totalStrikes: number

  addStrike: (strike: LightningStrike) => void
  seedStrikes: (strikes: LightningStrike[]) => void
  pushNotification: (n: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
}

const keyOf = (s: LightningStrike) => `${s.lat}|${s.lon}|${s.timestamp}`

export const useGameStore = create<GameStore>((set) => ({
  strikes: [],
  notifications: [],
  totalStrikes: 0,

  addStrike: (strike) =>
    set((state) => {
      const strikes = [strike, ...state.strikes]
      const cutoff = strike.receivedAt - STRIKE_WINDOW_MS
      let len = strikes.length
      while (len > 0 && strikes[len - 1].receivedAt < cutoff) len--
      if (len < strikes.length) strikes.length = len
      if (strikes.length > MAX_STRIKES) strikes.length = MAX_STRIKES
      return { strikes, totalStrikes: state.totalStrikes + 1 }
    }),

  // Merge a batch of historical strikes (from the REST backfill) into the
  // buffer. Dedupes by lat|lon|timestamp; if a strike we already have has no
  // country but the incoming one does, upgrade it so country-scoped counting
  // works. Does NOT bump totalStrikes (these aren't new this session).
  seedStrikes: (incoming) =>
    set((state) => {
      if (!incoming.length) return {}
      const byKey = new Map<string, LightningStrike>()
      for (const s of state.strikes) byKey.set(keyOf(s), s)
      for (const s of incoming) {
        const k = keyOf(s)
        const existing = byKey.get(k)
        if (!existing) byKey.set(k, s)
        else if (!existing.country && s.country) byKey.set(k, { ...existing, country: s.country })
      }
      const merged = [...byKey.values()].sort((a, b) => b.receivedAt - a.receivedAt)
      const cutoff = Date.now() - STRIKE_WINDOW_MS
      let len = merged.length
      while (len > 0 && merged[len - 1].receivedAt < cutoff) len--
      merged.length = Math.min(len, MAX_STRIKES)
      return { strikes: merged }
    }),

  pushNotification: (n) =>
    set((state) => ({
      notifications: [...state.notifications, { ...n, id: crypto.randomUUID() }],
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))