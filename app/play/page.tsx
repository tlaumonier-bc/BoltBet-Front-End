import type { Metadata } from 'next'
import GlobeWrapper from '@/components/Globe/GlobeWrapper'
import GameHUD from '@/components/HUD/GameHUD'

export const metadata: Metadata = {
  title: 'Play — Live Lightning Globe',
  description:
    'Place predictions on a live 3D globe of real-time lightning strikes. Click any zone to bet on the next bolt.',
}

export default function PlayPage() {
  return (
    <main>
      <GlobeWrapper />
      <GameHUD />
    </main>
  )
}