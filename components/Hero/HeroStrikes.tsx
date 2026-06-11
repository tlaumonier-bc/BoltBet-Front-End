'use client'
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { heroStrikeSequence } from '@/lib/hero-strikes'

const POOL = 96 // Max concurrent bolts on screen

export default function HeroStrikes() {
  const { times, positions, count, duration } = heroStrikeSequence;

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const play = useRef({ cursor: 0, slot: 0, lastLoopT: 0, birth: new Float32Array(POOL).fill(-1000) });
  
  // FIX: Broaden the type to accept Three's internal uniforms dictionary
  const shaderUniformsRef = useRef<Record<string, THREE.IUniform> | null>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const baseGeom = useMemo(() => {
    const geom = new THREE.ConeGeometry(0.015, 0.4, 4, 5);
    geom.translate(0, 0.2, 0); 
    return geom;
  }, []);

  const pointGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(POOL * 3), 3));
    geom.setAttribute('aAlpha', new THREE.Float32BufferAttribute(new Float32Array(POOL), 1));
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
        float age = uTime - birthTime;
        vAlpha = (birthTime > -100.0 && age >= 0.0 && age < 1.5) ? (1.0 - (age / 1.5)) : 0.0;
        
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
    if (meshRef.current) {
      meshRef.current.geometry.setAttribute('birthTime', new THREE.InstancedBufferAttribute(play.current.birth, 1));
    }
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !pointsRef.current) return;
    
    const p = play.current;
    const elapsed = state.clock.getElapsedTime();
    const loopT = elapsed % duration;
    
    // FIX: Safely update uTime without TS complaining
    if (shaderUniformsRef.current && shaderUniformsRef.current.uTime) {
      shaderUniformsRef.current.uTime.value = elapsed;
    }

    if (loopT < p.lastLoopT) p.cursor = 0;
    p.lastLoopT = loopT;

    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const alphaArray = pointsRef.current.geometry.attributes.aAlpha.array as Float32Array;

    while (p.cursor < count && times[p.cursor] <= loopT) {
      const s = p.slot % POOL;
      p.slot++;
      
      const src = p.cursor * 3;
      const pos = new THREE.Vector3(positions[src], positions[src + 1], positions[src + 2]);
      
      dummy.position.copy(pos);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(s, dummy.matrix);
      p.birth[s] = elapsed;

      posArray[s * 3] = pos.x;
      posArray[s * 3 + 1] = pos.y;
      posArray[s * 3 + 2] = pos.z;
      
      p.cursor++;
    }

    for (let i = 0; i < POOL; i++) {
      const age = elapsed - p.birth[i];
      alphaArray[i] = (age >= 0 && age < 1.5) ? 1.0 - (age / 1.5) : 0;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.geometry.attributes.birthTime.needsUpdate = true;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.aAlpha.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[baseGeom, boltMaterial, POOL]} frustumCulled={false} />
      <points ref={pointsRef} args={[pointGeom, pointMaterial]} frustumCulled={false} />
    </group>
  );
}