'use client'
// components/live/LiveHUD.tsx — coquille de la console /live.
// Colonne gauche : map-style + mode (toujours) + console (Orbit + Layers).
// Colonne droite : un espaceur invisible (= hauteur de la ModeBar) pour que le
//   panneau droit s'aligne exactement sur le panneau gauche, puis le panneau
//   pays (au clic) sinon les stats globales + météo mondiale. lg+ uniquement.
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

      {/* Colonne droite — même hauteur que la gauche grâce à l'espaceur invisible */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col gap-3 lg:flex">
        {/* Espaceur : copie invisible de la ModeBar pour aligner le haut du
            panneau droit sur le panneau gauche. */}
        <div className="invisible shrink-0 pointer-events-none" aria-hidden>
          <ModeBar />
        </div>

        {selectedCountry ? (
          <CountryPanel />
        ) : (
          mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>
    </>
  )
}