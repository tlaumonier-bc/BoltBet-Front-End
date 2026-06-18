'use client'
// components/live/LeftPanel.tsx — the left console card: quality, orbit, layers.
import QualitySettings from './QualitySettings'
import OrbitSection from './OrbitSection'
import LayersSection from './LayersSection'

export default function LeftPanel({ pro }: { pro: boolean }) {
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
    </div>
  )
}