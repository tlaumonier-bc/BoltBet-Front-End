'use client'
// components/live/LiveHUD.tsx — shell of the /live console.
// Left column: map-style + mode bar (always) + console (Orbit + Layers).
// Right column: in Game mode → ZoneBetPanel; else country panel (on click) or
//   global stats + world weather. lg+ only. The bet modal mounts here too.
import { useLiveStore } from '@/store/liveStore'
import ModeBar from './ModeBar'
import LeftPanel from './LeftPanel'
import CountryPanel from './CountryPanel'
import GlobeInfoPanel from './GlobeInfoPanel'
import ZoneBetPanel from '@/components/game/ZoneBetPanel'
import ZoneBetModal from '@/components/game/ZoneBetModal'

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)
  const selectedCountry = useLiveStore((s) => s.selectedCountry)
  const isGame = mode === 'game'

  return (
    <>
      {/* Left column — Game reuses the Pro console */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 flex flex-col gap-3 md:right-auto md:w-75">
        <ModeBar />
        {mode !== 'free' && <LeftPanel pro={mode === 'pro' || isGame} />}
      </div>

      {/* Right column */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col gap-3 lg:flex">
        {/* invisible spacer matching the ModeBar height, to align tops */}
        <div className="invisible shrink-0 pointer-events-none" aria-hidden>
          <ModeBar />
        </div>

        {isGame ? (
          <ZoneBetPanel />
        ) : selectedCountry ? (
          <CountryPanel />
        ) : (
          mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>

      {/* Bet modal — centred overlay, only mounts in Game mode */}
      {isGame && <ZoneBetModal />}
    </>
  )
}