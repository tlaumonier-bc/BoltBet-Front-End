import { create } from 'zustand'
import type { GridCell, LightningStrike, Bet } from '@/types'

const MAX_STRIKES = 200

interface Notification {
  id: string
  message: string
  type: 'win' | 'loss' | 'info'
}

interface GameStore {
  cells: Record<string, GridCell>
  strikes: LightningStrike[]
  activeBets: Bet[]
  userBalance: number
  selectedCellId: string | null
  notifications: Notification[]

  setCells: (cells: GridCell[]) => void    // replace all (initial seed)
  updateCells: (cells: GridCell[]) => void  // merge multiplier updates
  addStrike: (strike: LightningStrike) => void
  placeBet: (bet: Bet) => void
  resolveBet: (betId: string, won: boolean, payout: number) => void
  selectCell: (cellId: string | null) => void
  pushNotification: (n: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
}

export const useGameStore = create<GameStore>((set) => ({
  cells: {},
  strikes: [],
  activeBets: [],
  userBalance: 1000,
  selectedCellId: null,
  notifications: [],

  setCells: (cells) =>
    set(() => ({
      cells: Object.fromEntries(cells.map((c) => [c.id, c])),
    })),

  updateCells: (cells) =>
    set((state) => {
      const next = { ...state.cells }
      for (const c of cells) next[c.id] = { ...next[c.id], ...c }
      return { cells: next }
    }),

  addStrike: (strike) =>
    set((state) => {
      const strikes = [strike, ...state.strikes]
      if (strikes.length > MAX_STRIKES) strikes.length = MAX_STRIKES // ring buffer
      return { strikes }
    }),

  placeBet: (bet) =>
    set((state) => ({
      activeBets: [bet, ...state.activeBets],
      userBalance: state.userBalance - bet.amount,
    })),

  resolveBet: (betId, won, payout) =>
    set((state) => {
      const bet = state.activeBets.find((b) => b.id === betId)
      const activeBets = state.activeBets.map((b) =>
        b.id === betId
          ? { ...b, status: (won ? 'won' : 'lost') as Bet['status'], payout, resolved: true }
          : b
      )
      const notif: Notification = {
        id: crypto.randomUUID(),
        type: won ? 'win' : 'loss',
        message: won
          ? `⚡ You won ${payout} credits!`
          : `No strike in time — bet of ${bet?.amount ?? 0} lost.`,
      }
      return {
        activeBets,
        userBalance: state.userBalance + (won ? payout : 0),
        notifications: [...state.notifications, notif],
      }
    }),

  selectCell: (cellId) => set({ selectedCellId: cellId }),

  pushNotification: (n) =>
    set((state) => ({
      notifications: [...state.notifications, { ...n, id: crypto.randomUUID() }],
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))