'use client'
// components/Hero/HeroStrikes.tsx
// Replays the pre-recorded ~50 strikes/second sequence on the hero globe as a
// single GPU points pool — ONE draw call, zero per-frame allocation. Each
// strike grabs a slot in a small ring buffer, flashes bright, then fades over
// ~1.1s. (The full bolt geometry from LightningGlobe's StrikeVisual stays on
// /play and /live; at 50/s a React-component-per-strike would not be viable,
// so the hero uses this pooled flash field instead.)

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { heroStrikeSequence } from '@/lib/hero-strikes'

const POOL = 96 // > peak concurrent flashes (≈50/s × 1.1s fade)
const FADE = 1.1 // seconds a flash stays visible

export default function HeroStrikes() {
  const { times, positions, count, duration } = heroStrikeSequence

  // Stable render values: the buffers backing the geometry + the material.
  const posArr = useMemo(() => new Float32Array(POOL * 3), [])
  const alphaArr = useMemo(() => new Float32Array(POOL), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: 22 },
          uHalo: { value: new THREE.Color('#7cc4ff') },
          uCore: { value: new THREE.Color('#eaf4ff') },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute float aAlpha;
          varying float vAlpha;
          uniform float uSize;
          void main() {
            vAlpha = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * (5.0 / -mv.z) * (0.45 + aAlpha * 0.8);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          precision mediump float;
          varying float vAlpha;
          uniform vec3 uHalo;
          uniform vec3 uCore;
          void main() {
            if (vAlpha <= 0.001) discard;
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float glow = smoothstep(0.5, 0.0, d);
            float core = smoothstep(0.18, 0.0, d);
            vec3 col = mix(uHalo, uCore, core);
            float a = (glow * 0.55 + core) * vAlpha;
            gl_FragColor = vec4(col, a);
          }`,
      }),
    []
  )

  // Mutable playback state lives behind a ref — only ever touched inside the
  // frame loop, never during render (keeps the React Compiler happy).
  const points = useRef<THREE.Points>(null)
  const play = useRef({ cursor: 0, slot: 0, lastLoopT: 0, birth: new Float32Array(POOL).fill(-1000) })

  useFrame((state) => {
    const pts = points.current
    if (!pts) return
    const pos = pts.geometry.attributes.position.array as Float32Array
    const alpha = pts.geometry.attributes.aAlpha.array as Float32Array
    const p = play.current
    const elapsed = state.clock.getElapsedTime()
    const loopT = elapsed % duration

    // Sequence wrapped back to the start of the loop.
    if (loopT < p.lastLoopT) p.cursor = 0
    p.lastLoopT = loopT

    // Spawn every strike whose fire-time has passed since the last frame.
    while (p.cursor < count && times[p.cursor] <= loopT) {
      const s = p.slot % POOL
      p.slot++
      const src = p.cursor * 3
      pos[s * 3] = positions[src]
      pos[s * 3 + 1] = positions[src + 1]
      pos[s * 3 + 2] = positions[src + 2]
      p.birth[s] = elapsed
      p.cursor++
    }

    // Fade every live slot. Squared falloff = a sharp flash, gentle tail.
    for (let i = 0; i < POOL; i++) {
      const age = elapsed - p.birth[i]
      const t = age >= 0 && age < FADE ? 1 - age / FADE : 0
      alpha[i] = t * t
    }

    pts.geometry.attributes.position.needsUpdate = true
    pts.geometry.attributes.aAlpha.needsUpdate = true
  })

  return (
    <points ref={points} material={material} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
        <bufferAttribute attach="attributes-aAlpha" args={[alphaArr, 1]} />
      </bufferGeometry>
    </points>
  )
}
