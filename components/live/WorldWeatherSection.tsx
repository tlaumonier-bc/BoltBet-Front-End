'use client'
// components/live/WorldWeatherSection.tsx — live "World weather" snapshot block.
import { useWorldWeather } from '@/lib/live/useWorldWeather'
import { Section } from './hudShared'

function tempColor(t: number): string {
  if (t >= 30) return 'text-orange-300'
  if (t >= 20) return 'text-amber-200'
  if (t >= 10) return 'text-white/90'
  if (t >= 0) return 'text-sky-300'
  return 'text-blue-300'
}

export default function WorldWeatherSection() {
  const rows = useWorldWeather()

  return (
    <Section title="World weather">
      {rows.length === 0 ? (
        <p className="text-xs text-white/40">Loading…</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2.5 rounded-lg bg-white/4 px-2.5 py-1.5"
            >
              <span className="text-base leading-none" aria-hidden>{r.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-white/85">{r.label}</div>
                <div className="text-[10px] text-white/40">{r.condition}</div>
              </div>
              <span className={`font-display text-sm font-bold tabular-nums ${tempColor(r.tempC)}`}>
                {r.tempC}°
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}