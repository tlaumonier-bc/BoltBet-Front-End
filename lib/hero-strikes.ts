// A PRE-RECORDED lightning sequence for the hero globe.
//
// Why pre-recorded instead of live-random: at ~50 strikes/second a per-frame
// Math.random() + trig + allocation path would thrash the main thread and the
// GC. Instead we bake one deterministic ~6s loop ONCE at module load — every
// strike's globe position is precomputed into a flat Float32Array — and the
// render loop just replays it. Deterministic (seeded) also means it's
// SSR-stable and identical on every reload.
//
// Strikes are weighted toward the places Earth actually lights up most
// (the Maritime Continent, the Congo Basin, Lake Maracaibo, the US Gulf,
// the Sierra Madre, central Africa, the Himalayan foothills...) so the globe
// reads like real lightning climatology, not uniform noise.

import { latLonToVector3 } from './hero'

// Just above the Earth's surface (globe radius is 2) so flashes hover on the
// crust without z-fighting, and back-hemisphere strikes are occluded by it.
export const HERO_STRIKE_RADIUS = 2.02
export const STRIKES_PER_SECOND = 50
export const SEQUENCE_SECONDS = 10
const COUNT = STRIKES_PER_SECOND * SEQUENCE_SECONDS // 300 baked strikes

// [lat, lon, weight, spreadDeg] — weight biases how often a region fires,
// spreadDeg is the rough radius of jitter around the centre.
const HOTSPOTS: [number, number, number, number][] = [
  [4, 114, 10, 16], // Maritime Continent (Borneo / Indonesia) — world max
  [0, 22, 9, 14], // Congo Basin
  [9, -71, 7, 4], // Lake Maracaibo, Venezuela — most strikes/km² on Earth
  [6, 4, 6, 12], // West Africa / Gulf of Guinea
  [28, 84, 5, 10], // Himalayan foothills / N. India
  [29, -92, 5, 9], // US Gulf Coast
  [-15, -55, 5, 12], // Brazil / Mato Grosso
  [18, -97, 4, 8], // Sierra Madre, Mexico
  [-25, 29, 4, 9], // Highveld, South Africa
  [35, 138, 3, 8], // Japan / Kuroshio
  [-34, -60, 3, 9], // Argentine Pampas
  [13, 100, 3, 8], // Indochina
  [44, -92, 3, 9], // US Upper Midwest
  [41, 14, 2, 7], // Mediterranean
  [-12, 132, 2, 9], // N. Australia (Top End)
  [52, 20, 2, 8], // Central Europe
]

// mulberry32 — tiny deterministic PRNG so the bake never touches Math.random.
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface HeroStrikeSequence {
  /** Strike fire-times in seconds within the loop, strictly ascending. */
  times: Float32Array
  /** Flat [x,y,z, x,y,z, ...] globe positions, one triple per strike. */
  positions: Float32Array
  count: number
  duration: number
}

export const heroStrikeSequence: HeroStrikeSequence = (() => {
  const rng = makeRng(0x9e3779b9)
  const totalWeight = HOTSPOTS.reduce((s, h) => s + h[2], 0)

  const times = new Float32Array(COUNT)
  const positions = new Float32Array(COUNT * 3)

  for (let i = 0; i < COUNT; i++) {
    // Evenly spread across the loop for a steady ~50/s, with sub-slot jitter
    // so flashes don't visibly pulse in lockstep.
    times[i] = ((i + (rng() - 0.5) * 0.6) / COUNT) * SEQUENCE_SECONDS

    // Pick a hotspot by weight, then scatter around it. Two rng() samples
    // averaged approximate a bell curve → clusters dense in the centre.
    let pick = rng() * totalWeight
    let h = HOTSPOTS[0]
    for (const cand of HOTSPOTS) {
      pick -= cand[2]
      if (pick <= 0) {
        h = cand
        break
      }
    }
    const [baseLat, baseLon, , spread] = h
    const jLat = (rng() + rng() - 1) * spread
    const jLon = (rng() + rng() - 1) * spread
    const lat = Math.max(-85, Math.min(85, baseLat + jLat))
    const lon = baseLon + jLon

    const v = latLonToVector3(lat, lon, HERO_STRIKE_RADIUS)
    positions[i * 3] = v.x
    positions[i * 3 + 1] = v.y
    positions[i * 3 + 2] = v.z
  }

  // Keep times ascending so the player can walk them with a single cursor.
  times.sort()

  return { times, positions, count: COUNT, duration: SEQUENCE_SECONDS }
})()
