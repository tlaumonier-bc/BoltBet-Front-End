'use client';
import { Suspense, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { WebGLRenderer } from 'three';

export const INITIAL_ROTATION_Y = 0; // keep identical in the live hero
const RADIUS = 2;
const TEXTURE_URL = '/earth-night.jpg';

function Earth() {
  const texture = useTexture(TEXTURE_URL);
  return (
    <mesh rotation={[0, INITIAL_ROTATION_Y, 0]}>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial
        map={texture} emissiveMap={texture}
        emissive="#ffffff" emissiveIntensity={0.45}
        roughness={1} metalness={0}
      />
    </mesh>
  );
}

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color('#3b82f6') } },
        vertexShader: `varying vec3 vNormal;
          void main(){ vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `varying vec3 vNormal; uniform vec3 glowColor;
          void main(){ float i = pow(0.65 - dot(vNormal, vec3(0.0,0.0,1.0)), 2.5);
          gl_FragColor = vec4(glowColor,1.0) * i;} `,
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

export default function GlobeShotPage() {
  const rendererRef = useRef<WebGLRenderer | null>(null);

  const download = () => {
    const gl = rendererRef.current;
    if (!gl) return;
    gl.domElement.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'globe-poster.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#04060d' }}>
      {/* square canvas → square PNG, dpr 2 → 2048px */}
      <div style={{ width: 1024, height: 1024, margin: '0 auto' }}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          dpr={2}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => { rendererRef.current = gl; }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 3, 5]} intensity={1.2} />
          <Suspense fallback={null}>
            <Earth />
            <Atmosphere />
          </Suspense>
        </Canvas>
      </div>
      <button
        onClick={download}
        style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 16px' }}
      >
        Download globe-poster.png
      </button>
    </main>
  );
}