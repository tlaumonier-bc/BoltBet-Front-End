// lib/live/locations.ts
// "Orbit to" shortcuts for the /live console + per-location SAMPLE data,
// shaped like the Xweather endpoints they will later come from:
//   wx core (temp, wind, humidity, pressure, dewpoint, sky) → /conditions
//   capeJkg                                                 → /conditions (cape)
//   cells (movement, hail prob, TVS/MESO flags)             → /stormcells
//   alerts                                                  → /alerts
//   pulse (CG/IC split, peak amperage)                      → /lightning
//
// NOTE: collapsed from 8 point locations to 4 continents to free up panel
// space for the new Layers section. Each continent uses a representative storm
// region for its centre + sample wx, and a higher fly height so the camera
// frames the whole landmass instead of a single city.
//
// TODO(Xweather): replace each `wx` block with a live fetch keyed by lat/lon.
// The HUD (components/live/LiveHUD.tsx) reads everything through this shape,
// so only this file changes when the integration ships.

export interface StormCellSample {
  id: string
  bearing: string // movement direction
  speedKph: number
  hailProb: number // %
  tag: 'TVS' | 'MESO' | null // tornado vortex signature / mesocyclone
}

export interface AlertSample {
  event: string
  severity: 'warning' | 'watch' | 'advisory'
  expires: string // human readable for the sample data
}

export interface LocationWeatherSample {
  tempC: number
  condition: string
  windKph: number
  windDir: string
  humidity: number // %
  pressureMb: number
  dewpointC: number
  cloudCover: number // %
  capeJkg: number // convective available potential energy
  pulse: { cgShare: number; avgPeakKA: number } // cloud-to-ground %, kiloamps
  cells: StormCellSample[]
  alerts: AlertSample[]
}

export interface OrbitLocation {
  id: string
  short: string // button label
  label: string // full name
  lat: number
  lon: number
  /** Camera altitude for the fly-to (m). Continents sit higher than cities. */
  flyHeightM: number
  wx: LocationWeatherSample
}

export const ORBIT_LOCATIONS: OrbitLocation[] = [
  {
    id: 'america',
    short: 'America',
    label: 'The Americas',
    // centred on the Maracaibo / northern-Andes lightning belt
    lat: 8,
    lon: -75,
    flyHeightM: 13_000_000,
    wx: {
      tempC: 31, condition: 'Thunderstorms', windKph: 14, windDir: 'SW',
      humidity: 78, pressureMb: 1009, dewpointC: 26, cloudCover: 85, capeJkg: 2900,
      pulse: { cgShare: 30, avgPeakKA: 33 },
      cells: [
        { id: 'C-4172', bearing: 'NE', speedKph: 22, hailProb: 35, tag: 'MESO' },
        { id: 'C-2210', bearing: 'NNE', speedKph: 30, hailProb: 45, tag: 'TVS' },
      ],
      alerts: [{ event: 'Severe Thunderstorm Warning', severity: 'warning', expires: 'in 42 min' }],
    },
  },
  {
    id: 'europe',
    short: 'Europe',
    label: 'Europe',
    lat: 50,
    lon: 10,
    flyHeightM: 9_500_000,
    wx: {
      tempC: 19, condition: 'Scattered showers', windKph: 22, windDir: 'W',
      humidity: 67, pressureMb: 1016, dewpointC: 12, cloudCover: 75, capeJkg: 700,
      pulse: { cgShare: 19, avgPeakKA: 20 },
      cells: [{ id: 'C-3340', bearing: 'NE', speedKph: 28, hailProb: 18, tag: null }],
      alerts: [{ event: 'Thunderstorm Watch', severity: 'watch', expires: 'in 3 h' }],
    },
  },
  {
    id: 'asia',
    short: 'Asia',
    label: 'Asia',
    // monsoon / maritime-continent belt
    lat: 18,
    lon: 100,
    flyHeightM: 14_000_000,
    wx: {
      tempC: 30, condition: 'Monsoon storms', windKph: 11, windDir: 'NW',
      humidity: 88, pressureMb: 1008, dewpointC: 26, cloudCover: 92, capeJkg: 3200,
      pulse: { cgShare: 24, avgPeakKA: 28 },
      cells: [
        { id: 'C-9051', bearing: 'NW', speedKph: 15, hailProb: 15, tag: 'MESO' },
        { id: 'C-5530', bearing: 'E', speedKph: 16, hailProb: 30, tag: null },
      ],
      alerts: [{ event: 'Heavy Rain Watch', severity: 'watch', expires: 'in 3 h' }],
    },
  },
  {
    id: 'oceania',
    short: 'Oceania',
    label: 'Oceania',
    // Top End "Hector" buildups
    lat: -20,
    lon: 138,
    flyHeightM: 13_000_000,
    wx: {
      tempC: 32, condition: 'Hector buildups', windKph: 9, windDir: 'NW',
      humidity: 75, pressureMb: 1007, dewpointC: 25, cloudCover: 65, capeJkg: 2700,
      pulse: { cgShare: 26, avgPeakKA: 30 },
      cells: [{ id: 'C-6612', bearing: 'SW', speedKph: 14, hailProb: 12, tag: null }],
      alerts: [],
    },
  },
]
