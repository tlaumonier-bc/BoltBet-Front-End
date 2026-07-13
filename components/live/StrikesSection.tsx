// components/live/StrikesSection.tsx — global strike stats (last 60s / last 10 min + hottest region).
'use client'
import type { LiveStats } from '@/lib/live/useLiveStats'
import { Section, BigStat } from './hudShared'
import { useT } from '@/lib/i18n/ui'

export default function StrikesSection({ stats }: { stats: LiveStats }) {
  const { t } = useT()

  return (
    <Section title={t('liveSecondary.strikes')}>
      <div className="grid grid-cols-2 gap-2">
        <BigStat value={stats.perMinute} label={t('liveSecondary.last60s')} />
        <BigStat value={stats.last10Min} label={t('liveSecondary.last10Min')} />
      </div>
      <Row name={t('liveSecondary.hottestRegion')} value={stats.topRegion ?? '—'} />
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