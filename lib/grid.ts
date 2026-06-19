// lib/grid.ts — region naming for HUD labels (no external geocoder).

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