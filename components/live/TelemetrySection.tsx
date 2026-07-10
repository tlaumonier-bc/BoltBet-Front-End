'use client'
// components/live/TelemetrySection.tsx — feed health: live/idle, latency, signal quality.
import type { LiveStats } from '@/lib/live/useLiveStats'
import { Section, Stat, QualityBar } from './hudShared'
import { useT } from '@/lib/i18n/ui'

export default function TelemetrySection({ stats }: { stats: LiveStats }) {
  const { t } = useT()

  return (
    <Section title={t('liveSecondary.telemetry')}>
      <Stat
        name={t('liveSecondary.feed')}
        value={
          <span className={stats.feedLive ? 'text-emerald-400' : 'text-white/50'}>
            {stats.feedLive ? t('countryPanel.live') : t('countryPanel.idle')}
          </span>
        }
      />
      <Stat
        name={t('liveSecondary.avgLatency')}
        value={stats.avgLatencyMs != null ? `${(stats.avgLatencyMs / 1000).toFixed(1)} s` : '—'}
      />
      <QualityBar pct={stats.qualityPct} />
    </Section>
  )
}