'use client';
// components/HUD/OrbHUD.tsx
// Control-room "Strike Terminal" overlay (ported from the orb reference) that
// sits over the live map. Pure chrome + live readouts wired to the game store —
// no new services, safe to ship. Placing a position still uses the existing
// click-a-zone → BetModal flow, so this adds no betting logic of its own.

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { cellCenter, regionName, parseCellId } from '@/lib/grid';

// The HUD drives whatever view is active (orb globe or maplibre map) through
// this small API, so it works the same in both.
export interface ViewApi {
  zoomIn: () => void;
  zoomOut: () => void;
  jump: (lat: number, lon: number) => void;
}

const COUNTER_WINDOW_MS = 60 * 60 * 1000;
const REGIONS: [string, number, number][] = [
  ['EUR', 50, 10],
  ['AFR', 2, 20],
  ['ASIA', 30, 100],
  ['N.AM', 40, -100],
  ['S.AM', -15, -60],
  ['OCE', -25, 135],
];

let cssInjected = false;
function injectHudCss() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const el = document.createElement('style');
  el.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
.orb-hud{--ink:#cdd9e6;--ink-dim:#5d7388;--amber:#ffb000;--cyan:#1fd3ff;--plasma:#b98cff;
  --green:#19f0a0;--red:#ff3b5c;--panel:rgba(10,16,24,.72);--edge:rgba(31,211,255,.14);
  --mono:'IBM Plex Mono',monospace;--display:'Syncopate',sans-serif;--term:'Space Mono',monospace;
  position:fixed;inset:0;z-index:20;pointer-events:none;color:var(--ink);font-family:var(--mono)}
.orb-hud>*{pointer-events:auto}
.orb-topbar{position:absolute;top:0;left:0;right:0;height:50px;display:flex;align-items:center;
  gap:24px;padding:0 20px;background:linear-gradient(180deg,rgba(4,6,10,.7),transparent)}
.orb-brand{font-family:var(--display);font-weight:700;letter-spacing:3px;font-size:13px;color:var(--ink)}
.orb-brand b{color:var(--amber)}
.orb-brand .sub{display:block;font-family:var(--mono);font-size:7.5px;letter-spacing:2px;color:var(--ink-dim);margin-top:2px}
.orb-nav{display:flex;gap:2px;margin-left:auto}
.orb-nav a{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-dim);
  text-decoration:none;padding:7px 11px;border-radius:8px;transition:.15s}
.orb-nav a:hover{color:var(--ink);background:rgba(255,255,255,.04)}
.orb-nav a.active{color:var(--amber)}
.orb-panel{position:absolute;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  background:var(--panel);border:1px solid var(--edge);border-radius:14px;padding:15px}
.orb-left{top:62px;left:16px;width:228px}
.orb-right{top:62px;right:16px;width:236px}
.orb-sect{margin-bottom:15px}.orb-sect:last-child{margin-bottom:0}
.orb-h{font-size:8px;letter-spacing:2.5px;color:var(--amber);text-transform:uppercase;
  margin-bottom:9px;display:flex;justify-content:space-between}
.orb-h .id{color:var(--ink-dim)}
.orb-read{display:grid;grid-template-columns:1fr auto;gap:7px 8px;font-size:11px}
.orb-read .k{color:var(--ink-dim)}
.orb-read .v{text-align:right;font-family:var(--term)}
.orb-read .v.c{color:var(--cyan)}.orb-read .v.a{color:var(--amber)}.orb-read .v.g{color:var(--green)}
.orb-jump{display:flex;flex-wrap:wrap;gap:5px}
.orb-jump button{flex:1 1 28%;background:rgba(255,255,255,.02);border:1px solid var(--edge);
  color:var(--ink-dim);padding:7px 4px;font-family:var(--mono);font-size:9.5px;cursor:pointer;
  border-radius:7px;letter-spacing:.5px;transition:.15s}
.orb-jump button:hover{border-color:var(--cyan);color:var(--cyan)}
.orb-bal{font-family:var(--term);font-size:24px;font-weight:700;color:var(--green);letter-spacing:1px}
.orb-bal-sub{font-size:8px;color:var(--ink-dim);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;margin-bottom:12px}
.orb-ledger{max-height:34vh;overflow-y:auto}
.orb-row{display:flex;justify-content:space-between;font-size:10px;padding:6px 0;
  border-bottom:1px solid rgba(31,211,255,.07);font-family:var(--term);gap:8px}
.orb-row .tag{color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.orb-row .res.live{color:var(--amber)}.orb-row .res.won{color:var(--green)}.orb-row .res.lost{color:var(--red)}
.orb-empty{color:var(--ink-dim);font-size:10px;text-align:center;padding:16px 0;letter-spacing:1px}
.orb-hint{position:absolute;bottom:64px;left:50%;transform:translateX(-50%);font-size:11px;
  letter-spacing:1px;color:var(--plasma);background:rgba(4,6,10,.6);backdrop-filter:blur(8px);
  padding:7px 18px;border:1px solid var(--plasma);border-radius:20px;box-shadow:0 0 24px rgba(185,140,255,.2)}
.orb-status{position:absolute;bottom:0;left:0;right:0;height:24px;display:flex;align-items:center;
  padding:0 20px;gap:18px;font-size:8.5px;letter-spacing:1.4px;color:var(--ink-dim);text-transform:uppercase;
  background:linear-gradient(0deg,rgba(4,6,10,.7),transparent)}
.orb-status b{color:var(--cyan)}
.orb-status .r{margin-left:auto;display:flex;gap:16px}
.orb-live{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);
  display:inline-block;vertical-align:middle;margin-right:6px;animation:orbpulse 1.6s infinite}
@keyframes orbpulse{0%,100%{opacity:1}50%{opacity:.3}}
.orb-zoom{position:absolute;right:14px;bottom:84px;display:flex;flex-direction:column;gap:6px}
.orb-zoom button{width:34px;height:34px;border-radius:10px;border:1px solid var(--edge);
  background:rgba(10,16,24,.8);backdrop-filter:blur(8px);color:var(--ink);font-size:17px;
  font-family:var(--mono);cursor:pointer;transition:.15s}
.orb-zoom button:hover{border-color:var(--cyan);color:var(--cyan)}
@media(max-width:880px){.orb-left{display:none}.orb-right{top:auto;bottom:30px;left:10px;right:10px;width:auto}.orb-nav{display:none}}
`;
  document.head.appendChild(el);
}

function fmtCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(0)}°${ns} ${Math.abs(lon).toFixed(0)}°${ew}`;
}

export default function OrbHUD({
  api,
  viewLabel,
  viewOnly = false,
}: {
  api: ViewApi;
  viewLabel: string;
  viewOnly?: boolean;
}) {
  const balance = useGameStore((s) => s.userBalance);
  const cells = useGameStore((s) => s.cells);
  const selectedCellId = useGameStore((s) => s.selectedCellId);
  const activeBets = useGameStore((s) => s.activeBets);
  const strikes = useGameStore((s) => s.strikes);
  const [fps, setFps] = useState(60);

  const now = Date.now();
  const count60 = strikes.filter((s) => s.timestamp >= now - COUNTER_WINDOW_MS).length;

  useEffect(() => {
    injectHudCss();
  }, []);

  // Lightweight FPS meter for the control-room readout.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cell = selectedCellId ? cells[selectedCellId] : null;
  const target = cell
    ? (() => {
        const c = cellCenter(cell.lonMin, cell.latMin);
        return {
          region: regionName(c.lat, c.lon),
          coord: fmtCoord(c.lat, c.lon),
          count: cell.strikeCount24h,
          prob: Math.min(99, Math.round((1 / cell.multiplier) * 100)),
          mult: cell.multiplier.toFixed(2),
        };
      })()
    : null;

  const pending = activeBets.filter((b) => b.status === 'pending').length;

  return (
    <div className="orb-hud">
      <div className="orb-topbar">
        <div className="orb-brand">
          LIGHTNING<b>MAP</b>BETS
          <span className="sub">STRIKE TERMINAL · v2.0</span>
        </div>
        <nav className="orb-nav">
          <a href="/play" className="active">Map</a>
          <a href="/live">Live</a>
          <a href="/how-it-works">How</a>
          <a href="/leaderboard">Ranks</a>
        </nav>
      </div>

      {/* left: telemetry + target + orbit-to */}
      <div className="orb-panel orb-left">
        <div className="orb-sect">
          <div className="orb-h">Telemetry <span className="id">SNS</span></div>
          <div className="orb-read">
            <div className="k">Detection</div><div className="v c">BLITZORTUNG</div>
            <div className="k">Strikes · 60m</div><div className="v">{count60}</div>
            <div className="k">Packets</div><div className="v">{strikes.length}</div>
            <div className="k">View</div><div className="v a">{viewLabel}</div>
            <div className="k">Open pos.</div><div className="v g">{pending}</div>
          </div>
        </div>

        {!viewOnly && (
          <div className="orb-sect">
            <div className="orb-h">Target <span className="id">CEL</span></div>
            <div className="orb-read">
              <div className="k">Zone</div><div className="v c">{target?.region ?? '—'}</div>
              <div className="k">Coords</div><div className="v">{target?.coord ?? '—'}</div>
              <div className="k">Strikes 24h</div><div className="v">{target?.count ?? '—'}</div>
              <div className="k">Implied prob</div><div className="v a">{target ? `${target.prob}%` : '—'}</div>
              <div className="k">Payout</div><div className="v g">{target ? `${target.mult}×` : '—'}</div>
            </div>
          </div>
        )}

        <div className="orb-sect">
          <div className="orb-h">Orbit To <span className="id">NAV</span></div>
          <div className="orb-jump">
            {REGIONS.map(([name, lat, lon]) => (
              <button key={name} onClick={() => api.jump(lat, lon)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* right: position desk + ledger (betting via clicking the globe) */}
      {!viewOnly && (
        <div className="orb-panel orb-right">
          <div className="orb-h">Position Desk <span className="id">DESK</span></div>
          <div className="orb-bal">Ⓢ {balance.toLocaleString()}</div>
          <div className="orb-bal-sub">Snap credits · paper</div>
          <div className="orb-h">Settled Ledger <span className="id">LOG</span></div>
          <div className="orb-ledger">
            {activeBets.length === 0 && <div className="orb-empty">NO POSITIONS YET</div>}
            {activeBets.map((b) => {
              const p = parseCellId(b.cellId);
              const region = p
                ? regionName(...(Object.values(cellCenter(p.lonMin, p.latMin)) as [number, number]))
                : b.cellId;
              const res = b.status === 'pending' ? 'live' : b.status;
              const label = b.status === 'pending' ? 'LIVE' : b.status === 'won' ? `+${b.payout}` : 'LOST';
              return (
                <div key={b.id} className="orb-row">
                  <span className="tag">{region}</span>
                  <span>{b.amount} @ {b.multiplier.toFixed(1)}×</span>
                  <span className={`res ${res}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!viewOnly && (
        <div className="orb-hint">⌖ CLICK A ZONE ON THE GLOBE TO OPEN A POSITION</div>
      )}

      <div className="orb-zoom">
        <button aria-label="zoom in" onClick={() => api.zoomIn()}>+</button>
        <button aria-label="zoom out" onClick={() => api.zoomOut()}>−</button>
      </div>

      <div className="orb-status">
        <div><span className="orb-live" />SYS <b>NOMINAL</b></div>
        <div>FPS <b>{fps}</b></div>
        <div>PACKETS <b>{strikes.length}</b></div>
        <div className="r">
          <div>DATA <b>BLITZORTUNG.ORG</b></div>
          <div>© LIGHTNINGMAPBETS</div>
        </div>
      </div>
    </div>
  );
}
