export interface LightningStrike {
  id: string
  lat: number
  lon: number
  timestamp: number // epoch ms
  receivedAt: number
  quality: string   // good/medium/bad
  country?: string | null // ISO-3166 alpha-2 from the backend ('XX' if unknown)
}
