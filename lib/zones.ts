// lib/zones.ts — the game zone grid. This MUST mirror the backend lightning/grid.py
// (same ZONE_SIZE_DEG, same id scheme, same boxes) or picks won't score.
// Default 10° over the full globe = (360/10) * (180/10) = 36 * 18 = 648 zones.
// Kept separate from the legacy lib/grid.ts so existing components don't break.

export const ZONE_SIZE_DEG = Number(process.env.NEXT_PUBLIC_ZONE_SIZE_DEG ?? 10);

const COLS = Math.round(360 / ZONE_SIZE_DEG);
const ROWS = Math.round(180 / ZONE_SIZE_DEG);
export const N_ZONES = COLS * ROWS;

function normLon(lon: number): number {
  // -> [-180, 180), correct for negative inputs
  return (((lon + 180) % 360) + 360) % 360 - 180;
}

function clampLat(lat: number): number {
  return Math.max(-90, Math.min(89.999999, lat));
}

export interface ZoneBox {
  id: string;
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

export function zoneFor(lat: number, lon: number): string {
  const la = clampLat(lat);
  const lo = normLon(lon);
  const col = Math.min(COLS - 1, Math.floor((lo + 180) / ZONE_SIZE_DEG));
  const row = Math.min(ROWS - 1, Math.floor((la + 90) / ZONE_SIZE_DEG));
  return `z_${col}_${row}`;
}

export function zoneBounds(id: string): ZoneBox {
  const [, c, r] = id.split('_');
  const col = parseInt(c, 10);
  const row = parseInt(r, 10);
  const lonMin = -180 + col * ZONE_SIZE_DEG;
  const latMin = -90 + row * ZONE_SIZE_DEG;
  return { id, lonMin, lonMax: lonMin + ZONE_SIZE_DEG, latMin, latMax: latMin + ZONE_SIZE_DEG };
}

export function zoneCenter(id: string): { lat: number; lon: number } {
  const b = zoneBounds(id);
  return { lat: (b.latMin + b.latMax) / 2, lon: (b.lonMin + b.lonMax) / 2 };
}

export function allZones(): ZoneBox[] {
  const out: ZoneBox[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      out.push(zoneBounds(`z_${col}_${row}`));
    }
  }
  return out;
}

// Re-exported so lib/game/multiplier.ts can reference a helper symbol without
// pulling Cesium. No behaviour change.
export const zoneSolidAngleHelper = null;