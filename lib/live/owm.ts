// lib/live/owm.ts
// Minimal OpenWeatherMap "current weather" client (free tier, same key as the
// globe tiles) + helpers to turn a condition into an emoji and an ISO-2 code
// into a flag + country name. Works from the browser (OWM allows CORS).

const KEY = process.env.NEXT_PUBLIC_OWM_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5/weather';

export interface OwmNow {
  tempC: number;
  clouds: number;   // %
  windKph: number;
  humidity: number; // %
  main: string;     // "Clouds", "Rain", "Thunderstorm", …
  icon: string;     // OWM icon code, e.g. "10d"
  country: string | null; // ISO-2
}

export async function fetchOwmNow(lat: number, lon: number): Promise<OwmNow | null> {
  if (!KEY) return null;
  const q = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units: 'metric',
    appid: KEY,
  });
  const res = await fetch(`${BASE}?${q}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const d = await res.json();
  return {
    tempC: Math.round(d.main?.temp ?? 0),
    clouds: Math.round(d.clouds?.all ?? 0),
    windKph: Math.round((d.wind?.speed ?? 0) * 3.6),
    humidity: Math.round(d.main?.humidity ?? 0),
    main: d.weather?.[0]?.main ?? '—',
    icon: d.weather?.[0]?.icon ?? '',
    country: d.sys?.country ?? null,
  };
}

/** Emoji for an OWM condition (night-aware for clear sky). */
export function weatherEmoji(main: string, icon = ''): string {
  const night = icon.endsWith('n');
  switch (main) {
    case 'Thunderstorm': return '⛈️';
    case 'Drizzle':
    case 'Rain': return '🌧️';
    case 'Snow': return '❄️';
    case 'Clouds': return '☁️';
    case 'Clear': return night ? '🌙' : '☀️';
    case 'Mist':
    case 'Fog':
    case 'Haze':
    case 'Smoke': return '🌫️';
    default: return night ? '🌙' : '⛅';
  }
}

/** ISO-2 (e.g. "FR") → flag emoji. */
export function flagEmoji(iso2: string | null): string {
  if (!iso2 || !/^[A-Za-z]{2}$/.test(iso2)) return '🏳️';
  const A = 0x1f1e6;
  const cc = iso2.toUpperCase();
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

/** ISO-2 → readable country name, via the browser's built-in Intl. */
export function countryName(iso2: string | null): string {
  if (!iso2) return '—';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso2.toUpperCase()) ?? iso2;
  } catch {
    return iso2;
  }
}