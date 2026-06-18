'use client'
// components/live/GlobeInfoPanel.tsx — panneau de droite par défaut (aucun pays
// sélectionné) : stats globales du globe. Strikes (tous modes) + Telemetry &
// Activity (pro). Réutilise StrikesSection et ProTelemetry.
import { useLiveStats } from '@/lib/live/useLiveStats'
import StrikesSection from './StrikesSection'
import ProTelemetry from './ProTelemetry'

export default function GlobeInfoPanel({ pro }: { pro: boolean }) {
  const stats = useLiveStats()

  return (
    <div className="glass panel-scroll pointer-events-auto min-h-0 w-full overflow-y-auto rounded-2xl p-4">
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
        Globe activity
      </span>

      <StrikesSection stats={stats} pro={pro} />
      {pro && <ProTelemetry />}
    </div>
  )
}