'use client'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useTexture, Html, Text, Billboard, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '@/store/gameStore'
import { buildInitialCells, cellCenter, regionName } from '@/lib/grid'
import { useLightningSocket } from '@/lib/socket'
import type { GridCell } from '@/types'

const RADIUS = 2
const DEG2RAD = Math.PI / 180
const TEXTURE_URL = '/earth-night.jpg'
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

function Cell({ cell, viewOnly }: { cell: GridCell; viewOnly?: boolean }) {
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
          if (!viewOnly) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!viewOnly) selectCell(cell.id)
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

function GridCells({ viewOnly }: { viewOnly?: boolean }) {
  const cells = useGameStore((s) => s.cells)
  return (
    <>
      {Object.values(cells).map((c) => (
        <Cell key={c.id} cell={c} viewOnly={viewOnly} />
      ))}
    </>
  )
}

function InstancedStrikes() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const shaderUniformsRef = useRef<Record<string, THREE.IUniform> | null>(null);

  const maxInstances = 200; 
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const baseGeom = useMemo(() => {
    const geom = new THREE.ConeGeometry(0.015, 0.4, 4, 5);
    geom.translate(0, 0.2, 0); 
    return geom;
  }, []);

  const pointGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(maxInstances * 3), 3));
    geom.setAttribute('aAlpha', new THREE.Float32BufferAttribute(new Float32Array(maxInstances), 1));
    return geom;
  }, []);

  const boltMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ 
      color: '#bfe3ff', 
      transparent: true, 
      blending: THREE.AdditiveBlending,
      depthWrite: false 
    });
    
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shaderUniformsRef.current = shader.uniforms;
      
      shader.vertexShader = `
        uniform float uTime;
        attribute float birthTime;
        varying float vAlpha;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        float age = (uTime - birthTime) / 1000.0;
        vAlpha = (birthTime > 0.0 && age >= 0.0 && age < 2.0) ? (1.0 - (age / 2.0)) : 0.0;
        
        if (position.y > 0.05 && vAlpha > 0.0) {
          float noiseX = sin(float(gl_InstanceID) * 12.3 + position.y * 20.0) * 0.05;
          float noiseZ = cos(float(gl_InstanceID) * 45.6 + position.y * 20.0) * 0.05;
          transformed.x += noiseX;
          transformed.z += noiseZ;
        }
        `
      );
      shader.fragmentShader = `
        varying float vAlpha;
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
        if (vAlpha <= 0.0) discard;
        vec4 diffuseColor = vec4( diffuse, opacity * (vAlpha * vAlpha) );
        `
      );
    };
    return mat;
  }, []);

  const pointMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#eaf4ff') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 15.0 * (1.0 / -mvPosition.z) * (0.5 + aAlpha);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        if(vAlpha <= 0.01) discard;
        float d = length(gl_PointCoord - vec2(0.5));
        if(d > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vAlpha);
      }
    `
  }), []);

  useEffect(() => {
    if (meshRef.current && !meshRef.current.geometry.hasAttribute('birthTime')) {
      meshRef.current.geometry.setAttribute(
        'birthTime', 
        new THREE.InstancedBufferAttribute(new Float32Array(maxInstances), 1)
      );
    }
  }, []);

  useFrame(() => {
    if (!meshRef.current || !pointsRef.current) return;
    if (!meshRef.current.geometry.hasAttribute('birthTime')) return; 
    
    const strikes = useGameStore.getState().strikes;
    const now = Date.now();
    
    if (shaderUniformsRef.current && shaderUniformsRef.current.uTime) {
      shaderUniformsRef.current.uTime.value = now;
    }

    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const alphaArray = pointsRef.current.geometry.attributes.aAlpha.array as Float32Array;
    const birthTimes = meshRef.current.geometry.attributes.birthTime.array as Float32Array;

    for (let i = 0; i < maxInstances; i++) {
      const strike = strikes[i];
      if (strike) {
        const pos = latLonToVector3(strike.lat, strike.lon, RADIUS);
        dummy.position.copy(pos);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
        dummy.updateMatrix();
        
        meshRef.current.setMatrixAt(i, dummy.matrix);
        birthTimes[i] = strike.receivedAt; 

        posArray[i * 3] = pos.x;
        posArray[i * 3 + 1] = pos.y;
        posArray[i * 3 + 2] = pos.z;
        
        const age = (now - strike.receivedAt) / 1000;
        alphaArray[i] = age < 2.0 ? 1.0 - (age / 2.0) : 0;
      } else {
        birthTimes[i] = 0;
        alphaArray[i] = 0;
        dummy.matrix.identity().scale(new THREE.Vector3(0,0,0));
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.geometry.attributes.birthTime.needsUpdate = true;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.aAlpha.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[baseGeom, boltMaterial, maxInstances]} frustumCulled={false} />
      <points ref={pointsRef} args={[pointGeom, pointMaterial]} frustumCulled={false} />
    </group>
  );
}

function Scene({ viewOnly }: { viewOnly?: boolean }) {
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
      <GridCells viewOnly={viewOnly} />
      <InstancedStrikes />
    </group>
  )
}

export default function LightningGlobe({ viewOnly = false }: { viewOnly?: boolean }) {
  useLightningSocket()
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />
        <Suspense fallback={null}>
          <Scene viewOnly={viewOnly} />
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