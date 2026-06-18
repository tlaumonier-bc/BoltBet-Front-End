// components/live/StrikesSection.tsx — stats de strikes globales + télémétrie.
import type { LiveStats } from '@/lib/live/useLiveStats'
import { Section, Stat, BigStat, QualityBar } from './hudShared'

export default function StrikesSection({
  stats,
  pro,
}: {
  stats: LiveStats
  pro: boolean
}) {
  return (
    <>
      {/* STRIKES — réel */}
      <Section title="Strikes">
        <div className="grid grid-cols-2 gap-2">
          <BigStat value={stats.perMinute} label="last 60 s" />
          <BigStat value={stats.last10Min} label="last 10 min" />
        </div>
        <Stat name="Hottest region" value={stats.topRegion ?? '—'} />
        {pro && (
          <>
            <Stat name="Session detections" value={stats.totalSession.toLocaleString('en-US')} />
            <Stat
              name="Last strike"
              value={
                stats.lastStrike
                  ? `${stats.lastStrike.region} · ${stats.lastStrike.ageSec}s ago`
                  : '—'
              }
            />
          </>
        )}
      </Section>

      {/* TELEMETRY — réel, pro uniquement */}
      {pro && (
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
      )}
    </>
  )
}