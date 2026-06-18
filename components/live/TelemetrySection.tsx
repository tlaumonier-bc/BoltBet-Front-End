'use client'
// components/live/TelemetrySection.tsx — feed health: live/idle, latency, signal quality.
import type { LiveStats } from '@/lib/live/useLiveStats'
import { Section, Stat, QualityBar } from './hudShared'

export default function TelemetrySection({ stats }: { stats: LiveStats }) {
  return (
    <Section title="Telemetry">
      <Stat
        name="Feed"
        value={
          <span className={stats.feedLive ? 'text-emerald-400' : 'text-white/50'}>
            {stats.feedLive ? 'Live' : 'Idle'}
          </span>
        }
      />
      <Stat
        name="Avg latency"
        value={stats.avgLatencyMs != null ? `${(stats.avgLatencyMs / 1000).toFixed(1)} s` : '—'}
      />
      <QualityBar pct={stats.qualityPct} />
    </Section>
  )
}