'use client';
// components/Hero/HeroGlobeCanvas.tsx
// A deliberately LIGHT globe for the landing hero: just the rotating Earth + an
// atmosphere shell. No 162 cells, no strikes, no OrbitControls — so it costs a
// fraction of the full /play globe, never grabs the pointer, and never blocks
// scrolling. The full interactive globe still lives on /play and /live.
// Loaded lazily by HeroGlobe (ssr:false, after the page is idle).

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const RADIUS = 2;
const TEXTURE_URL = '/earth-night.jpg'; // self-hosted in /public (Phase 5)

function Earth() {
  const texture = useTexture(TEXTURE_URL);
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
  );
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
  );
  return (
    <mesh material={material}>
      <sphereGeometry args={[RADIUS * 1.08, 64, 64]} />
    </mesh>
  );
}

function Spinner({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.0012;
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroGlobeCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: 'none' }} // never intercept clicks/scroll
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <Suspense fallback={null}>
        <Spinner>
          <Earth />
          <Atmosphere />
        </Spinner>
      </Suspense>
    </Canvas>
  );
}
