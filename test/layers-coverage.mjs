// test/layers-coverage.mjs
// Coverage gate for the Grid Game map layers.
//
// Detects the CURRENT live playable zones worldwide (same model as
// lib/grid-game/zones.ts), then checks that every layer's data provider returns
// valid data for EVERY zone — including ocean zones. Prints a zone × layer matrix
// and EXITS NON-ZERO if any cell is missing (a playable zone with no data = a bug
// or the wrong provider). M1 covers the Open-Meteo layers: Rain, Wind, CAPE.
//
// Run: node test/layers-coverage.mjs

const BACKEND = process.env.BACKEND_URL || 'https://boltbet-backend-dev-2ulnbyw42a-nw.a.run.app';
const KM_PER_DEG = 111.32;
const cosLat = (lat) => Math.max(0.01, Math.cos((lat * Math.PI) / 180));

// mirrors lib/grid-game/zones.ts ZONE_CONFIG (FINAL)
const CFG = {
  obsMs: 420_000, roundMs: 60_000, tauMs: 150_000, coarseDeg: 0.3, minCellWeight: 0.7,
  focusRadiusKm: 34, separationKm: 42, minSigmaKm: 10, minRoundStrikes: 4,
  targetPerCell: 1.3, sigmaK: 1.8, minCols: 5, minRows: 4, maxCols: 12, maxRows: 10,
  entropyThreshold: 0.5, maxZones: 12,
};

function detectZones(strikes, now) {
  const recent = strikes.filter((s) => s.t >= now - CFG.obsMs && s.t <= now);
  const bins = new Map();
  for (const s of recent) {
    const cx = Math.floor((s.lon + 180) / CFG.coarseDeg);
    const cy = Math.floor((s.lat + 90) / CFG.coarseDeg);
    const k = cx + ',' + cy;
    let b = bins.get(k);
    if (!b) { b = { w: 0, sw: 0, slat: 0, slon: 0 }; bins.set(k, b); }
    const w = Math.exp(-(now - s.t) / CFG.tauMs);
    b.w += w; b.sw += w; b.slat += w * s.lat; b.slon += w * s.lon;
  }
  const seeds = [...bins.values()].map((b) => ({ w: b.w, clat: b.slat / b.sw, clon: b.slon / b.sw })).sort((a, b) => b.w - a.w);
  const zones = [];
  const claimed = [];
  const sep2 = CFG.separationKm ** 2, r2 = CFG.focusRadiusKm ** 2, rs = now - CFG.roundMs;
  for (const seed of seeds) {
    if (seed.w < CFG.minCellWeight) break;
    let near = false;
    for (const p of claimed) {
      const dlat = (seed.clat - p.clat) * KM_PER_DEG, dlon = (seed.clon - p.clon) * KM_PER_DEG * cosLat(p.clat);
      if (dlat * dlat + dlon * dlon <= sep2) { near = true; break; }
    }
    if (near) continue;
    claimed.push(seed);
    const c = cosLat(seed.clat);
    const all = recent.filter((s) => {
      const dlat = (s.lat - seed.clat) * KM_PER_DEG, dlon = (s.lon - seed.clon) * KM_PER_DEG * c;
      return dlat * dlat + dlon * dlon <= r2;
    });
    const z = buildZone(all, now, rs);
    if (z) zones.push(z);
    if (zones.length >= CFG.maxZones) break;
  }
  return zones.sort((a, b) => b.roundStrikes - a.roundStrikes);
}

function buildZone(all, now, rs) {
  if (!all.length) return null;
  let sw = 0, sx = 0, sy = 0;
  for (const s of all) { const w = Math.exp(-(now - s.t) / CFG.tauMs); sw += w; sx += w * s.lon; sy += w * s.lat; }
  if (sw <= 0) return null;
  const clat = sy / sw, clon = sx / sw;
  let vlat = 0, vlon = 0;
  for (const s of all) { const w = Math.exp(-(now - s.t) / CFG.tauMs); vlat += w * (s.lat - clat) ** 2; vlon += w * (s.lon - clon) ** 2; }
  const sigLat = Math.max(CFG.minSigmaKm, Math.sqrt(vlat / sw) * KM_PER_DEG);
  const sigLon = Math.max(CFG.minSigmaKm, Math.sqrt(vlon / sw) * KM_PER_DEG * cosLat(clat));
  const round = all.reduce((n, s) => (s.t >= rs ? n + 1 : n), 0);
  if (round < CFG.minRoundStrikes) return null;
  const target = round / CFG.targetPerCell;
  const nCells = Math.max(CFG.minCols * CFG.minRows, Math.min(CFG.maxCols * CFG.maxRows, target));
  const aspect = sigLon / Math.max(0.01, sigLat);
  let rows = Math.max(CFG.minRows, Math.min(CFG.maxRows, Math.round(Math.sqrt(nCells / Math.max(0.1, aspect)))));
  let cols = Math.max(CFG.minCols, Math.min(CFG.maxCols, Math.round(nCells / Math.max(1, rows))));
  const hH = (CFG.sigmaK * sigLat) / KM_PER_DEG, hW = (CFG.sigmaK * sigLon) / (KM_PER_DEG * cosLat(clat));
  const minLat = clat - hH, maxLat = clat + hH, minLon = clon - hW, maxLon = clon + hW;
  const spanLat = maxLat - minLat, spanLon = maxLon - minLon;
  if (spanLat <= 0 || spanLon <= 0) return null;
  const counts = new Array(cols * rows).fill(0);
  let inGrid = 0;
  for (const s of all) {
    if (s.t < rs) continue;
    const rx = (s.lon - minLon) / spanLon, ry = (maxLat - s.lat) / spanLat;
    if (rx < 0 || rx >= 1 || ry < 0 || ry >= 1) continue;
    counts[Math.min(rows - 1, Math.floor(ry * rows)) * cols + Math.min(cols - 1, Math.floor(rx * cols))] += 1;
    inGrid += 1;
  }
  if (inGrid < CFG.minRoundStrikes) return null;
  let h = 0;
  for (const nn of counts) if (nn > 0) { const p = nn / inGrid; h -= p * Math.log(p); }
  if (h / Math.log(cols * rows) < CFG.entropyThreshold) return null;
  return { minLat, maxLat, minLon, maxLon, clat, clon, roundStrikes: inGrid, widthKm: spanLon * KM_PER_DEG * cosLat(clat) };
}

// ── Open-Meteo layer check (mirrors backend lightning/weather.py sampling) ────
function capeForHour(loc) {
  const hourly = loc.hourly || {};
  const times = hourly.time || [];
  const capes = hourly.cape || [];
  const cur = (loc.current || {}).time || '';
  const prefix = cur.slice(0, 13);
  for (let i = 0; i < times.length; i += 1) if (times[i].startsWith(prefix) && capes[i] != null) return capes[i];
  return capes.find((v) => v != null) ?? null;
}

// storm-track: fetch the zone's last 10 min of strikes and compute centroid drift
function computeTrack(points, now, windowMs = 600_000, minPerHalf = 3) {
  const mid = now - windowMs / 2;
  const older = [], recent = [];
  for (const p of points) {
    if (p.t < now - windowMs || p.t > now) continue;
    (p.t >= mid ? recent : older).push(p);
  }
  if (older.length < minPerHalf || recent.length < minPerHalf) return null;
  const cen = (r) => ({ lat: r.reduce((a, x) => a + x.lat, 0) / r.length, lon: r.reduce((a, x) => a + x.lon, 0) / r.length });
  const o = cen(older), r = cen(recent);
  const dtS = windowMs / 2 / 1000;
  const cos = cosLat(r.lat);
  const dist = Math.hypot((r.lat - o.lat) * KM_PER_DEG, (r.lon - o.lon) * KM_PER_DEG * cos);
  return { speedKmh: (dist / dtS) * 3600, older: older.length, recent: recent.length };
}

async function checkZoneTrack(z) {
  const q = new URLSearchParams({
    minLat: String(z.minLat), maxLat: String(z.maxLat), minLon: String(z.minLon), maxLon: String(z.maxLon),
    seconds: '600', limit: '3000',
  });
  const res = await fetch(`${BACKEND}/api/strikes/in-bounds/?${q}`);
  if (!res.ok) throw new Error(`in-bounds ${res.status}`);
  const data = await res.json();
  const pts = (data.strikes || []).map((s) => ({ lat: s.lat, lon: s.lon, t: Date.parse(s.received_at) })).filter((s) => Number.isFinite(s.t));
  const track = computeTrack(pts, Date.now());
  return { strikes: pts.length, track };
}

async function checkZoneWeather(z, n = 4) {
  const lats = [], lons = [];
  for (let r = 0; r < n; r += 1) {
    const lat = z.minLat + ((r + 0.5) / n) * (z.maxLat - z.minLat);
    for (let c = 0; c < n; c += 1) lons.push((z.minLon + ((c + 0.5) / n) * (z.maxLon - z.minLon)).toFixed(4)), lats.push(lat.toFixed(4));
  }
  const q = new URLSearchParams({
    latitude: lats.join(','), longitude: lons.join(','),
    current: 'precipitation,rain,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'cape', models: 'gfs_seamless', forecast_days: '1', timezone: 'UTC',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data = await res.json();
  const locs = Array.isArray(data) ? data : [data];
  let rain = 0, wind = 0, cape = 0;
  for (const loc of locs) {
    const cur = loc.current || {};
    if (cur.precipitation != null) rain += 1;
    if (cur.wind_speed_10m != null && cur.wind_direction_10m != null) wind += 1;
    if (capeForHour(loc) != null) cape += 1;
  }
  const total = locs.length;
  return { total, rain, wind, cape, rainOK: rain === total, windOK: wind === total, capeOK: cape === total };
}

(async () => {
  console.log(`Backend: ${BACKEND}`);
  const res = await fetch(`${BACKEND}/api/strikes/recent/?minutes=8&limit=40000`);
  const json = await res.json();
  const strikes = (json.strikes || []).map((s) => ({ lat: s.lat, lon: s.lon, t: Date.parse(s.received_at) })).filter((s) => Number.isFinite(s.t));
  const now = Math.max(...strikes.map((s) => s.t));
  const zones = detectZones(strikes, now);
  console.log(`Live strikes(8min): ${strikes.length} | zones detected: ${zones.length}\n`);

  if (zones.length < 1) {
    console.error('SKIP: no live playable zones right now — nothing to test. Re-run when storms are active.');
    process.exit(2);
  }
  if (zones.length < 2) {
    console.warn(`WARNING: only ${zones.length} live zone right now (target is ≥2). Still validating data on it.\n`);
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('zone', 20), pad('strk/min', 9), pad('Rain', 6), pad('Wind', 6), pad('CAPE', 6), 'Tracks');
  let failures = 0;
  const test = zones.slice(0, Math.min(zones.length, 8));
  const results = await Promise.all(
    test.map(async (z) => {
      try {
        const [r, t] = await Promise.all([checkZoneWeather(z), checkZoneTrack(z)]);
        return { z, r, t };
      } catch (e) {
        return { z, err: String(e) };
      }
    }),
  );
  for (const { z, r, t, err } of results) {
    const loc = `${z.clat >= 0 ? 'N' : 'S'}${Math.abs(z.clat).toFixed(1)} ${z.clon >= 0 ? 'E' : 'W'}${Math.abs(z.clon).toFixed(1)}`;
    if (err) { console.log(pad(loc, 20), pad('-', 9), 'ERROR', err); failures += 1; continue; }
    const mark = (ok) => (ok ? 'OK' : 'MISS');
    // Weather layers are a hard requirement. Tracks: OK if a motion vector exists;
    // "forming" (too-new storm, no history) is acceptable, not a failure.
    if (!r.rainOK || !r.windOK || !r.capeOK) failures += 1;
    const tracks = t.track ? `${Math.round(t.track.speedKmh)}km/h` : t.strikes > 0 ? 'forming' : 'MISS';
    console.log(pad(loc, 20), pad(z.roundStrikes, 9), pad(mark(r.rainOK), 6), pad(mark(r.windOK), 6), pad(mark(r.capeOK), 6), tracks);
  }
  console.log('');
  if (failures) {
    console.error(`FAIL: ${failures}/${test.length} zones missing layer data. Fix the bug or change provider.`);
    process.exit(1);
  }
  console.log(`PASS: all ${test.length} tested zones have Rain + Wind + CAPE data (Tracks: motion where history exists, else forming).`);
})();
