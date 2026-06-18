'use client'
// components/live/OrbitSection.tsx — "Orbit to" continent buttons.
import { useLiveStore } from '@/store/liveStore'
import { ORBIT_LOCATIONS } from '@/lib/live/locations'
import { Section, coord } from './hudShared'

export default function OrbitSection() {
  const orbitTarget = useLiveStore((s) => s.orbitTarget)
  const orbitTo = useLiveStore((s) => s.orbitTo)
  const clearOrbit = useLiveStore((s) => s.clearOrbit)
  const focus = orbitTarget
    ? ORBIT_LOCATIONS.find((l) => l.id === orbitTarget.id) ?? null
    : null

  return (
    <Section
      title="Orbit to"
      badge={
        focus ? (
          <button
            onClick={clearOrbit}
            className="rounded-md px-1.5 py-0.5 text-[10px] text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Clear focused location"
          >
            {focus.short} ✕
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-1.5">
        {ORBIT_LOCATIONS.map((loc) => {
          const active = orbitTarget?.id === loc.id
          return (
            <button
              key={loc.id}
              onClick={() =>
                orbitTo({
                  id: loc.id,
                  label: loc.label,
                  lat: loc.lat,
                  lon: loc.lon,
                  flyHeightM: loc.flyHeightM,
                })
              }
              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                active
                  ? 'border-bolt/50 bg-bolt/10'
                  : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8'
              }`}
            >
              <span
                className={`block text-xs font-semibold ${
                  active ? 'text-bolt' : 'text-white/85'
                }`}
              >
                {loc.short}
              </span>
              <span className="block text-[10px] text-white/40">{coord(loc.lat, loc.lon)}</span>
            </button>
          )
        })}
      </div>
    </Section>
  )
}