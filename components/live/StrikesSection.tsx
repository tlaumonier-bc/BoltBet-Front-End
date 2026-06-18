// components/live/StrikesSection.tsx — real strike rates + telemetry + sample weather.
import type { LiveStats } from '@/lib/live/useLiveStats'
import type { OrbitLocation } from '@/lib/live/locations'
import { Section, Stat, BigStat, SampleTag, Empty, QualityBar } from './hudShared'

export default function StrikesSection({
  stats,
  focus,
  pro,
}: {
  stats: LiveStats
  focus: OrbitLocation | null
  pro: boolean
}) {
  return (
    <>
      {/* STRIKES — real */}
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

      {/* TELEMETRY — real */}
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
        {pro && <QualityBar pct={stats.qualityPct} />}
      </Section>

      {/* WEATHER — sample (Xweather /conditions shape) */}
      <Section title={focus ? `Weather · ${focus.short}` : 'Weather'} badge={<SampleTag />}>
        {focus ? (
          <>
            <div className="flex items-end gap-2">
              <span className="font-display text-3xl font-bold text-white">
                {focus.wx.tempC}°C
              </span>
              <span className="pb-1 text-xs text-white/55">{focus.wx.condition}</span>
            </div>
            <Stat name="Wind" value={`${focus.wx.windKph} km/h ${focus.wx.windDir}`} />
            <Stat name="Humidity" value={`${focus.wx.humidity}%`} />
            {pro && (
              <>
                <Stat name="Pressure" value={`${focus.wx.pressureMb} mb`} />
                <Stat name="Dewpoint" value={`${focus.wx.dewpointC}°C`} />
                <Stat name="Cloud cover" value={`${focus.wx.cloudCover}%`} />
              </>
            )}
          </>
        ) : (
          <Empty>Pick a continent above to load conditions.</Empty>
        )}
      </Section>
    </>
  )
}