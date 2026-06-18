'use client'
// components/live/ProTelemetry.tsx — Activity / Range (real) + Storm cells /
// Alerts / Pulse (sample). Previously the right panel; now part of the left
// console in Pro mode.
import { useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import { nearestStrike, type LiveStats } from '@/lib/live/useLiveStats'
import { useStrikesPerMinute } from '@/lib/live/useStrikesPerMinutes'
import type { OrbitLocation } from '@/lib/live/locations'
import {
  Section,
  Stat,
  Empty,
  SampleTag,
  RateSparkline,
  PulseBar,
  StormCellRow,
  AlertRow,
} from './hudShared'

export default function ProTelemetry({
  stats,
  focus,
}: {
  stats: LiveStats
  focus: OrbitLocation | null
}) {
  const near = useMemo(
    () =>
      focus ? nearestStrike(useGameStore.getState().strikes, focus.lat, focus.lon, stats.now) : null,
    [focus, stats.now],
  )
  const buckets = useStrikesPerMinute(15).map((b) => b.count)
  const peak = Math.max(0, ...buckets)

  return (
    <>
      {/* ACTIVITY — real */}
      <Section title="Activity · last 15 min">
        <RateSparkline buckets={buckets} />
        <div className="mt-1 flex justify-between text-[10px] text-white/40">
          <span>−15 min</span>
          <span>peak {peak}/min</span>
          <span>now</span>
        </div>
      </Section>

      {/* RANGE — real */}
      <Section title="Range">
        {focus ? (
          near ? (
            <>
              <div className="flex items-end gap-2">
                <span className="font-display text-3xl font-bold text-electric">
                  {Math.round(near.km).toLocaleString('en-US')}
                </span>
                <span className="pb-1 text-xs text-white/55">km</span>
              </div>
              <p className="mt-1 text-[11px] text-white/45">
                Nearest detection to {focus.short} · {near.ageSec}s ago
              </p>
            </>
          ) : (
            <Empty>No detections in the last 10 min.</Empty>
          )
        ) : (
          <Empty>Pick a continent above.</Empty>
        )}
      </Section>

      {/* STORM CELLS — sample */}
      <Section title="Storm cells" badge={<SampleTag />}>
        {focus ? (
          focus.wx.cells.length ? (
            <div className="space-y-1.5">
              {focus.wx.cells.map((c) => (
                <StormCellRow key={c.id} cell={c} />
              ))}
            </div>
          ) : (
            <Empty>No tracked cells near {focus.short}.</Empty>
          )
        ) : (
          <Empty>Pick a continent above.</Empty>
        )}
      </Section>

      {/* ALERTS — sample */}
      <Section title="Severe alerts" badge={<SampleTag />}>
        {focus ? (
          focus.wx.alerts.length ? (
            <div className="space-y-1.5">
              {focus.wx.alerts.map((a, i) => (
                <AlertRow key={i} alert={a} />
              ))}
            </div>
          ) : (
            <Empty>No active alerts for {focus.short}.</Empty>
          )
        ) : (
          <Empty>Pick a continent above.</Empty>
        )}
      </Section>

      {/* PULSE — sample */}
      <Section title="Pulse analysis" badge={<SampleTag />}>
        {focus ? (
          <>
            <PulseBar cgShare={focus.wx.pulse.cgShare} />
            <Stat name="Avg peak current" value={`${focus.wx.pulse.avgPeakKA} kA`} />
            <Stat name="CAPE" value={`${focus.wx.capeJkg.toLocaleString('en-US')} J/kg`} />
          </>
        ) : (
          <Empty>Pick a continent above.</Empty>
        )}
      </Section>
    </>
  )
}