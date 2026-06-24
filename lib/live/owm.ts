// lib/live/owm.ts — weather now via OUR backend (key stays server-side).

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