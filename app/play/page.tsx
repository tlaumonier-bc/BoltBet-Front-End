import type { Metadata } from 'next'
import MapWrapper from '@/components/map/MapWrapper'

export const metadata: Metadata = {
  title: 'Play — Live Lightning Globe',
  description:
    'Place predictions on a live 3D globe of real-time lightning strikes. Click any zone to bet on the next bolt.',
  robots: { index: false, follow: true },
}

export default function PlayPage() {
  return (
    <main>
      <MapWrapper />
    </main>
  )
}