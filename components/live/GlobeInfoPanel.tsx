'use client'
// components/live/GlobeInfoPanel.tsx — right panel (no country selected):
// global Strikes stats (pinned) + lower section.
//   beginner → live "Recent strikes" list (fills + scrolls)
//   pro      → Telemetry + Activity sparkline (height hugs content)
import { useLiveStats } from '@/lib/live/useLiveStats'
import StrikesSection from './StrikesSection'
import RecentStrikesSection from './RecentStrikesSection'
import TelemetrySection from './TelemetrySection'
import ProTelemetry from './ProTelemetry'

export default function GlobeInfoPanel({ pro }: { pro: boolean }) {
  const stats = useLiveStats()

  return (
    <div
      className={`glass shrink-0 pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl p-4${
        pro ? '' : ''
      }`}
    >
      <span className="shrink-0 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
        Globe activity
      </span>

      <div className="shrink-0">
        <StrikesSection stats={stats} />
      </div>

      {pro ? (
        <TelemetrySection stats={stats} />
      ) : (
        <div className="panel-scroll min-h-0 overflow-y-auto">
          <RecentStrikesSection />
        </div>
      )}

      {pro && <ProTelemetry />}
    </div>
  )
}