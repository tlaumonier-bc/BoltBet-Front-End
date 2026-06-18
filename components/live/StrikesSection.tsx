// components/live/StrikesSection.tsx — global strike stats (last 60s / last 10 min + hottest region).
import type { LiveStats } from '@/lib/live/useLiveStats'
import { Section, BigStat } from './hudShared'

export default function StrikesSection({ stats }: { stats: LiveStats }) {
  return (
    <Section title="Strikes">
      <div className="grid grid-cols-2 gap-2">
        <BigStat value={stats.perMinute} label="last 60 s" />
        <BigStat value={stats.last10Min} label="last 10 min" />
      </div>
      <Row name="Hottest region" value={stats.topRegion ?? '—'} />
    </Section>
  )
}

function Row({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs">
      <span className="text-white/45">{name}</span>
      <span className="text-right font-medium text-white/90">{value}</span>
    </div>
  )
}