import * as Cesium from 'cesium';
import { useGameStore } from '@/store/gameStore';
import type { LightningStrike } from '@/types';

const STRIKE_FADE_MS = 2000;
const POOL = 256; // the store caps strikes at 200
const BOLT_TOP_M = 220_000;

const STRIKE_COLOR = Cesium.Color.fromCssColorString('#eaf4ff');
const GLOW_COLOR = Cesium.Color.fromCssColorString('#bfe3ff');

export interface LightningStrikesOptions {
  /** Where strikes come from. Defaults to the global game store. */
  getStrikes?: () => LightningStrike[];
  pool?: number;
  fadeMs?: number;
}

/**
 * Renders the live lightning strikes (glowing jagged bolt + white flash) onto a
 * Cesium scene. Reusable on any Cesium globe across the site.
 * Returns a dispose() that removes the primitives and the render-loop listener.
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
        width: 2.5,
        material: Cesium.Material.fromType('PolylineGlow', {
          color: GLOW_COLOR.withAlpha(0),
          glowPower: 0.3,
          taperPower: 1.0,
        }),
        show: false,
      })
    );
  }

  const boltPositions = (lon: number, lat: number) => {
    const j = () => (Math.random() - 0.5) * 0.5;
    return [
      Cesium.Cartesian3.fromDegrees(lon + j(), lat + j(), BOLT_TOP_M),
      Cesium.Cartesian3.fromDegrees(lon + j(), lat + j(), BOLT_TOP_M * 0.6),
      Cesium.Cartesian3.fromDegrees(lon + j() * 0.5, lat + j() * 0.5, BOLT_TOP_M * 0.3),
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

      const life = 1 - age / fade;
      const flicker = age < 220 ? 0.5 + 0.5 * Math.random() : 1;

      bolt.show = true;
      bolt.width = 1.5 + 3 * life;
      (bolt.material.uniforms as { color: Cesium.Color }).color =
        GLOW_COLOR.withAlpha(life * flicker);

      flash.show = true;
      flash.pixelSize = 5 + 9 * life;
      flash.color = STRIKE_COLOR.withAlpha((0.1 * life + 0.9 * life * life) * flicker);
      flash.outlineColor = GLOW_COLOR.withAlpha(0.35 * life);
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