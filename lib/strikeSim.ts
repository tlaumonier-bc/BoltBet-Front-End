'use client';
// lib/strikeSim.ts
// Client-side storm/strike simulation so the globe animates with lightning even
// when the backend feed isn't running. Mirrors the orb reference's storm model:
// a handful of drifting storm cells that probabilistically emit strikes nearby.
// Sim strikes are tagged with a `sim-` id; if REAL strikes arrive from the
// websocket, the sim backs off so live data always wins.

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Storm {
  lat: number;
  lon: number;
  vlat: number;
  vlon: number;
  spread: number;
  intensity: number;
  phase: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// Seed cells over the world's main thunderstorm belts (equatorial Africa, the
// Maritime Continent, the Americas, South Asia, etc.).
function seedStorms(): Storm[] {
  const centers: [number, number][] = [
    [4, 18], // Congo basin
    [-2, 118], // Indonesia
    [9, -80], // Panama / N. South America
    [-18, -55], // Brazil
    [22, 88], // Bay of Bengal
    [33, -92], // US South
    [-12, 32], // SE Africa
  ];
  return centers.map(([lat, lon]) => ({
    lat: lat + rnd(-8, 8),
    lon: lon + rnd(-10, 10),
    vlat: rnd(-0.015, 0.015),
    vlon: rnd(-0.03, 0.03),
    spread: rnd(6, 14),
    intensity: rnd(0.5, 1),
    phase: rnd(0, 6.28),
  }));
}

function qualityForEnergy(energy: number): string {
  return energy > 90 ? 'high' : energy > 45 ? 'med' : 'low';
}

export function useStrikeSim(enabled = true) {
  const addStrike = useGameStore((s) => s.addStrike);

  useEffect(() => {
    if (!enabled) return;
    const storms = seedStorms();
    let raf = 0;
    let last = 0;
    let id = 0;

    const tick = (t: number) => {
      const strikes = useGameStore.getState().strikes;
      // Back off if a real (non-sim) strike landed recently.
      const realRecent = strikes.some(
        (s) => !s.id.startsWith('sim-') && Date.now() - s.receivedAt < 25000
      );
      if (!realRecent && t - last > 110) {
        last = t;
        for (const s of storms) {
          s.lat += s.vlat;
          s.lon += s.vlon;
          if (s.lat > 55 || s.lat < -55) s.vlat *= -1;
          if (s.lon > 180) s.lon -= 360;
          if (s.lon < -180) s.lon += 360;
          const br = 0.7 + 0.3 * Math.sin(t * 0.0011 + s.phase);
          if (Math.random() < s.intensity * br * 0.12) {
            const lat = s.lat + rnd(-s.spread, s.spread) * 0.5;
            const lon = s.lon + rnd(-s.spread, s.spread) * 0.5;
            const energy = rnd(8, 130);
            addStrike({
              id: `sim-${(id++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              lat,
              lon,
              timestamp: Date.now(),
              receivedAt: Date.now(),
              quality: qualityForEnergy(energy),
            });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, addStrike]);
}
