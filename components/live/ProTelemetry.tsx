'use client'
// components/live/ProTelemetry.tsx — sparkline d'activité : strikes/min sur les
// 15 dernières minutes. Affiché dans le panneau de droite (globe) en mode Pro.
import { useStrikesPerMinute } from '@/lib/live/useStrikesPerMinutes'
import { Section, RateSparkline } from './hudShared'
import { useT } from '@/lib/i18n/ui'

export default function ProTelemetry() {
  const buckets = useStrikesPerMinute(15).map((b) => b.count)
  const peak = Math.max(0, ...buckets)
  const { t } = useT()

  return (
    <Section title={t('liveSecondary.activity15')}>
      <RateSparkline buckets={buckets} />
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>−15 min</span>
        <span>{t('liveSecondary.peak')} {peak}/min</span>
        <span>{t('liveSecondary.now')}</span>
      </div>
    </Section>
  )
}