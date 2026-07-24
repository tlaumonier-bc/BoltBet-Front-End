'use client';
// GridGameDemo — a self-contained, animated "how to play" walkthrough for the
// Grid Game. No live data: a scripted storm drifts across a mini grid so a
// first-time player sees the whole idea — multipliers, spreading chips, and the
// key skill (bet where the storm is HEADING, not where it's hot).

import { useEffect, useRef, useState } from 'react';

const COLS = 6;
const ROWS = 4;
const CW = 80;
const CH = 70;
const VB_W = COLS * CW;
const VB_H = ROWS * CH;
const STORM_ROW = 1.5;
const SIGMA = 1.2;

// Cell the demo "player" stakes — a cold, high-multiplier cell in the storm's path.
const STAKED: { col: number; row: number; amt: number }[] = [
  { col: 4, row: 1, amt: 5 },
  { col: 4, row: 2, amt: 5 },
];
const DEMO_STRIKES = 2; // strikes that land in the staked cell at resolution (illustrative)

// Illustrative pricing (same shape as the real model: inverse of expected strike
// COUNT, so a per-strike payout stays fair). Cold → high multiplier, hot → low.
const K = 1.8;
const EDGE = 0.05;
function densityAt(col: number, row: number, stormCol: number) {
  const d2 = (col - stormCol) ** 2 + (row - STORM_ROW) ** 2;
  return Math.exp(-d2 / (2 * SIGMA * SIGMA));
}
function multFrom(density: number) {
  const lambda = Math.max(1e-3, density * K); // expected strike count
  return Math.max(1.15, Math.min(8, (1 / lambda) * (1 - EDGE)));
}
// Multiplier the staked cell was bought at (storm still to the left).
const BET_STORM_COL = 1.8;
const LOCKED_MULT = multFrom(densityAt(STAKED[0].col, STAKED[0].row, BET_STORM_COL));
const PLAYER_PAYOUT = Math.round(STAKED.reduce((s, c) => s + DEMO_STRIKES * LOCKED_MULT * c.amt, 0));

interface Step {
  stormCol: number;
  title: string;
  body: string;
  showMult: boolean;
  showChips: boolean;
  showArrow: boolean;
  strike: boolean;
}
const STEPS: Step[] = [
  {
    stormCol: 1,
    title: 'Lightning strikes the grid',
    body: 'Real strikes land in the grid cells live (⚡). Brighter = more strikes right now. Your goal: bet on the cells where the next strikes will land.',
    showMult: false,
    showChips: false,
    showArrow: false,
    strike: false,
  },
  {
    stormCol: 1.3,
    title: 'Every cell has a payout multiplier',
    body: 'It’s the inverse of how many strikes a cell is expected to take. Hot cells pay little (~1.2×). Cold cells pay big (up to 8×). Everyone sees the same odds — so the hot cell is no edge.',
    showMult: true,
    showChips: false,
    showArrow: false,
    strike: false,
  },
  {
    stormCol: 1.8,
    title: 'Click a cell and stake credits',
    body: 'Click any cell, choose how many credits to bet, and confirm. Here we back a cold, high-multiplier cell the storm is drifting toward — cold cells pay the most.',
    showMult: true,
    showChips: true,
    showArrow: true,
    strike: false,
  },
  {
    stormCol: 2.9,
    title: 'The skill: read the movement',
    body: 'A storm drifts predictably even though each strike is random. Your edge is staking the cold cell it’s HEADING for — before it lights up — instead of chasing today’s hot cell.',
    showMult: true,
    showChips: true,
    showArrow: true,
    strike: false,
  },
  {
    stormCol: 3.9,
    title: 'Strikes land → you get paid',
    body: `The storm arrived. Every strike in your cell pays multiplier × stake — ${DEMO_STRIKES} strikes here returns +${PLAYER_PAYOUT}. The colder the cell when it lights up, the bigger the payout. Reach 0 credits and it’s game over.`,
    showMult: true,
    showChips: true,
    showArrow: false,
    strike: true,
  },
];

function multColor(mult: number) {
  if (mult >= 4) return '#fcd34d'; // amber — cold, big payout
  if (mult >= 2) return '#a5f3fc'; // cyan — mid
  return 'rgba(255,255,255,0.5)'; // white — hot, small payout
}

export default function GridGameDemo({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [stormX, setStormX] = useState(STEPS[0].stormCol);
  const stormXRef = useRef(stormX);
  useEffect(() => {
    stormXRef.current = stormX;
  }, [stormX]);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // Ease the storm toward the current step's position so it visibly "moves".
  useEffect(() => {
    const start = stormXRef.current;
    const target = STEPS[step].stormCol;
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setStormX(start + (target - start) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setStep((v) => Math.min(STEPS.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setStep((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stormCx = (stormX + 0.5) * CW;
  const stormCy = (STORM_ROW + 0.5) * CH;

  const cells = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      cells.push({ col, row });
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass w-full max-w-[580px] overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/85 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="font-display text-sm font-black uppercase tracking-[0.24em] text-cyan-100/70">How to play</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-lg text-white/45 transition hover:text-white" aria-label="Close demo">
            ✕
          </button>
        </div>

        {/* Illustration */}
        <div className="relative mx-5 mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full" role="img" aria-label="Grid game demo illustration">
            <defs>
              <radialGradient id="demo-storm" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(239,68,68,0.85)" />
                <stop offset="35%" stopColor="rgba(249,115,22,0.55)" />
                <stop offset="70%" stopColor="rgba(250,204,21,0.28)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0)" />
              </radialGradient>
            </defs>

            {/* storm heat blob (drifts left → right) */}
            <ellipse cx={stormCx} cy={stormCy} rx={CW * 1.7} ry={CH * 1.7} fill="url(#demo-storm)" opacity={0.9} />

            {/* grid cells + multipliers + chips */}
            {cells.map(({ col, row }) => {
              const x = col * CW;
              const y = row * CH;
              const mult = multFrom(densityAt(col, row, stormX));
              const staked = STAKED.find((c) => c.col === col && c.row === row);
              const struck = s.strike && densityAt(col, row, stormX) > 0.45;
              const stakedStruck = s.strike && !!staked;
              // Step 1 has no chips/odds yet — show live bolts landing in the hot
              // cells so a newcomer immediately grasps: strikes hit specific cells,
              // and picking those cells is the whole game.
              const introZap = step === 0 && densityAt(col, row, stormX) > 0.6;
              return (
                <g key={`${col}-${row}`} className={stakedStruck ? 'grid-cell-hit' : undefined}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={CW - 4}
                    height={CH - 4}
                    rx={6}
                    fill={
                      s.showChips && staked
                        ? stakedStruck
                          ? 'rgba(16,185,129,0.42)'
                          : 'rgba(56,189,248,0.20)'
                        : 'rgba(148,163,184,0.10)'
                    }
                    stroke={s.showChips && staked ? 'rgba(125,211,252,0.9)' : 'rgba(226,232,240,0.2)'}
                    strokeWidth={s.showChips && staked ? 2 : 1}
                  />
                  {s.showMult && (
                    <text x={x + CW / 2} y={y + 20} textAnchor="middle" fontSize="15" fontWeight="900" fill={multColor(mult)}>
                      {mult.toFixed(1)}×
                    </text>
                  )}
                  {s.showChips && staked && (
                    <text x={x + CW / 2} y={y + CH / 2 + 8} textAnchor="middle" fontSize="20" fontWeight="900" fill="#ffffff">
                      {staked.amt}
                    </text>
                  )}
                  {struck && (
                    <text x={x + CW / 2} y={y + CH / 2 + 4} textAnchor="middle" fontSize="26" className="demo-zap">
                      ⚡
                    </text>
                  )}
                  {introZap && (
                    <text
                      x={x + CW / 2}
                      y={y + CH / 2 + 4}
                      textAnchor="middle"
                      fontSize="26"
                      className="demo-zap-pulse"
                      style={{ animationDelay: `${((col + row) % 3) * 0.33}s` }}
                    >
                      ⚡
                    </text>
                  )}
                  {stakedStruck && staked && (
                    <text x={x + CW / 2} y={y + CH - 8} textAnchor="middle" fontSize="13" fontWeight="900" fill="#6ee7b7">
                      +{Math.round(DEMO_STRIKES * LOCKED_MULT * staked.amt)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* drift arrow */}
            {s.showArrow && (
              <g opacity={0.9}>
                <line x1={CW * 1.2} y1={18} x2={CW * 4.6} y2={18} stroke="rgba(125,211,252,0.9)" strokeWidth="3" strokeDasharray="8 6" />
                <path d={`M ${CW * 4.6} 18 l -12 -6 l 0 12 z`} fill="rgba(125,211,252,0.95)" />
                <text x={CW * 2.9} y={12} textAnchor="middle" fontSize="11" fontWeight="800" fill="rgba(186,230,253,0.9)">
                  storm drifting
                </text>
              </g>
            )}
          </svg>

          {/* legend chips */}
          <div className="pointer-events-none absolute bottom-2 left-2 flex gap-2">
            {s.showChips && (
              <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-100">Your bet</span>
            )}
          </div>
        </div>

        {/* caption */}
        <div className="px-5 pb-2 pt-4">
          <div className="font-display text-lg font-black text-white">{s.title}</div>
          <p className="mt-1 min-h-[64px] text-sm leading-relaxed text-white/65">{s.body}</p>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-bolt' : 'w-1.5 bg-white/25'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((v) => Math.max(0, v - 1))} className="rounded-xl border border-white/12 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10">
                Back
              </button>
            )}
            {!last ? (
              <button type="button" onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))} className="btn-glow rounded-xl px-4 py-2 text-xs font-black">
                Next
              </button>
            ) : (
              <button type="button" onClick={onClose} className="btn-glow rounded-xl px-4 py-2 text-xs font-black">
                Start playing →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
