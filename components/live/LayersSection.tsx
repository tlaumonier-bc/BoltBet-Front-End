'use client'
// components/live/LayersSection.tsx — globe layer toggles (2 beginner, 4 pro).
import { useLiveStore } from '@/store/liveStore'
import { layersForTier } from '@/lib/globe/layers'
import { Section } from './hudShared'
import LayerToggle from './LayerToggle'

export default function LayersSection({
  pro,
  showTitle = true,
  compact = false,
}: {
  pro: boolean
  showTitle?: boolean
  compact?: boolean
}) {
  const activeLayers = useLiveStore((s) => s.activeLayers)
  const toggleLayer = useLiveStore((s) => s.toggleLayer)
  const layers = layersForTier(pro)
  const content = (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {layers.map((def) => (
        <LayerToggle
          key={def.id}
          def={def}
          active={!!activeLayers[def.id]}
          onToggle={() => toggleLayer(def.id)}
          compact={compact}
        />
      ))}
    </div>
  )

  if (!showTitle) return content

  return (
    <Section title={pro ? 'Layers · Pro' : 'Layers'}>
      {content}
    </Section>
  )
}