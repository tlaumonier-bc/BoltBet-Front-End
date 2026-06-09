'use client'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useTexture, Html, Text, Billboard, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '@/store/gameStore'
import { buildInitialCells, cellCenter, regionName } from '@/lib/grid'
import { useLightningSocket } from '@/lib/socket'
import type { GridCell, LightningStrike } from '@/types'

const RADIUS = 2
const DEG2RAD = Math.PI / 180
const TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-night.jpg'
const GRID_GRAY = '#94a3b8'

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * DEG2RAD
  const theta = (lon + 180) * DEG2RAD
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function Earth() {
  const texture = useTexture(TEXTURE_URL)
  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={texture}
        emissive={'#ffffff'}
        emissiveIntensity={0.45}
        roughness={1}
        metalness={0}
      />
    </mesh>
  )
}

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color('#3b82f6') } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vNormal;
          uniform vec3 glowColor;
          void main() {
            float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
            gl_FragColor = vec4(glowColor, 1.0) * intensity;
          }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      }),
    []
  )
  return (
    <mesh material={material}>
      <sphereGeometry args={[RADIUS * 1.08, 64, 64]} />
    </mesh>
  )
}

function buildCellGeometry(lonMin: number, latMin: number, radius: number, seg = 6) {
  const geom = new THREE.BufferGeometry()
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= seg; i++) {
    for (let j = 0; j <= seg; j++) {
      const lon = lonMin + (i / seg) * 20
      const lat = latMin + (j / seg) * 20
      const v = latLonToVector3(lat, lon, radius)
      positions.push(v.x, v.y, v.z)
    }
  }
  const w = seg + 1
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * w + j
      const b = a + 1
      const c = a + w
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}

function buildCellBorder(lonMin: number, latMin: number, radius: number, seg = 6) {
  const pts: [number, number, number][] = []
  const push = (lat: number, lon: number) => {
    const v = latLonToVector3(lat, lon, radius)
    pts.push([v.x, v.y, v.z])
  }
  for (let i = 0; i <= seg; i++) push(latMin, lonMin + (i / seg) * 20)
  for (let i = 1; i <= seg; i++) push(latMin + (i / seg) * 20, lonMin + 20)
  for (let i = 1; i <= seg; i++) push(latMin + 20, lonMin + 20 - (i / seg) * 20)
  for (let i = 1; i <= seg; i++) push(latMin + 20 - (i / seg) * 20, lonMin)
  return pts
}

function Cell({ cell }: { cell: GridCell }) {
  const [hovered, setHovered] = useState(false)
  const selectCell = useGameStore((s) => s.selectCell)

  const fillGeometry = useMemo(
    () => buildCellGeometry(cell.lonMin, cell.latMin, RADIUS + 0.01),
    [cell.lonMin, cell.latMin]
  )
  const borderPoints = useMemo(
    () => buildCellBorder(cell.lonMin, cell.latMin, RADIUS + 0.012),
    [cell.lonMin, cell.latMin]
  )
  const center = cellCenter(cell.lonMin, cell.latMin)
  const labelPos = useMemo(
    () => latLonToVector3(center.lat, center.lon, RADIUS + 0.02),
    [center.lat, center.lon]
  )

  return (
    <group>
      <mesh
        geometry={fillGeometry}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          selectCell(cell.id)
        }}
      >
        <meshBasicMaterial
          color={GRID_GRAY}
          transparent
          opacity={hovered ? 0.12 : 0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <Line
        points={borderPoints}
        color={GRID_GRAY}
        lineWidth={1}
        transparent
        opacity={hovered ? 0.6 : 0.22}
      />

      <Billboard position={labelPos}>
        <Text
          fontSize={0.07}
          color={GRID_GRAY}
          anchorX="center"
          anchorY="middle"
          fillOpacity={hovered ? 0.9 : 0.5}
          outlineWidth={0}
        >
          {cell.multiplier.toFixed(1)}x
        </Text>
      </Billboard>

      {hovered && (
        <Html
          position={latLonToVector3(center.lat, center.lon, RADIUS + 0.2)}
          center
          distanceFactor={6}
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-md border border-white/15 bg-black/80 px-3 py-2 text-xs text-white shadow-lg backdrop-blur">
            <div className="font-semibold">{regionName(center.lat, center.lon)}</div>
            <div className="text-white/70">{cell.multiplier.toFixed(1)}x multiplier</div>
            <div className="text-white/50">
              {cell.strikeCount24h} strikes / 24h · {cell.activeBets} bets
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function GridCells() {
  const cells = useGameStore((s) => s.cells)
  return (
    <>
      {Object.values(cells).map((c) => (
        <Cell key={c.id} cell={c} />
      ))}
    </>
  )
}

// 1. Parent Manager Component (This maps and solves the 'strike is missing' TS error)
function Strikes() {
  const strikes = useGameStore((s) => s.strikes) || []
  
  // Force TypeScript to recognize this as an array of LightningStrike objects
  const strikeArray = (
    Array.isArray(strikes) ? strikes : Object.values(strikes)
  ) as LightningStrike[]

  return (
    <>
      {strikeArray.map((strike) => (
        <StrikeVisual key={strike.id} strike={strike} />
      ))}
    </>
  )
}

// 2. Individual Presentation Component (Solves the Math.random Purity error)
function StrikeVisual({ strike }: { strike: LightningStrike }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null)
  const pointRef = useRef<THREE.Points>(null)

  const surface = useMemo(() => latLonToVector3(strike.lat, strike.lon, RADIUS), [strike])

  const [boltPoints] = useState<[number, number, number][]>(() => {
    const top = latLonToVector3(strike.lat, strike.lon, RADIUS + 0.35)
    const normal = surface.clone().normalize()
    const tangent = new THREE.Vector3()
      .crossVectors(normal, new THREE.Vector3(0, 1, 0))
      .normalize()
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize()
    const dir = top.clone().sub(surface)
    const segs = 6
    const out: [number, number, number][] = []
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      const p = surface.clone().add(dir.clone().multiplyScalar(t))
      if (i !== 0 && i !== segs) {
        const j = 0.05 * (1 - t)
        p.add(tangent.clone().multiplyScalar((Math.random() - 0.5) * j))
        p.add(bitangent.clone().multiplyScalar((Math.random() - 0.5) * j))
      }
      out.push([p.x, p.y, p.z])
    }
    return out
  })

  const pointGeom = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([surface]),
    [surface]
  )

  useFrame(() => {
    const age = (Date.now() - strike.timestamp) / 1000
    const o = Math.max(0, 1 - age / 2)
    if (lineRef.current?.material) lineRef.current.material.opacity = o
    if (pointRef.current) (pointRef.current.material as THREE.PointsMaterial).opacity = o
  })

  return (
    <group>
      <Line ref={lineRef} points={boltPoints} color="#bfe3ff" lineWidth={2} transparent />
      <points ref={pointRef} geometry={pointGeom}>
        <pointsMaterial
          color="#eaf4ff"
          size={0.16}
          transparent
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

function DemoStrikes() {
  const addStrike = useGameStore((s) => s.addStrike)
  useEffect(() => {
    const t = setInterval(() => {
      addStrike({
        id: crypto.randomUUID(),
        lat: (Math.random() - 0.5) * 120,
        lon: (Math.random() - 0.5) * 360,
        timestamp: Date.now(),
        quality: 'good',
      })
    }, 700)
    return () => clearInterval(t)
  }, [addStrike])
  return null
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null)
  const setCells = useGameStore((s) => s.setCells)
  const cellCount = useGameStore((s) => Object.keys(s.cells).length)

  useEffect(() => {
    if (cellCount === 0) setCells(buildInitialCells())
  }, [cellCount, setCells])

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.001
  })

  return (
    <group ref={groupRef}>
      <Earth />
      <Atmosphere />
      <GridCells />
      <Strikes />
      <DemoStrikes />
    </group>
  )
}

export default function LightningGlobe() {
  useLightningSocket()
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={3}
          maxDistance={10}
          enablePan={false}
        />
      </Canvas>
    </div>
  )
}