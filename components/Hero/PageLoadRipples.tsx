'use client'
// components/Hero/PageLoadRipples.tsx
// A one-shot intro flourish: for the first ~3.5s after the landing page loads,
// lightning "shockwaves" ripple out across the WHOLE viewport (not just the
// globe) plus a couple of soft screen flashes — as if the opening burst of
// strikes is rippling through the page. Then it unmounts completely, leaving
// zero cost for the rest of the session. Pointer-events are off so it never
// blocks clicks, and it's skipped entirely under prefers-reduced-motion.

import { useEffect, useState } from 'react'

const DURATION_MS = 3800

// Pre-placed ripples across the viewport (deterministic — no layout jitter).
// left/top in %, delay/dur in seconds, size in px.
const RIPPLES = [
  { left: 50, top: 42, delay: 0.0, dur: 1.7, size: 460 },
  { left: 24, top: 30, delay: 0.25, dur: 1.5, size: 320 },
  { left: 76, top: 34, delay: 0.45, dur: 1.6, size: 340 },
  { left: 38, top: 64, delay: 0.7, dur: 1.5, size: 300 },
  { left: 66, top: 70, delay: 0.95, dur: 1.6, size: 360 },
  { left: 14, top: 58, delay: 1.25, dur: 1.4, size: 280 },
  { left: 88, top: 56, delay: 1.5, dur: 1.4, size: 280 },
  { left: 50, top: 20, delay: 1.85, dur: 1.5, size: 320 },
  { left: 30, top: 82, delay: 2.2, dur: 1.4, size: 300 },
]

const FLASHES = [
  { delay: 0.0, dur: 0.6 },
  { delay: 0.55, dur: 0.7 },
  { delay: 1.3, dur: 0.8 },
]

export default function PageLoadRipples() {
  // The ripples are rendered in the initial HTML so they animate the instant
  // the page paints — no waiting on hydration. The CSS one-shot animations run
  // once on mount and end at opacity 0; prefers-reduced-motion is honored in
  // CSS. After the burst we unmount the markup entirely (setState only fires
  // inside the timeout, never synchronously in the effect).
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDone(true), DURATION_MS)
    return () => clearTimeout(t)
  }, [])

  if (done) return null

  return (
    <div className="hero-ripples pointer-events-none fixed inset-0 z-60" aria-hidden="true">
      {FLASHES.map((f, i) => (
        <div
          key={`f${i}`}
          className="hero-flash"
          style={{ animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }}
        />
      ))}
      {RIPPLES.map((r, i) => (
        <span
          key={`r${i}`}
          className="hero-ripple"
          style={{
            left: `${r.left}%`,
            top: `${r.top}%`,
            width: r.size,
            height: r.size,
            animationDelay: `${r.delay}s`,
            animationDuration: `${r.dur}s`,
          }}
        />
      ))}
    </div>
  )
}
