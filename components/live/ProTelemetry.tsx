'use client'
// components/live/ProTelemetry.tsx — Activity sparkline: global strikes/min over
// the last 15 minutes. Shown in the overall-globe right panel in Pro mode.
import { useStrikesPerMinute } from '@/lib/live/useStrikesPerMinutes'
import { Section, RateSparkline } from './hudShared'

export default function ProTelemetry() {
  const buckets = useStrikesPerMinute(15).map((b) => b.count)
  const peak = Math.max(0, ...buckets)

  return (
    <Section title="Activity · last 15 min">
      <RateSparkline buckets={buckets} />
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>−15 min</span>
        <span>peak {peak}/min</span>
        <span>now</span>
      </div>
    </Section>
  )
}