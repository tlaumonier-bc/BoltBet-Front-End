'use client'
// components/live/LiveHUD.tsx — shell of the globe console.
// Left column: map-style + mode bar + console (Orbit + Layers).
// Right column: Game mode → StrikeGamePanel; else country panel or globe stats.
// Game mode also mounts the bottom-centre BetBar.
import { useLiveStore } from '@/store/liveStore'
import ModeBar from './ModeBar'
import LeftPanel from './LeftPanel'
import CountryPanel from './CountryPanel'
import GlobeInfoPanel from './GlobeInfoPanel'
import StrikeGamePanel from '@/components/game/StrikeGamePanel'
import BetBar from '@/components/game/BetBar'
import { useStrikeGame } from '@/lib/game/useStrikeGame'

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)
  const selectedCountry = useLiveStore((s) => s.selectedCountry)
  const isGame = mode === 'game'

  // Always run the game clock so pending bets resolve even after switching modes.
  const vm = useStrikeGame()

  return (
    <>
      {/* Left column */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 flex flex-col gap-3 md:right-auto md:w-75">
        <ModeBar />
        {mode !== 'free' && <LeftPanel pro={mode === 'pro' || isGame} />}
      </div>

      {/* Right column */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col gap-3 lg:flex">
        <div className="invisible shrink-0 pointer-events-none" aria-hidden>
          <ModeBar />
        </div>

        {isGame ? (
          <StrikeGamePanel vm={vm} />
        ) : selectedCountry ? (
          <CountryPanel />
        ) : (
          mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>

      {/* Bottom-centre betting bar (Game mode only) */}
      {isGame && <BetBar vm={vm} />}
    </>
  )
}