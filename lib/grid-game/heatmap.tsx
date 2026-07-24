'use client';
// lib/grid-game/heatmap.tsx
// Strike-density heatmap layer + colour ramp, shared by the Grid Game clients.
// Canvas accumulates soft alpha blobs (recent strikes weigh more), then recolours
// through the ramp. Translucent + screen-blended so the grid, chips, multipliers
// and bolts stay readable on top.

import { useEffect, useRef, useState } from 'react';
import type { Bounds } from '@/lib/map/countryBounds';
import type { CountryStrike } from '@/lib/api';
import { projectEqui } from './geo';

export const DENSITY_WINDOW_MS = 60_000; // heatmap reflects strikes from the last 60s (= a round)
export const DENSITY_REDRAW_MS = 1_000; // recompute the heatmap every second

export const HEAT_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: 0.0, c: [56, 189, 248] },
  { t: 0.35, c: [34, 197, 94] },
  { t: 0.6, c: [250, 204, 21] },
  { t: 0.82, c: [249, 115, 22] },
  { t: 1.0, c: [239, 68, 68] },
];
export const HEAT_GRADIENT_CSS = `linear-gradient(to right, ${HEAT_STOPS.map(
  (stop) => `rgb(${stop.c[0]},${stop.c[1]},${stop.c[2]}) ${Math.round(stop.t * 100)}%`,
).join(', ')})`;

let heatRamp: Uint8ClampedArray | null = null;
function getHeatRamp() {
  if (heatRamp) return heatRamp;
  const ramp = new Uint8ClampedArray(256 * 4);
  for (let a = 0; a < 256; a += 1) {
    const t = a / 255;
    let lo = HEAT_STOPS[0];
    let hi = HEAT_STOPS[HEAT_STOPS.length - 1];
    for (let i = 0; i < HEAT_STOPS.length - 1; i += 1) {
      if (t >= HEAT_STOPS[i].t && t <= HEAT_STOPS[i + 1].t) {
        lo = HEAT_STOPS[i];
        hi = HEAT_STOPS[i + 1];
        break;
      }
    }
    const f = (t - lo.t) / Math.max(1e-6, hi.t - lo.t);
    ramp[a * 4] = lo.c[0] + (hi.c[0] - lo.c[0]) * f;
    ramp[a * 4 + 1] = lo.c[1] + (hi.c[1] - lo.c[1]) * f;
    ramp[a * 4 + 2] = lo.c[2] + (hi.c[2] - lo.c[2]) * f;
    ramp[a * 4 + 3] = Math.min(190, a * 1.7);
  }
  heatRamp = ramp;
  return ramp;
}

export function StrikeDensityLayer({
  strikes,
  bounds,
  width,
  height,
}: {
  strikes: CountryStrike[];
  bounds: Bounds;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), DENSITY_REDRAW_MS);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    if (!strikes.length) return;

    const radius = Math.max(16, Math.min(w, h) * 0.055);
    const now = Date.now();
    for (const strike of strikes) {
      const receivedAt = Date.parse(strike.received_at);
      const age = Number.isFinite(receivedAt) ? now - receivedAt : Infinity;
      if (age >= DENSITY_WINDOW_MS) continue;
      const p = projectEqui(bounds, w, h, strike.lat, strike.lon);
      if (p.x < -radius || p.x > w + radius || p.y < -radius || p.y > h + radius) continue;
      const weight = 0.12 + 0.28 * Math.max(0, 1 - age / DENSITY_WINDOW_MS);
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${weight})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const image = ctx.getImageData(0, 0, w, h);
    const data = image.data;
    const ramp = getHeatRamp();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (!a) continue;
      const idx = a * 4;
      data[i] = ramp[idx];
      data[i + 1] = ramp[idx + 1];
      data[i + 2] = ramp[idx + 2];
      data[i + 3] = ramp[idx + 3];
    }
    ctx.putImageData(image, 0, 0);
  }, [strikes, bounds, width, height, nowTick]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      style={{ opacity: 0.5, mixBlendMode: 'screen' }}
      aria-hidden
    />
  );
}
