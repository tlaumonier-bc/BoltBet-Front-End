export interface GridCell {
  id: string
  lonMin: number
  latMin: number
  multiplier: number
  strikeCount24h: number
  activeBets: number
  isHot: boolean
}

export interface LightningStrike {
  id: string
  lat: number
  lon: number
  timestamp: number // epoch ms
  receivedAt: number
  quality: string   // good/medium/bad
  country?: string | null // ISO-3166 alpha-2 from the backend ('XX' if unknown)
}

export interface Bet {
  id: string
  cellId: string
  multiplier: number
  amount: number
  durationMinutes: number
  placedAt: number   // epoch ms
  expiresAt: number  // epoch ms
  status: 'pending' | 'won' | 'lost' | 'cancelled'
  payout: number
}