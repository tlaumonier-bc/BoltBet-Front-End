'use client';
// Live "lightning strikes worldwide today" counter. Seeds from seconds since
// UTC midnight at ~8.6M/day (~99.5/sec) and ticks up live. Client-only to avoid
// hydration mismatch.

import { useEffect, useState } from 'react';

const PER_DAY = 8_600_000;
const PER_SEC = PER_DAY / 86_400; // ≈ 99.5

function strikesSoFarToday() {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return ((Date.now() - midnight) / 1000) * PER_SEC;
}

export default function StrikesToday() {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    let v = strikesSoFarToday();
    setN(v);
    const step = 120; // ms
    const t = setInterval(() => {
      v += PER_SEC * (step / 1000) + Math.random() * 4; // base rate + a little flicker
      setN(v);
    }, step);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="counter">
      <div className="c-num">
        <span className="dot" />
        {n === null ? '—' : Math.floor(n).toLocaleString('en-US')}
      </div>
      <div className="c-label">lightning strikes worldwide today · live</div>
    </div>
  );
}
