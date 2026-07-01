'use client'
// components/live/LiveHUD.tsx — shell of the globe console.
import { useState } from 'react'
import { useLiveStore } from '@/store/liveStore'
import ModeBar from './ModeBar'
import LeftPanel from './LeftPanel'
import CountryPanel from './CountryPanel'
import GlobeInfoPanel from './GlobeInfoPanel'
import StrikeGamePanel from '@/components/game/StrikeGamePanel'
import BetBar from '@/components/game/BetBar'
import GameAccount from '@/components/game/GameAccount'
import { useStrikeGame } from '@/lib/game/useStrikeGame'
import { useSessionStore } from '@/store/sessionStore'

type MobileSheet = 'console' | 'info' | 'game' | null

function MobileActionButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-2xl px-3 py-2 text-xs font-bold transition ${
        active
          ? 'bg-bolt text-storm shadow-[0_0_18px_rgba(253,224,71,0.35)]'
          : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function LiveHUD() {
  const mode = useLiveStore((s) => s.mode)
  const setMode = useLiveStore((s) => s.setMode)
  const selectedCountry = useLiveStore((s) => s.selectedCountry)
  const sessionStatus = useSessionStore((s) => s.status)
  const isGame = mode === 'game'
  const gameSessionReady = sessionStatus === 'guest' || sessionStatus === 'authed'
  const showGamePanels = isGame && gameSessionReady
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)

  // Always run the game clock so pending bets resolve even after switching modes.
  const vm = useStrikeGame()

  const toggleSheet = (sheet: Exclude<MobileSheet, null>) => {
    setMobileSheet((current) => (current === sheet ? null : sheet))
  }

  const openGame = () => {
    setMode('game')
    setMobileSheet('game')
  }

  return (
    <>
      {/* Left column */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 top-20 z-40 hidden flex-col gap-3 md:flex md:right-auto md:w-75">
        {isGame && <GameAccount />}
        <ModeBar />
        {mode !== 'free' && (!isGame || showGamePanels) && <LeftPanel pro={mode === 'pro' || isGame} />}
      </div>

      {/* Right column */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-20 z-40 hidden w-[320px] flex-col gap-3 lg:flex">
        <div className="invisible shrink-0 pointer-events-none" aria-hidden>
          <ModeBar />
        </div>

        {showGamePanels ? (
          <StrikeGamePanel vm={vm} />
        ) : selectedCountry ? (
          <CountryPanel />
        ) : (
          !isGame && mode !== 'free' && <GlobeInfoPanel pro={mode === 'pro'} />
        )}
      </div>

      {/* Bottom-centre betting bar (Game mode only) */}
      {showGamePanels && <BetBar vm={vm} />}

      {/* Mobile-only action bar */}
      <div className="pointer-events-auto fixed bottom-3 left-3 right-3 z-50 md:hidden">
        <div className="glass flex gap-2 rounded-3xl border border-white/10 p-2 shadow-2xl">
          <MobileActionButton active={mobileSheet === 'console'} onClick={() => toggleSheet('console')}>
            Console
          </MobileActionButton>
          <MobileActionButton active={mobileSheet === 'info'} onClick={() => toggleSheet('info')}>
            {selectedCountry ? 'Country' : 'Info'}
          </MobileActionButton>
          <MobileActionButton active={mobileSheet === 'game'} onClick={openGame}>
            Game
          </MobileActionButton>
        </div>
      </div>

      {/* Mobile-only one-at-a-time bottom sheet */}
      {mobileSheet && (
        <div className="pointer-events-none fixed inset-x-3 bottom-20 z-50 md:hidden">
          <div className="glass pointer-events-auto max-h-[68vh] overflow-hidden rounded-3xl border border-white/10 p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">
                {mobileSheet === 'console' ? 'Console' : mobileSheet === 'info' ? (selectedCountry ? selectedCountry.name : 'Globe') : 'Game'}
              </span>
              <button
                type="button"
                onClick={() => setMobileSheet(null)}
                aria-label="Close panel"
                className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/60 transition hover:bg-white/15 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="panel-scroll max-h-[58vh] overflow-y-auto pr-1">
              {mobileSheet === 'console' && (
                <div className="space-y-3">
                  <ModeBar />
                  <LeftPanel pro={mode === 'pro' || isGame} />
                </div>
              )}

              {mobileSheet === 'info' && (
                selectedCountry ? <CountryPanel /> : mode !== 'free' ? <GlobeInfoPanel pro={mode === 'pro'} /> : (
                  <div className="rounded-2xl bg-white/5 p-4 text-sm text-white/55">
                    Select Beginner or Pro mode to see live globe stats.
                  </div>
                )
              )}

              {mobileSheet === 'game' && (
                <div className="space-y-3">
                  <GameAccount />
                  {showGamePanels ? (
                    <>
                      <BetBar vm={vm} variant="embedded" />
                      <StrikeGamePanel vm={vm} />
                    </>
                  ) : (
                    <div className="rounded-2xl bg-white/5 p-4 text-sm text-white/55">
                      Preparing your game profile…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
