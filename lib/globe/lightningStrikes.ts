// lib/globe/lightningStrikes.ts
import * as Cesium from 'cesium';
import { useGameStore } from '@/store/gameStore';
import type { LightningStrike } from '@/types';

// ──────────────────────────────────────────────────────────────────────────
//  APPEARANCE — change strikes here.
//  STRIKE_COLOR is the single main knob (bolt + glow + flash ring).
// ──────────────────────────────────────────────────────────────────────────
const STRIKE_COLOR = Cesium.Color.fromCssColorString('#7dd3fc'); // bolt / glow color
const CORE_COLOR = Cesium.Color.fromCssColorString('#eaf4ff'); // hot center of the ground flash

const STRIKE_TOP_M = 160_000;  // beam starts this high — kept inside the visible atmosphere
const STRIKE_WIDTH = 6;        // max beam thickness (px)
const BASE_POINT_SIZE = 16;    // max size of the dot where it hits the globe
const STRIKE_GLOW = 0.55;      // PolylineGlow glowPower (higher = softer / glowier)
const STRIKE_FADE_MS = 2000;   // fade-out duration (ms)
const LATERAL_JITTER_DEG = 0.6; // zig-zag of the bolt as it descends

const POOL = 256; // the store caps strikes at 200

export interface LightningStrikesOptions {
  /** Where strikes come from. Defaults to the global game store. */
  getStrikes?: () => LightningStrike[];
  pool?: number;
  fadeMs?: number;
}

/**
 * Renders live lightning strikes as glowing bolts that descend from the
 * atmosphere to the globe, plus a bright flash where they land. Reusable on any
 * Cesium scene. Returns dispose() which removes the primitives + render listener.
 */
export function attachLightningStrikes(
  scene: Cesium.Scene,
  options: LightningStrikesOptions = {}
): () => void {
  const pool = options.pool ?? POOL;
  const fade = options.fadeMs ?? STRIKE_FADE_MS;
  const getStrikes = options.getStrikes ?? (() => useGameStore.getState().strikes);

  const flashes = scene.primitives.add(new Cesium.PointPrimitiveCollection());
  const bolts = scene.primitives.add(new Cesium.PolylineCollection());
  const flashPool: Cesium.PointPrimitive[] = [];
  const boltPool: Cesium.Polyline[] = [];
  const slotIds: (string | null)[] = new Array(pool).fill(null);

  for (let i = 0; i < pool; i++) {
    flashPool.push(
      flashes.add({
        position: Cesium.Cartesian3.ZERO,
        pixelSize: 1,
        color: Cesium.Color.TRANSPARENT,
        show: false,
      })
    );
    boltPool.push(
      bolts.add({
        positions: [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.UNIT_Z],
        width: STRIKE_WIDTH,
        material: Cesium.Material.fromType('PolylineGlow', {
          color: STRIKE_COLOR.withAlpha(0),
          glowPower: STRIKE_GLOW,
          taperPower: 1.0,
        }),
        show: false,
      })
    );
  }

  // Jagged path from high in the atmosphere down to the surface point.
  const boltPositions = (lon: number, lat: number) => {
    const j = () => (Math.random() - 0.5) * LATERAL_JITTER_DEG;
    return [
      Cesium.Cartesian3.fromDegrees(lon + j(), lat + j(), STRIKE_TOP_M),
      Cesium.Cartesian3.fromDegrees(lon + j(), lat + j(), STRIKE_TOP_M * 0.62),
      Cesium.Cartesian3.fromDegrees(lon + j() * 0.5, lat + j() * 0.5, STRIKE_TOP_M * 0.3),
      Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    ];
  };

  const update = () => {
    const strikes = getStrikes();
    const now = Date.now();
    for (let i = 0; i < pool; i++) {
      const s = strikes[i];
      const flash = flashPool[i];
      const bolt = boltPool[i];
      const age = s ? now - s.receivedAt : Infinity;

      if (!s || age < 0 || age >= fade) {
        if (flash.show) flash.show = false;
        if (bolt.show) bolt.show = false;
        slotIds[i] = null;
        continue;
      }

      if (slotIds[i] !== s.id) {
        flash.position = Cesium.Cartesian3.fromDegrees(s.lon, s.lat);
        bolt.positions = boltPositions(s.lon, s.lat);
        slotIds[i] = s.id;
      }

      const life = 1 - age / fade;                       // 1 → 0 over the fade
      const flicker = age < 220 ? 0.5 + 0.5 * Math.random() : 1;

      // bolt: glowing beam, brightest/thickest at birth
      bolt.show = true;
      bolt.width = STRIKE_WIDTH * (0.35 + 0.65 * life);
      (bolt.material.uniforms as { color: Cesium.Color }).color =
        STRIKE_COLOR.withAlpha(life * flicker);

      // flash: hot dot at the ground with a colored ring
      flash.show = true;
      flash.pixelSize = BASE_POINT_SIZE * (0.4 + 0.6 * life);
      flash.color = CORE_COLOR.withAlpha((0.1 * life + 0.9 * life * life) * flicker);
      flash.outlineColor = STRIKE_COLOR.withAlpha(0.35 * life);
      flash.outlineWidth = 3 * life;
    }
  };

  scene.preRender.addEventListener(update);

  return () => {
    if (scene.isDestroyed()) return;
    scene.preRender.removeEventListener(update);
    scene.primitives.remove(bolts); // remove() also destroys the collection
    scene.primitives.remove(flashes);
  };
}
