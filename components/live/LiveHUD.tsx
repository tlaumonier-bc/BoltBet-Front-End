'use client'
// components/live/LiveHUD.tsx — coquille de la console /live.
// Colonne gauche : map-style + mode (toujours) + console allégée (Orbit + Layers).
// Colonne droite : panneau pays si un pays est sélectionné, sinon stats globales
//   du globe (beginner/pro). lg+ uniquement.
import { useLiveStore } from '@/store/liveStore'
import ModeBar from './ModeBar'
import LeftPanel from './LeftPanel'
import CountryPanel from './CountryPanel'
import GlobeInfoPanel from './GlobeInfoPanel'

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)
  const selectedCountry = useLiveStore((s) => s.selectedCountry)

  return (
    <>
      {/* Colonne gauche */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 flex flex-col gap-3 md:right-auto md:w-75">
        <ModeBar />
        {mode !== 'free' && <LeftPanel pro={mode === 'pro'} />}
      </div>

      {/* Colonne droite — pays au clic, sinon stats globales */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col lg:flex">
        {selectedCountry ? (
          <CountryPanel />
        ) : (
          mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>
    </>
  )
}