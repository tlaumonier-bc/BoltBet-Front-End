'use client';
// components/map/LightningMap2D.tsx
// The fast, mobile-first map for SEO pages and the view-only /live page.
// Deliberately NOT the 3D globe: one image + a canvas overlay keeps LCP low and
// matches "radar near me" search intent. Consumes the same store + socket the
// globe uses, so no new data path. Heavy 3D stays on /play and /live (globe).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useLightningSocket } from '@/lib/socket';
import type { Bounds } from '@/lib/map/countryBounds';

// Equirectangular (2:1) world image — self-hosted in /public (Phase 5).
// See PHASE5_NOTES.md for the one-time download command.
const EARTH_URL = '/earth-night.jpg';
const STRIKE_FADE_MS = 8000; // a strike dot lingers ~8s on the 2D map
const COUNTER_WINDOW_MS = 60 * 60 * 1000; // "last 60 min"
const API_BASE = process.env.NEXT_PUBLIC_API_URL; // optional accurate counter

interface View {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

function pad(b: Bounds, factor = 0.15): View {
  const lonPad = (b.maxLon - b.minLon) * factor;
  const latPad = (b.maxLat - b.minLat) * factor;
  return {
    minLon: b.minLon - lonPad,
    minLat: b.minLat - latPad,
    maxLon: b.maxLon + lonPad,
    maxLat: b.maxLat + latPad,
  };
}

export default function LightningMap2D({
  bounds,
  className,
}: {
  bounds: Bounds;
  className?: string;
}) {
  useLightningSocket(); // open the live feed for this page
  const strikes = useGameStore((s) => s.strikes);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [view, setView] = useState<View>(() => pad(bounds));
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'denied'>('idle');
  const [storeCount, setStoreCount] = useState(0);
  const [apiCount, setApiCount] = useState<number | null>(null);
  const count60 = apiCount ?? storeCount; // prefer the accurate backend count

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Preload the base map image.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
    };
    img.src = EARTH_URL;
  }, []);

  // "Show near me" — recenter on the user with a ~6° span.
  function locateMe() {
    if (!navigator.geolocation) return setGeoState('denied');
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const span = 6;
        setView({
          minLon: coords.longitude - span,
          minLat: coords.latitude - span / 2,
          maxLon: coords.longitude + span,
          maxLat: coords.latitude + span / 2,
        });
        setGeoState('idle');
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function resetView() {
    setView(pad(bounds));
  }

  // 60-minute strike counter within the current view (ticks each second).
  // This is the fallback: counts strikes received since page load.
  useEffect(() => {
    const tick = () => {
      const since = Date.now() - COUNTER_WINDOW_MS;
      const n = strikes.filter(
        (s) =>
          s.timestamp >= since &&
          s.lon >= view.minLon &&
          s.lon <= view.maxLon &&
          s.lat >= view.minLat &&
          s.lat <= view.maxLat
      ).length;
      setStoreCount(n);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [strikes, view]);

  // Accurate counter from the backend, if NEXT_PUBLIC_API_URL is set. Polls the
  // current view bounds; on any failure we silently keep the store fallback.
  useEffect(() => {
    if (!API_BASE) return;
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const q = new URLSearchParams({
          min_lat: String(view.minLat),
          max_lat: String(view.maxLat),
          min_lon: String(view.minLon),
          max_lon: String(view.maxLon),
          minutes: '60',
        });
        const res = await fetch(`${API_BASE}/api/strikes/count/?${q}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data?.count === 'number') setApiCount(data.count);
      } catch {
        /* keep store fallback */
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [view]);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const project = (lon: number, lat: number, w: number, h: number) => {
      const x = ((lon - view.minLon) / (view.maxLon - view.minLon)) * w;
      const y = ((view.maxLat - lat) / (view.maxLat - view.minLat)) * h;
      return [x, y] as const;
    };

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Base map: crop the equirectangular image to the view bounds.
      const img = imgRef.current;
      if (img) {
        const IW = img.naturalWidth;
        const IH = img.naturalHeight;
        const sx = ((view.minLon + 180) / 360) * IW;
        const sw = ((view.maxLon - view.minLon) / 360) * IW;
        const sy = ((90 - view.maxLat) / 180) * IH;
        const sh = ((view.maxLat - view.minLat) / 180) * IH;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        ctx.fillStyle = 'rgba(4,6,13,0.35)'; // darken for contrast with strikes
        ctx.fillRect(0, 0, w, h);
      } else {
        // Fallback until /earth-night.jpg is present: dark gradient + graticule.
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0a1326');
        g.addColorStop(1, '#04060d');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(56,189,248,0.08)';
        for (let x = 0; x < w; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }

      // Strikes: glowing dots fading over STRIKE_FADE_MS.
      const now = Date.now();
      for (const s of strikes) {
        const age = now - s.receivedAt;
        if (age > STRIKE_FADE_MS) continue;
        if (s.lon < view.minLon || s.lon > view.maxLon || s.lat < view.minLat || s.lat > view.maxLat)
          continue;
        const [x, y] = project(s.lon, s.lat, w, h);
        const life = 1 - age / STRIKE_FADE_MS;
        const pulse = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(now / 120);
        const r = (2 + 6 * life) * pulse;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(253,224,71,${0.15 * life})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, r * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(234,244,255,${0.9 * life})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [view, strikes, imgReady, reducedMotion]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-storm ${className ?? ''}`}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={`Live lightning map centred on ${bounds.label}`}
      />

      {/* live strike counter */}
      <div className="glass pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-2 text-xs">
        <span className="live-dot mr-2 inline-block h-2 w-2 rounded-full bg-bolt align-middle" />
        <span className="font-semibold text-bolt">{count60}</span>
        <span className="ml-1 text-white/60">strikes · last 60 min</span>
      </div>

      {/* controls */}
      <div className="absolute right-3 top-3 flex gap-2">
        <button
          onClick={locateMe}
          className="glass rounded-lg px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10"
        >
          {geoState === 'locating' ? 'Locating…' : 'Show near me'}
        </button>
        <button
          onClick={resetView}
          className="glass rounded-lg px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10"
        >
          Reset
        </button>
      </div>

      {geoState === 'denied' && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-2 text-xs text-white/70">
          Location unavailable — showing {bounds.label}.
        </div>
      )}

      {!imgReady && (
        <div className="absolute inset-0 flex items-center justify-center text-xs tracking-widest text-white/40">
          LOADING MAP…
        </div>
      )}
    </div>
  );
}
