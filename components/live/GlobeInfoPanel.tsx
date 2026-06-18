'use client'
// components/live/GlobeInfoPanel.tsx — right panel (no country selected):
// global Strikes stats (pinned) + a live list of recent strikes by country
// that fills the rest of the panel and scrolls.
import { useLiveStats } from '@/lib/live/useLiveStats'
import StrikesSection from './StrikesSection'
import RecentStrikesSection from './RecentStrikesSection'

export default function GlobeInfoPanel() {
  const stats = useLiveStats()

  return (
    <div className="glass pointer-events-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl p-4">
      <span className="shrink-0 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
        Globe activity
      </span>

      <div className="shrink-0">
        <StrikesSection stats={stats} />
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
        <RecentStrikesSection />
      </div>
    </div>
  )
}
