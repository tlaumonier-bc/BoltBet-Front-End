'use client'
// components/live/LeftPanel.tsx — carte de console gauche : orbit + layers.
import OrbitSection from './OrbitSection'
import LayersSection from './LayersSection'
import { useT } from '@/lib/i18n/ui'

export default function LeftPanel({
  pro,
  showOrbit = true,
  title = 'Live console',
  showLayerTitle = true,
  compactLayers = false,
}: {
  pro: boolean
  showOrbit?: boolean
  title?: string | null
  showLayerTitle?: boolean
  compactLayers?: boolean
}) {
  const { t } = useT()
  const resolvedTitle = title === 'Live console' ? t('live.console') : title

  return (
    <div className={`glass panel-scroll pointer-events-auto min-h-0 overflow-y-auto rounded-2xl ${compactLayers ? 'p-2.5' : 'p-4 max-md:max-h-[46vh]'}`}>
      {resolvedTitle && (
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
          {resolvedTitle}
        </span>
      )}

      {showOrbit && <OrbitSection />}
      <LayersSection pro={pro} showTitle={showLayerTitle} compact={compactLayers} />
    </div>
  )
}