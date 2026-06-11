'use client';
// components/Hero/HeroLiveGlobe.tsx
// Live, auto-rotating teaser globe for the landing hero: the orb's textured
// Earth + atmosphere shell with lightning bolts stabbing down (red/amber/white),
// driven by the strike simulation so it feels alive. Contained (fills parent).

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { useStrikeSim } from '@/lib/strikeSim';
import type { LightningStrike } from '@/types';

const R = 2;
const DEG = Math.PI / 180;

function colorForStrike(q: string): number {
  if (q === 'high' || q === 'good') return 0xff3b54; // intense red
  if (q === 'med' || q === 'medium') return 0xffb000; // amber
  return 0xeaf4ff; // cool white
}
function llv(lat: number, lon: number, rad: number) {
  const phi = (90 - lat) * DEG;
  const the = (lon + 180) * DEG;
  return new THREE.Vector3(
    -rad * Math.sin(phi) * Math.cos(the),
    rad * Math.cos(phi),
    rad * Math.sin(phi) * Math.sin(the)
  );
}

interface StrikeObj {
  grp: THREE.Group;
  line: THREE.Line;
  glow: THREE.Mesh;
  age: number;
  ttl: number;
}

export default function HeroLiveGlobe() {
  useStrikeSim(); // keep the globe alive without the backend
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // WebGL unavailable — leave the container empty rather than crash
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 0, 4.8);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const globe = new THREE.Group();
    globe.rotation.x = -0.32;
    scene.add(globe);

    const tex = new THREE.TextureLoader().load('/earth-grey.jpg');
    if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), new THREE.MeshBasicMaterial({ map: tex })));

    // atmosphere shell
    globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.16, 48, 48),
        new THREE.ShaderMaterial({
          transparent: true,
          side: THREE.BackSide,
          uniforms: { c: { value: new THREE.Color(0x3aa0ff) } },
          vertexShader:
            'varying float i;void main(){vec3 n=normalize(normalMatrix*normal);vec3 v=normalize((modelViewMatrix*vec4(position,1.)).xyz);i=pow(1.0-abs(dot(n,v)),3.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
          fragmentShader: 'varying float i;uniform vec3 c;void main(){gl_FragColor=vec4(c,i*0.45);}',
        })
      )
    );

    scene.add(new THREE.AmbientLight(0x5a6a7a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 2, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb98cff, 0.5);
    rim.position.set(-4, -1, -2);
    scene.add(rim);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const objs: StrikeObj[] = [];
    const shown = new Set<string>();

    const makeStrike = (lat: number, lon: number, q: string) => {
      const surf = llv(lat, lon, R * 1.004);
      const up = surf.clone().normalize();
      const out = surf.clone().add(up.clone().multiplyScalar(R * (0.12 + Math.random() * 0.07)));
      const segs = 5;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const f = i / segs;
        const p = out.clone().lerp(surf, f);
        if (i > 0 && i < segs) {
          const j = 0.02 * (1 - f);
          p.x += rnd(-j, j);
          p.y += rnd(-j, j);
          p.z += rnd(-j, j);
        }
        pts.push(p);
      }
      const col = new THREE.Color(colorForStrike(q));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 1 })
      );
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.035, 18),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      );
      glow.position.copy(surf);
      glow.lookAt(surf.clone().multiplyScalar(2));
      const grp = new THREE.Group();
      grp.add(line);
      grp.add(glow);
      globe.add(grp);
      objs.push({ grp, line, glow, age: 0, ttl: 0.9 + Math.random() * 0.7 });
    };

    const spawnNew = (strikes: LightningStrike[]) => {
      for (const s of strikes) {
        if (shown.has(s.id)) continue;
        if (Date.now() - s.receivedAt > 800) {
          shown.add(s.id);
          continue;
        }
        shown.add(s.id);
        makeStrike(s.lat, s.lon, s.quality);
      }
      if (shown.size > 1500) shown.clear();
    };
    spawnNew(useGameStore.getState().strikes);
    const unsub = useGameStore.subscribe((st, pr) => {
      if (st.strikes !== pr.strikes) spawnNew(st.strikes);
    });

    // ---- interactivity: drag to spin (auto-spins when idle) ----
    const rot = { x: -0.32, y: 0 };
    const target = { x: -0.32, y: 0 };
    let autoSpin = true;
    let dragging = false;
    let spinTimer: ReturnType<typeof setTimeout> | undefined;
    const el = renderer.domElement;
    el.style.cursor = 'grab';
    const onDown = (e: PointerEvent) => {
      dragging = true;
      autoSpin = false;
      el.style.cursor = 'grabbing';
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      target.y += (e.movementX || 0) * 0.005;
      target.x += (e.movementY || 0) * 0.005;
      target.x = Math.max(-1.2, Math.min(1.2, target.x));
    };
    const onUp = () => {
      dragging = false;
      el.style.cursor = 'grab';
      clearTimeout(spinTimer);
      spinTimer = setTimeout(() => (autoSpin = true), 3500);
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    let raf = 0;
    let last = performance.now();
    let stopped = false;
    const loop = (now: number) => {
      if (stopped) return;
      const dt = now - last;
      last = now;
      if (autoSpin) target.y += 0.00016 * dt; // it turns when idle
      rot.x += (target.x - rot.x) * 0.08;
      rot.y += (target.y - rot.y) * 0.08;
      globe.rotation.x = rot.x;
      globe.rotation.y = rot.y;
      cam.lookAt(0, 0, 0);
      for (const s of objs) {
        s.age += dt / 1000;
        const a = Math.max(0, 1 - s.age / s.ttl);
        (s.line.material as THREE.LineBasicMaterial).opacity = a;
        s.glow.scale.setScalar(1 + (s.age / s.ttl) * 4);
        (s.glow.material as THREE.MeshBasicMaterial).opacity = 0.8 * a;
      }
      for (let i = objs.length - 1; i >= 0; i--) {
        if (objs[i].age >= objs[i].ttl) {
          const s = objs[i];
          globe.remove(s.grp);
          s.line.geometry.dispose();
          (s.line.material as THREE.Material).dispose();
          s.glow.geometry.dispose();
          (s.glow.material as THREE.Material).dispose();
          objs.splice(i, 1);
        }
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(spinTimer);
      ro.disconnect();
      unsub();
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
      tex.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
