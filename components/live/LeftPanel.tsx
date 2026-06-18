'use client'
// components/live/LeftPanel.tsx — the left console card. In Pro mode it also
// carries everything that used to live in the right panel (ProTelemetry).
import { useLiveStore } from '@/store/liveStore'
import { ORBIT_LOCATIONS } from '@/lib/live/locations'
import { useLiveStats } from '@/lib/live/useLiveStats'
import QualitySettings from './QualitySettings'
import OrbitSection from './OrbitSection'
import LayersSection from './LayersSection'
import StrikesSection from './StrikesSection'
import ProTelemetry from './ProTelemetry'

export default function LeftPanel({ pro }: { pro: boolean }) {
  const stats = useLiveStats()
  const orbitTarget = useLiveStore((s) => s.orbitTarget)
  const focus = orbitTarget
    ? ORBIT_LOCATIONS.find((l) => l.id === orbitTarget.id) ?? null
    : null

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 overflow-y-auto rounded-2xl p-4 max-md:max-h-[46vh]">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
          Live console
        </span>
        <QualitySettings />
      </div>

      <OrbitSection />
      <LayersSection pro={pro} />
      <StrikesSection stats={stats} focus={focus} pro={pro} />
      {pro && <ProTelemetry stats={stats} focus={focus} />}

      <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-white/35">
        Strikes, telemetry{pro ? ' & activity' : ''}: live Blitzortung feed. Weather
        {pro ? ', cells, alerts & pulse' : ''}: sample data until the Xweather
        integration ships.
      </p>
    </div>
  )
}