'use client'
// components/live/ProTelemetry.tsx — sparkline d'activité : strikes/min sur les
// 15 dernières minutes. Affiché dans le panneau de droite (globe) en mode Pro.
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