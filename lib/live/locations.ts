// lib/live/locations.ts
// "Orbit to" shortcuts for the /live console + per-location SAMPLE data,
// shaped like the Xweather endpoints they will later come from:
//   wx core (temp, wind, humidity, pressure, dewpoint, sky) → /conditions
//   capeJkg                                                 → /conditions (cape)
//   cells (movement, hail prob, TVS/MESO flags)             → /stormcells
//   alerts                                                  → /alerts
//   pulse (CG/IC split, peak amperage)                      → /lightning
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
  wx: LocationWeatherSample
}

export const ORBIT_LOCATIONS: OrbitLocation[] = [
  {
    id: 'maracaibo',
    short: 'Maracaibo',
    label: 'Lake Maracaibo, Venezuela',
    lat: 9.7,
    lon: -71.6,
    wx: {
      tempC: 31, condition: 'Thunderstorms', windKph: 14, windDir: 'SW',
      humidity: 78, pressureMb: 1009, dewpointC: 26, cloudCover: 85, capeJkg: 2900,
      pulse: { cgShare: 27, avgPeakKA: 31 },
      cells: [
        { id: 'C-4172', bearing: 'NE', speedKph: 22, hailProb: 35, tag: 'MESO' },
        { id: 'C-4180', bearing: 'N', speedKph: 18, hailProb: 10, tag: null },
      ],
      alerts: [{ event: 'Severe Thunderstorm Warning', severity: 'warning', expires: 'in 42 min' }],
    },
  },
  {
    id: 'congo',
    short: 'Congo Basin',
    label: 'Congo Basin, DR Congo',
    lat: 0.5,
    lon: 22.5,
    wx: {
      tempC: 29, condition: 'Storm clusters', windKph: 9, windDir: 'E',
      humidity: 84, pressureMb: 1011, dewpointC: 24, cloudCover: 90, capeJkg: 3400,
      pulse: { cgShare: 22, avgPeakKA: 26 },
      cells: [{ id: 'C-0883', bearing: 'W', speedKph: 12, hailProb: 20, tag: null }],
      alerts: [],
    },
  },
  {
    id: 'borneo',
    short: 'Borneo',
    label: 'Maritime Continent — Borneo',
    lat: 4,
    lon: 114,
    wx: {
      tempC: 30, condition: 'Monsoon storms', windKph: 11, windDir: 'NW',
      humidity: 88, pressureMb: 1008, dewpointC: 26, cloudCover: 92, capeJkg: 3100,
      pulse: { cgShare: 24, avgPeakKA: 28 },
      cells: [
        { id: 'C-9051', bearing: 'NW', speedKph: 15, hailProb: 15, tag: 'MESO' },
        { id: 'C-9057', bearing: 'W', speedKph: 10, hailProb: 5, tag: null },
      ],
      alerts: [{ event: 'Heavy Rain Watch', severity: 'watch', expires: 'in 3 h' }],
    },
  },
  {
    id: 'florida',
    short: 'Florida',
    label: 'Tampa Bay, Florida',
    lat: 28,
    lon: -82.5,
    wx: {
      tempC: 33, condition: 'Sea-breeze storms', windKph: 19, windDir: 'ESE',
      humidity: 71, pressureMb: 1014, dewpointC: 24, cloudCover: 60, capeJkg: 2400,
      pulse: { cgShare: 33, avgPeakKA: 35 },
      cells: [
        { id: 'C-2210', bearing: 'NNE', speedKph: 30, hailProb: 45, tag: 'TVS' },
        { id: 'C-2216', bearing: 'NE', speedKph: 24, hailProb: 25, tag: null },
      ],
      alerts: [
        { event: 'Tornado Watch', severity: 'watch', expires: 'in 2 h' },
        { event: 'Severe Thunderstorm Warning', severity: 'warning', expires: 'in 28 min' },
      ],
    },
  },
  {
    id: 'himalaya',
    short: 'Himalayas',
    label: 'Himalayan Foothills, Nepal',
    lat: 28,
    lon: 84,
    wx: {
      tempC: 24, condition: 'Orographic storms', windKph: 13, windDir: 'S',
      humidity: 65, pressureMb: 1006, dewpointC: 17, cloudCover: 70, capeJkg: 1800,
      pulse: { cgShare: 30, avgPeakKA: 29 },
      cells: [{ id: 'C-5530', bearing: 'E', speedKph: 16, hailProb: 30, tag: null }],
      alerts: [],
    },
  },
  {
    id: 'pampas',
    short: 'Pampas',
    label: 'Pampas, Argentina',
    lat: -34,
    lon: -60,
    wx: {
      tempC: 27, condition: 'Supercells', windKph: 26, windDir: 'N',
      humidity: 58, pressureMb: 1004, dewpointC: 18, cloudCover: 55, capeJkg: 3800,
      pulse: { cgShare: 38, avgPeakKA: 42 },
      cells: [{ id: 'C-7741', bearing: 'ESE', speedKph: 38, hailProb: 60, tag: 'TVS' }],
      alerts: [{ event: 'Severe Thunderstorm Warning', severity: 'warning', expires: 'in 55 min' }],
    },
  },
  {
    id: 'europe',
    short: 'W. Europe',
    label: 'Western Europe',
    lat: 48.5,
    lon: 4.5,
    wx: {
      tempC: 19, condition: 'Scattered showers', windKph: 22, windDir: 'W',
      humidity: 67, pressureMb: 1016, dewpointC: 12, cloudCover: 75, capeJkg: 600,
      pulse: { cgShare: 18, avgPeakKA: 19 },
      cells: [],
      alerts: [],
    },
  },
  {
    id: 'topend',
    short: 'Top End',
    label: 'Top End, Australia',
    lat: -12.5,
    lon: 131,
    wx: {
      tempC: 32, condition: 'Hector buildups', windKph: 9, windDir: 'NW',
      humidity: 75, pressureMb: 1007, dewpointC: 25, cloudCover: 65, capeJkg: 2700,
      pulse: { cgShare: 26, avgPeakKA: 30 },
      cells: [{ id: 'C-6612', bearing: 'SW', speedKph: 14, hailProb: 12, tag: null }],
      alerts: [],
    },
  },
]
