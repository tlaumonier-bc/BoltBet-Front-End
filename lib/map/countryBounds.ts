// lib/map/countryBounds.ts — rough per-locale bounding boxes (degrees).
// Used to centre each localized map on its own country ("local intent").
// Approximate on purpose: good enough to frame the view, not a geofence.

export interface Bounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  label: string;
}

export const COUNTRY_BOUNDS: Record<string, Bounds> = {
  fi: { minLon: 19, minLat: 59, maxLon: 32, maxLat: 70, label: 'Finland' },
  gb: { minLon: -8, minLat: 49.5, maxLon: 2, maxLat: 59, label: 'United Kingdom' },
  pl: { minLon: 14, minLat: 49, maxLon: 24, maxLat: 55, label: 'Poland' },
  fr: { minLon: -5, minLat: 41, maxLon: 9, maxLat: 51, label: 'France' },
  ee: { minLon: 21, minLat: 57.5, maxLon: 28, maxLat: 59.7, label: 'Estonia' },
  se: { minLon: 11, minLat: 55, maxLon: 24, maxLat: 69, label: 'Sweden' },
  us: { minLon: -125, minLat: 24, maxLon: -66, maxLat: 50, label: 'United States' },
  no: { minLon: 4, minLat: 57, maxLon: 31, maxLat: 71, label: 'Norway' },
  de: { minLon: 5, minLat: 47, maxLon: 15, maxLat: 55, label: 'Germany' },
  nl: { minLon: 3, minLat: 50.5, maxLon: 7.5, maxLat: 54, label: 'Netherlands' },
  cz: { minLon: 12, minLat: 48.5, maxLon: 19, maxLat: 51, label: 'Czechia' },
  lv: { minLon: 20, minLat: 55.5, maxLon: 28, maxLat: 58.2, label: 'Latvia' },
  hr: { minLon: 13, minLat: 42, maxLon: 19.5, maxLat: 46.6, label: 'Croatia' },
  ca: { minLon: -141, minLat: 42, maxLon: -52, maxLat: 70, label: 'Canada' },
  at: { minLon: 9, minLat: 46, maxLon: 17.5, maxLat: 49, label: 'Austria' },
  gr: { minLon: 19, minLat: 34.5, maxLon: 28.5, maxLat: 42, label: 'Greece' },
  it: { minLon: 6.5, minLat: 36.5, maxLon: 18.6, maxLat: 47.1, label: 'Italy' },
  dk: { minLon: 8, minLat: 54.5, maxLon: 13, maxLat: 58, label: 'Denmark' },
  lt: { minLon: 20.9, minLat: 53.9, maxLon: 26.9, maxLat: 56.5, label: 'Lithuania' },
  sk: { minLon: 16.8, minLat: 47.7, maxLon: 22.6, maxLat: 49.6, label: 'Slovakia' },
  es: { minLon: -9.5, minLat: 36, maxLon: 3.4, maxLat: 43.8, label: 'Spain' },
  rs: { minLon: 18.8, minLat: 42.2, maxLon: 23, maxLat: 46.2, label: 'Serbia' },
  ro: { minLon: 20.2, minLat: 43.6, maxLon: 29.7, maxLat: 48.3, label: 'Romania' },
};

/** World fallback for the global landing / view-only map. */
export const WORLD_BOUNDS: Bounds = {
  minLon: -180, minLat: -60, maxLon: 180, maxLat: 80, label: 'World',
};

export const boundsForLocale = (locale: string): Bounds =>
  COUNTRY_BOUNDS[locale] ?? WORLD_BOUNDS;
