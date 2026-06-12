// lib/hero.ts — shared constants & helpers for the hero globe.
// latLonToVector3 uses the exact same mapping as LightningGlobe, so baked
// strikes land on the correct geography of the earth-night texture.

import * as THREE from 'three'

export const INITIAL_ROTATION_Y = 0

const DEG2RAD = Math.PI / 180

export function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * DEG2RAD
  const theta = (lon + 180) * DEG2RAD
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}
