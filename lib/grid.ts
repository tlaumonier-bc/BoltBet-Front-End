import type { GridCell } from '@/types'

// 18 longitude bands (-180..160) × 9 latitude bands (-90..70) = 162 cells
export const LON_VALUES = Array.from({ length: 18 }, (_, i) => -180 + i * 20)
export const LAT_VALUES = Array.from({ length: 9 }, (_, i) => -90 + i * 20)

export function cellId(lonMin: number, latMin: number) {
  return `lon_${lonMin}_lat_${latMin}`
}

export function allCells(): { id: string; lonMin: number; latMin: number }[] {
  const out: { id: string; lonMin: number; latMin: number }[] = []
  for (const lonMin of LON_VALUES) {
    for (const latMin of LAT_VALUES) {
      out.push({ id: cellId(lonMin, latMin), lonMin, latMin })
    }
  }
  return out
}

export function cellCenter(lonMin: number, latMin: number) {
  return { lat: latMin + 10, lon: lonMin + 10 }
}

export function parseCellId(id: string): { lonMin: number; latMin: number } | null {
  const m = id.match(/^lon_(-?\d+)_lat_(-?\d+)$/)
  if (!m) return null
  return { lonMin: parseInt(m[1], 10), latMin: parseInt(m[2], 10) }
}

// Color scheme keyed to multiplier (matches spec rgba values)
export function cellColor(multiplier: number): { color: string; opacity: number } {
  if (multiplier < 1.5) return { color: '#dc2626', opacity: 0.35 } // active storm
  if (multiplier < 3) return { color: '#f59e0b', opacity: 0.25 }   // moderate
  if (multiplier <= 6) return { color: '#22c55e', opacity: 0.2 }   // calm
  return { color: '#3b82f6', opacity: 0.15 }                       // very calm
}

// Stable pseudo-random seed used for initial/demo data
function seeded(n: number) {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1
}

// Seed cells so the globe is colorful before WebSocket data arrives
export function buildInitialCells(): GridCell[] {
  return allCells().map(({ id, lonMin, latMin }, i) => {
    const r = seeded(i)
    const multiplier = +(1 + r * 8).toFixed(1)
    return {
      id,
      lonMin,
      latMin,
      multiplier,
      strikeCount24h: Math.round(r * 400),
      activeBets: Math.round(seeded(i + 99) * 12),
      isHot: multiplier < 1.5,
    }
  })
}

// Rough region naming for SEO copy + modal labels (no external geocoder for MVP)
export function regionName(lat: number, lon: number): string {
  const boxes = [
    { name: 'Central Africa', latMin: -10, latMax: 15, lonMin: 10, lonMax: 35 },
    { name: 'West Africa', latMin: 0, latMax: 20, lonMin: -18, lonMax: 10 },
    { name: 'Southern Africa', latMin: -35, latMax: -10, lonMin: 12, lonMax: 40 },
    { name: 'Northern Africa', latMin: 15, latMax: 35, lonMin: -10, lonMax: 35 },
    { name: 'Western Europe', latMin: 40, latMax: 60, lonMin: -10, lonMax: 20 },
    { name: 'Eastern Europe', latMin: 45, latMax: 60, lonMin: 20, lonMax: 45 },
    { name: 'South Asia', latMin: 5, latMax: 30, lonMin: 65, lonMax: 90 },
    { name: 'Southeast Asia', latMin: -10, latMax: 20, lonMin: 90, lonMax: 140 },
    { name: 'East Asia', latMin: 20, latMax: 50, lonMin: 100, lonMax: 145 },
    { name: 'Middle East', latMin: 15, latMax: 40, lonMin: 35, lonMax: 65 },
    { name: 'Northern Asia', latMin: 50, latMax: 75, lonMin: 60, lonMax: 180 },
    { name: 'Australia', latMin: -40, latMax: -10, lonMin: 110, lonMax: 155 },
    { name: 'Northern South America', latMin: -10, latMax: 12, lonMin: -80, lonMax: -50 },
    { name: 'Southern South America', latMin: -55, latMax: -10, lonMin: -75, lonMax: -50 },
    { name: 'Central America', latMin: 8, latMax: 22, lonMin: -105, lonMax: -78 },
    { name: 'Southern USA', latMin: 25, latMax: 37, lonMin: -105, lonMax: -75 },
    { name: 'Northern USA & Canada', latMin: 37, latMax: 60, lonMin: -130, lonMax: -65 },
  ]
  for (const b of boxes) {
    if (lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) return b.name
  }
  if (lat > 66) return 'Arctic Region'
  if (lat < -60) return 'Antarctic Region'
  if (lon >= -70 && lon <= 20) return 'Atlantic Ocean'
  if (lon > 20 && lon <= 110) return 'Indian Ocean'
  return 'Pacific Ocean'
}