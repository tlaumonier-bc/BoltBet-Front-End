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
  pushNotification: (n: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
}

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

  pushNotification: (n) =>
    set((state) => ({
      notifications: [...state.notifications, { ...n, id: crypto.randomUUID() }],
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))