'use client'
// components/live/LeftPanel.tsx — carte de console gauche : orbit + layers.
import OrbitSection from './OrbitSection'
import LayersSection from './LayersSection'

export default function LeftPanel({ pro }: { pro: boolean }) {
  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 overflow-y-auto rounded-2xl p-4 max-md:max-h-[46vh]">
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
        Live console
      </span>

      <OrbitSection />
      <LayersSection pro={pro} />
    </div>
  )
}