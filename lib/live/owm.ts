// lib/live/owm.ts — weather now via OUR backend (key stays server-side).
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface OwmNow {
  tempC: number;
  clouds: number;
  windKph: number;
  humidity: number;
  main: string;
  icon: string;
  country: string | null;
}

export async function fetchOwmNow(lat: number, lon: number): Promise<OwmNow | null> {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const res = await fetch(`${API}/api/weather/now/?${q}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

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

export function flagEmoji(iso2: string | null): string {
  if (!iso2 || !/^[A-Za-z]{2}$/.test(iso2)) return '🏳️';
  const A = 0x1f1e6;
  const cc = iso2.toUpperCase();
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

export function countryName(iso2: string | null): string {
  if (!iso2) return '—';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso2.toUpperCase()) ?? iso2;
  } catch {
    return iso2;
  }
}